import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { More0Service } from '../../more0/more0.service';
import { ExternalProcessingLogRepository } from '../../database/repositories/external-processing-log.repository';
import { InboundWebhookEventsRepository } from '../../database/repositories/inbound-webhook-events.repository';

export type OrchestratorRoute = 'more0' | 'none';

@Injectable()
export class WebhookOrchestratorService {
  private readonly logger = new Logger('provider.WebhookOrchestratorService');
  private static readonly WORKFLOW_CAP =
    'claims-manager-webhook/workflow.claims-manager-webhook.process-inbound-event';

  constructor(
    private readonly configService: ConfigService,
    private readonly more0Service: More0Service,
    private readonly processingLogRepo: ExternalProcessingLogRepository,
    private readonly webhookRepo: InboundWebhookEventsRepository,
  ) {}

  resolveRoute(): OrchestratorRoute {
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
    if (route !== 'more0') {
      return { route: 'none', ok: false, reason: 'orchestrator_disabled' };
    }
    return this.runMore0(params);
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
        `${logPrefix} — eventId=${params.eventId} failed: ${msg}`,
      );
      await this.processingLogRepo.updateStatus({
        id: params.processingLogId,
        status: 'workflow_invoke_failed',
        errorMessage: msg,
        metadata: { orchestratorRoute: 'more0', error: msg },
      });
      await this.webhookRepo.updateProcessingStatus({
        id: params.eventId,
        processingStatus: 'dispatch_failed',
        processingError: msg,
      });
      return { route: 'more0', ok: false, reason: msg };
    }
  }
}
