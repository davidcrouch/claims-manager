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
 * WebhookOrchestratorService decides, after the `inbound_webhook_events` row
 * has been persisted, whether to hand the event off to More0 (via the HTTP
 * gateway) or run the legacy in-process projection. The route is selected
 * by `WEBHOOK_PROCESSING_MODE` (`more0` | `inproc`, default `inproc`) with
 * `MORE0_ENABLED` + `MORE0_API_KEY` acting as a circuit breaker for the
 * More0 branch.
 *
 * See `docs/implementation/31_MORE0_WEBHOOK_WORKFLOW_APP.md`.
 */
@Injectable()
export class WebhookOrchestratorService {
  private readonly logger = new Logger('WebhookOrchestratorService');
  private static readonly WORKFLOW_CAP =
    'claims-manager-webhook/workflow.claims-manager-webhook.process-inbound-event';

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
    externalObjectId: string | null;
    processingLogId: string;
    eventType: string;
  }): Promise<OrchestratorResult> {
    const logPrefix = 'WebhookOrchestratorService.finalize';
    const route = this.resolveRoute();
    this.logger.log(
      `${logPrefix} — eventId=${params.eventId} route=${route} entity=${params.providerEntityType}`,
    );

    if (route === 'more0') {
      return this.runMore0({
        eventId: params.eventId,
        processingLogId: params.processingLogId,
        tenantId: params.tenantId,
      });
    }

    if (route === 'inproc') {
      if (!params.externalObjectId) {
        this.logger.error(
          `${logPrefix} — eventId=${params.eventId} route=inproc but externalObjectId missing; marking log failed`,
        );
        await this.processingLogRepo.updateStatus({
          id: params.processingLogId,
          status: 'failed',
          errorMessage: 'in-process projection requires externalObjectId',
          metadata: {
            orchestratorRoute: 'inproc',
            reason: 'missing_external_object',
          },
        });
        return {
          route: 'inproc',
          ok: false,
          reason: 'missing_external_object',
        };
      }

      return this.runInProc({
        eventId: params.eventId,
        tenantId: params.tenantId,
        connectionId: params.connectionId,
        providerEntityType: params.providerEntityType,
        providerEntityId: params.providerEntityId,
        externalObjectId: params.externalObjectId,
        processingLogId: params.processingLogId,
        eventType: params.eventType,
      });
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
    processingLogId: string;
    tenantId: string;
  }): Promise<OrchestratorResult> {
    const logPrefix = 'WebhookOrchestratorService.runMore0';
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
        `${logPrefix} — eventId=${params.eventId} dispatched to more0 runId=${runId ?? 'n/a'}`,
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
      await this.webhookRepo.updateProcessingStatus({
        id: params.eventId,
        processingStatus: 'dispatch_failed',
        processingError: msg,
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

  /**
   * Public so `WebhooksService` can branch BEFORE the CW pre-fetch when the
   * More0 route is active (the workflow is responsible for fetching).
   */
  resolveRoute(): OrchestratorRoute {
    const mode = (
      this.configService.get<string>('webhook.processingMode', 'inproc') ||
      'inproc'
    ).toLowerCase();

    if (mode === 'more0' && this.shouldUseMore0()) {
      return 'more0';
    }

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
