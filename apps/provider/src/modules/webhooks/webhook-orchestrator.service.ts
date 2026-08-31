import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { More0Service } from '../../more0/more0.service';
import { ExternalProcessingLogRepository } from '../../database/repositories/external-processing-log.repository';
import { InboundWebhookEventsRepository } from '../../database/repositories/inbound-webhook-events.repository';
import { ApiProcessClient } from './api-process.client';

export type OrchestratorRoute = 'api' | 'more0' | 'none';

@Injectable()
export class WebhookOrchestratorService {
  private readonly logger = new Logger('provider.WebhookOrchestratorService');
  private static readonly WORKFLOW_CAP =
    'claims-manager-webhook/workflow.claims-manager-webhook.process-inbound-event';

  constructor(
    private readonly configService: ConfigService,
    private readonly more0Service: More0Service,
    private readonly apiProcessClient: ApiProcessClient,
    private readonly processingLogRepo: ExternalProcessingLogRepository,
    private readonly webhookRepo: InboundWebhookEventsRepository,
  ) {}

  resolveRoute(): OrchestratorRoute {
    // Prefer api-server push whenever configured — More0 is optional.
    if (this.apiProcessClient.isConfigured()) {
      return 'api';
    }

    const mode = this.configService.get<'more0' | 'none'>(
      'webhook.processingMode',
      'more0',
    );
    if (mode === 'more0' && this.more0Service.isEnabled()) {
      return 'more0';
    }
    if (mode === 'more0' && !this.more0Service.isEnabled()) {
      this.logger.warn(
        'provider.WebhookOrchestratorService.resolveRoute — more0 requested but disabled; route=none',
      );
    }
    return 'none';
  }

  async finalize(params: {
    eventId: string;
    processingLogId: string;
  }): Promise<{ route: OrchestratorRoute; ok: boolean; reason?: string }> {
    const route = this.resolveRoute();
    if (route === 'api') {
      return this.runApi(params);
    }
    if (route !== 'more0') {
      return { route: 'none', ok: false, reason: 'orchestrator_disabled' };
    }
    return this.runMore0(params);
  }

  private async runApi(params: {
    eventId: string;
    processingLogId: string;
  }): Promise<{ route: OrchestratorRoute; ok: boolean; reason?: string }> {
    const logPrefix = 'provider.WebhookOrchestratorService.runApi';
    const result = await this.apiProcessClient.processEvent({
      eventId: params.eventId,
    });

    if (result.ok) {
      await this.processingLogRepo.updateStatus({
        id: params.processingLogId,
        status: 'processing',
        metadata: {
          orchestratorRoute: 'api',
          apiStatus: result.status ?? 'ok',
        },
      });
      // api-server owns inbound_webhook_events.processing_status after a
      // successful push — do not overwrite completed/fetched here.
      this.logger.log(
        `${logPrefix} — eventId=${params.eventId} pushed to api-server`,
      );

      // More0 is best-effort only and must never undo a successful api push.
      void this.tryMore0BestEffort({ eventId: params.eventId });
      return { route: 'api', ok: true };
    }

    const reason = result.reason ?? 'api_dispatch_failed';
    this.logger.warn(
      `${logPrefix} — eventId=${params.eventId} api push failed: ${reason}; leaving pending for sweep`,
    );
    await this.processingLogRepo.updateStatus({
      id: params.processingLogId,
      status: 'pending',
      errorMessage: reason,
      metadata: { orchestratorRoute: 'api', error: reason },
    });
    // Keep pending — api sweep (and a later retry) can recover. Do not
    // mark dispatch_failed just because More0/api briefly failed.
    await this.webhookRepo.updateProcessingStatus({
      id: params.eventId,
      processingStatus: 'pending',
      processingError: reason,
    });

    void this.tryMore0BestEffort({ eventId: params.eventId });
    return { route: 'api', ok: false, reason };
  }

  private async runMore0(params: {
    eventId: string;
    processingLogId: string;
  }): Promise<{ route: OrchestratorRoute; ok: boolean; reason?: string }> {
    const logPrefix = 'provider.WebhookOrchestratorService.runMore0';
    try {
      const result = await this.more0Service.invokeViaGateway({
        cap: WebhookOrchestratorService.WORKFLOW_CAP,
        method: 'execute',
        params: { eventId: params.eventId },
      });
      const runId = result.runId ?? null;

      await this.processingLogRepo.updateStatus({
        id: params.processingLogId,
        status: 'processing',
        workflowRunId: runId ?? undefined,
        metadata: {
          orchestratorRoute: 'more0',
          workflowRunId: runId,
          workflowCap: WebhookOrchestratorService.WORKFLOW_CAP,
        },
      });
      await this.webhookRepo.updateProcessingStatus({
        id: params.eventId,
        processingStatus: 'dispatched',
      });
      this.logger.log(
        `${logPrefix} — eventId=${params.eventId} runId=${runId ?? 'n/a'}`,
      );
      return { route: 'more0', ok: true };
    } catch (error) {
      const msg = (error as Error).message;
      this.logger.error(
        `${logPrefix} — eventId=${params.eventId} failed: ${msg}; leaving pending (More0 optional)`,
      );
      await this.processingLogRepo.updateStatus({
        id: params.processingLogId,
        status: 'pending',
        errorMessage: msg,
        metadata: { orchestratorRoute: 'more0', error: msg },
      });
      // Do not mark dispatch_failed — leave pending for api sweep / retry.
      await this.webhookRepo.updateProcessingStatus({
        id: params.eventId,
        processingStatus: 'pending',
        processingError: msg,
      });
      return { route: 'more0', ok: false, reason: msg };
    }
  }

  private async tryMore0BestEffort(params: {
    eventId: string;
  }): Promise<void> {
    if (!this.more0Service.isEnabled()) return;
    const gateway = this.configService.get<string>(
      'more0.gatewayUrl',
      'http://localhost:3205',
    );
    if (/localhost|127\.0\.0\.1/i.test(gateway)) {
      this.logger.log(
        `provider.WebhookOrchestratorService.tryMore0BestEffort — skipping localhost gateway for eventId=${params.eventId}`,
      );
      return;
    }

    try {
      await this.more0Service.invokeViaGateway({
        cap: WebhookOrchestratorService.WORKFLOW_CAP,
        method: 'execute',
        params: { eventId: params.eventId },
      });
      this.logger.log(
        `provider.WebhookOrchestratorService.tryMore0BestEffort — eventId=${params.eventId} queued`,
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(
        `provider.WebhookOrchestratorService.tryMore0BestEffort — eventId=${params.eventId} ignored: ${message}`,
      );
    }
  }
}
