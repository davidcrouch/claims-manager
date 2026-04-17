import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { More0Service } from '../../more0/more0.service';
import { InProcessProjectionService } from '../external/in-process-projection.service';
import { ParentNotProjectedError } from '../external/errors/parent-not-projected.error';
import { WebhookRetryService } from './webhook-retry.service';
import {
  ExternalProcessingLogRepository,
  InboundWebhookEventsRepository,
} from '../../database/repositories';

export type OrchestratorRoute = 'more0' | 'inproc' | 'none';

export interface OrchestratorResult {
  route: OrchestratorRoute;
  ok: boolean;
  reason?: string;
}

/**
 * WebhookOrchestratorService decides, after the external_object row is
 * persisted, whether to hand the event off to More0 or run the in-process
 * projection. This replaces the previous implicit "mock mode" behaviour in
 * More0Service with an explicit, auditable decision recorded in the
 * processing log's `metadata` column.
 *
 * See docs/implementation/29_TEMPORARY_WEBHOOK_ORCHESTRATOR.md §2, §3.
 */
@Injectable()
export class WebhookOrchestratorService {
  private readonly logger = new Logger('WebhookOrchestratorService');

  constructor(
    private readonly configService: ConfigService,
    private readonly more0Service: More0Service,
    private readonly inProcProjection: InProcessProjectionService,
    private readonly retryService: WebhookRetryService,
    private readonly processingLogRepo: ExternalProcessingLogRepository,
    private readonly webhookRepo: InboundWebhookEventsRepository,
  ) {}

  async finalize(params: {
    eventId: string;
    tenantId: string;
    connectionId: string;
    providerEntityType: string;
    providerEntityId: string;
    externalObjectId: string;
    processingLogId: string;
    eventType: string;
  }): Promise<OrchestratorResult> {
    const logPrefix = 'WebhookOrchestratorService.finalize';
    const route = this.resolveRoute();
    this.logger.log(
      `${logPrefix} — eventId=${params.eventId} route=${route} entity=${params.providerEntityType}`,
    );

    if (route === 'more0') {
      return this.runMore0({ ...params });
    }

    if (route === 'inproc') {
      return this.runInProc({ ...params });
    }

    this.logger.warn(
      `${logPrefix} — eventId=${params.eventId} route=none; leaving webhook at 'fetched' for sweep/manual replay`,
    );
    await this.processingLogRepo.updateStatus({
      id: params.processingLogId,
      status: 'pending',
      metadata: { orchestratorRoute: 'none', reason: 'orchestrator_disabled' },
    });
    return { route: 'none', ok: false, reason: 'orchestrator_disabled' };
  }

  private async runMore0(params: {
    eventId: string;
    tenantId: string;
    connectionId: string;
    providerEntityType: string;
    providerEntityId: string;
    externalObjectId: string;
    processingLogId: string;
    eventType: string;
  }): Promise<OrchestratorResult> {
    const logPrefix = 'WebhookOrchestratorService.runMore0';
    try {
      const { runId } = await this.more0Service.invokeWorkflow({
        workflowName: 'process-webhook-event',
        input: {
          eventId: params.eventId,
          tenantId: params.tenantId,
          connectionId: params.connectionId,
          eventType: params.eventType,
          providerEntityId: params.providerEntityId,
          processingLogId: params.processingLogId,
          externalObjectId: params.externalObjectId,
        },
        context: { tenantId: params.tenantId },
      });

      await this.processingLogRepo.updateStatus({
        id: params.processingLogId,
        status: 'processing',
        workflowRunId: runId,
        metadata: { orchestratorRoute: 'more0', workflowRunId: runId },
      });

      await this.webhookRepo.updateProcessingStatus({
        id: params.eventId,
        processingStatus: 'dispatched',
      });

      this.logger.log(
        `${logPrefix} — eventId=${params.eventId} dispatched to more0 runId=${runId}`,
      );
      return { route: 'more0', ok: true };
    } catch (error) {
      const msg = (error as Error).message;
      this.logger.error(
        `${logPrefix} — eventId=${params.eventId} more0 invocation failed: ${msg}`,
      );
      await this.processingLogRepo.updateStatus({
        id: params.processingLogId,
        status: 'workflow_invoke_failed',
        errorMessage: msg,
        metadata: { orchestratorRoute: 'more0', error: msg },
      });
      return { route: 'more0', ok: false, reason: msg };
    }
  }

  private async runInProc(params: {
    eventId: string;
    tenantId: string;
    connectionId: string;
    providerEntityType: string;
    providerEntityId: string;
    externalObjectId: string;
    processingLogId: string;
    eventType: string;
  }): Promise<OrchestratorResult> {
    const logPrefix = 'WebhookOrchestratorService.runInProc';

    try {
      const outcome = await this.inProcProjection.run({
        tenantId: params.tenantId,
        connectionId: params.connectionId,
        providerEntityType: params.providerEntityType,
        externalObjectId: params.externalObjectId,
        processingLogId: params.processingLogId,
        webhookEventId: params.eventId,
      });

      if (outcome.status === 'completed') {
        this.logger.log(
          `${logPrefix} — eventId=${params.eventId} completed, ${outcome.internalEntityType}=${outcome.internalEntityId}`,
        );
      } else if (outcome.status === 'skipped') {
        this.logger.warn(
          `${logPrefix} — eventId=${params.eventId} skipped (${outcome.reason})`,
        );
      } else {
        this.logger.warn(
          `${logPrefix} — eventId=${params.eventId} skipped_no_mapper`,
        );
      }

      return { route: 'inproc', ok: true };
    } catch (error) {
      const msg = (error as Error).message;

      if (ParentNotProjectedError.isInstance(error)) {
        this.logger.warn(
          `${logPrefix} — eventId=${params.eventId} parent-not-projected; handing to retry service: ${msg}`,
        );

        const retryOutcome = await this.retryService.handleParentNotProjected({
          context: {
            eventId: params.eventId,
            tenantId: params.tenantId,
            connectionId: params.connectionId,
            providerEntityType: params.providerEntityType,
            providerEntityId: params.providerEntityId,
            externalObjectId: params.externalObjectId,
            processingLogId: params.processingLogId,
            eventType: params.eventType,
          },
          error,
        });

        if (retryOutcome.handled && retryOutcome.recoveredInline) {
          this.logger.log(
            `${logPrefix} — eventId=${params.eventId} recovered inline`,
          );
          return { route: 'inproc', ok: true };
        }

        if (retryOutcome.handled) {
          await this.webhookRepo.updateProcessingStatus({
            id: params.eventId,
            processingStatus: 'retry_scheduled',
            processingError: msg,
          });
          return {
            route: 'inproc',
            ok: true,
            reason: 'retry_scheduled',
          };
        }

        // Retries exhausted — fall through to the permanent-failure path.
      }

      this.logger.error(
        `${logPrefix} — eventId=${params.eventId} projection failed: ${msg}`,
      );

      await this.processingLogRepo.updateStatus({
        id: params.processingLogId,
        status: 'failed',
        completedAt: new Date(),
        errorMessage: msg,
        externalObjectId: params.externalObjectId,
        metadata: { orchestratorRoute: 'inproc', error: msg },
      });

      await this.webhookRepo.updateProcessingStatus({
        id: params.eventId,
        processingStatus: 'mapper_failed',
        processingError: msg,
      });

      return { route: 'inproc', ok: false, reason: msg };
    }
  }

  private resolveRoute(): OrchestratorRoute {
    if (this.shouldUseMore0()) return 'more0';
    if (this.configService.get<boolean>('webhook.inProcMappingEnabled', true)) {
      return 'inproc';
    }
    return 'none';
  }

  private shouldUseMore0(): boolean {
    const enabled = this.configService.get<boolean>('more0.enabled', false);
    const apiKey = this.configService.get<string>('more0.apiKey', '');
    return enabled && !!apiKey;
  }
}
