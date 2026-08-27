import { Inject, Injectable, Logger } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import {
  ExternalObjectsRepository,
  ExternalProcessingLogRepository,
  InboundWebhookEventsRepository,
} from '../../database/repositories';
import { DRIZZLE, type DrizzleDB } from '../../database/drizzle.module';
import { UseCaseRegistry } from '../domain/use-cases/use-case.registry';

export type InProcessProjectionOutcome =
  | {
      status: 'completed';
      internalEntityType: string;
      internalEntityId: string;
      metadata?: Record<string, unknown>;
    }
  | {
      status: 'skipped_no_mapper';
    }
  | {
      status: 'skipped';
      reason: string;
      internalEntityType: string;
    };

/**
 * InProcessProjectionService collapses, in one atomic TX, the work that
 * More0's workflow would otherwise do via /api/v1/tools/mappers/:entityType
 * and /api/v1/tools/processing-log/update. Uses the domain UseCaseRegistry.
 */
@Injectable()
export class InProcessProjectionService {
  private readonly logger = new Logger('InProcessProjectionService');

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly useCaseRegistry: UseCaseRegistry,
    private readonly externalObjectsRepo: ExternalObjectsRepository,
    private readonly processingLogRepo: ExternalProcessingLogRepository,
    private readonly webhookRepo: InboundWebhookEventsRepository,
  ) {}

  async run(params: {
    tenantId: string;
    connectionId: string;
    providerEntityType: string;
    externalObjectId: string;
    processingLogId: string;
    webhookEventId: string;
  }): Promise<InProcessProjectionOutcome> {
    const logPrefix = 'InProcessProjectionService.run';
    this.logger.log(
      `${logPrefix} — entity=${params.providerEntityType} externalObjectId=${params.externalObjectId} webhookEventId=${params.webhookEventId}`,
    );

    const useCase = this.useCaseRegistry.get(params.providerEntityType);

    if (!useCase) {
      const registered = this.useCaseRegistry.listRegistered();
      if (registered.length === 0) {
        // Registry is empty — likely a startup timing issue where the webhook
        // was dispatched before UseCaseRegistry.onModuleInit completed. Throw
        // so the orchestrator can schedule a retry rather than permanently
        // marking the event completed_unmapped.
        throw new Error(
          `${logPrefix} — UseCaseRegistry has no registered use cases (startup timing issue); ` +
            `cannot process entityType=${params.providerEntityType}`,
        );
      }

      this.logger.warn(
        `${logPrefix} — no use case registered for entityType=${params.providerEntityType}; ` +
          `registered=[${registered.join(', ')}]; marking skipped_no_mapper`,
      );
      await this.processingLogRepo.updateStatus({
        id: params.processingLogId,
        status: 'skipped_no_mapper',
        completedAt: new Date(),
        metadata: { orchestratorRoute: 'inproc', reason: 'no_mapper' },
      });
      await this.webhookRepo.updateProcessingStatus({
        id: params.webhookEventId,
        processingStatus: 'completed_unmapped',
        processedAt: new Date(),
      });
      return { status: 'skipped_no_mapper' };
    }

    this.logger.log(
      `${logPrefix} — using domain use case for entityType=${params.providerEntityType}`,
    );

    const externalObject = await this.externalObjectsRepo.findById({
      id: params.externalObjectId,
    });
    if (!externalObject) {
      throw new Error(
        `${logPrefix} — external object not found: ${params.externalObjectId}`,
      );
    }

    return this.db.transaction(async (tx) => {
      // Serialize concurrent projections for the same external object.
      // Two webhooks for the same entity (e.g. NEW then UPDATE) can arrive
      // milliseconds apart and race into separate transactions. Without this
      // lock both see "no existing link" and both create a new internal entity.
      await tx.execute(
        sql`SELECT pg_advisory_xact_lock(hashtext(${params.externalObjectId}))`,
      );

      const ucResult = await useCase.execute({
        externalObject: externalObject as unknown as Record<string, unknown>,
        tenantId: params.tenantId,
        connectionId: params.connectionId,
        tx,
      });

      if (ucResult.status === 'skipped') {
        const reason = ucResult.reason ?? 'skipped';
        this.logger.warn(
          `${logPrefix} — use case reported skipped=${reason} for entity=${params.providerEntityType}`,
        );
        await this.processingLogRepo.updateStatus({
          id: params.processingLogId,
          status: reason,
          completedAt: new Date(),
          externalObjectId: params.externalObjectId,
          metadata: { orchestratorRoute: 'inproc', reason },
          tx,
        });
        await this.webhookRepo.updateProcessingStatus({
          id: params.webhookEventId,
          processingStatus: 'completed_unmapped',
          processedAt: new Date(),
          tx,
        });
        return {
          status: 'skipped' as const,
          reason,
          internalEntityType: ucResult.internalEntityType,
        };
      }

      await this.processingLogRepo.updateStatus({
        id: params.processingLogId,
        status: 'completed',
        completedAt: new Date(),
        externalObjectId: params.externalObjectId,
        metadata: {
          orchestratorRoute: 'inproc',
          internalEntityType: ucResult.internalEntityType,
          internalEntityId: ucResult.internalEntityId,
        },
        tx,
      });

      await this.webhookRepo.updateProcessingStatus({
        id: params.webhookEventId,
        processingStatus: 'completed',
        processedAt: new Date(),
        tx,
      });

      return {
        status: 'completed' as const,
        internalEntityType: ucResult.internalEntityType,
        internalEntityId: ucResult.internalEntityId,
      };
    });
  }
}
