import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  ExternalObjectsRepository,
  ExternalProcessingLogRepository,
  InboundWebhookEventsRepository,
} from '../../database/repositories';
import { DRIZZLE, type DrizzleDB } from '../../database/drizzle.module';
import { EntityMapperRegistry } from './entity-mapper.registry';

export type InProcessProjectionOutcome =
  | {
      status: 'completed';
      internalEntityType: string;
      internalEntityId: string;
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
 * and /api/v1/tools/processing-log/update. Reuses the EntityMapper registry.
 */
@Injectable()
export class InProcessProjectionService {
  private readonly logger = new Logger('InProcessProjectionService');

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly mapperRegistry: EntityMapperRegistry,
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

    const mapper = this.mapperRegistry.get({
      entityType: params.providerEntityType,
    });
    if (!mapper) {
      this.logger.warn(
        `${logPrefix} — no mapper registered for entityType=${params.providerEntityType}; marking skipped_no_mapper`,
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

    const externalObject = await this.externalObjectsRepo.findById({
      id: params.externalObjectId,
    });
    if (!externalObject) {
      throw new Error(
        `${logPrefix} — external object not found: ${params.externalObjectId}`,
      );
    }

    return this.db.transaction(async (tx) => {
      const result = await mapper.map({
        externalObject: externalObject as unknown as Record<string, unknown>,
        tenantId: params.tenantId,
        connectionId: params.connectionId,
        tx,
      });

      if (result.skipped) {
        this.logger.warn(
          `${logPrefix} — mapper reported skipped=${result.skipped} for entity=${params.providerEntityType}`,
        );
        await this.processingLogRepo.updateStatus({
          id: params.processingLogId,
          status: result.skipped,
          completedAt: new Date(),
          externalObjectId: params.externalObjectId,
          metadata: { orchestratorRoute: 'inproc', reason: result.skipped },
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
          reason: result.skipped,
          internalEntityType: result.internalEntityType,
        };
      }

      await this.processingLogRepo.updateStatus({
        id: params.processingLogId,
        status: 'completed',
        completedAt: new Date(),
        externalObjectId: params.externalObjectId,
        metadata: {
          orchestratorRoute: 'inproc',
          internalEntityType: result.internalEntityType,
          internalEntityId: result.internalEntityId,
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
        internalEntityType: result.internalEntityType,
        internalEntityId: result.internalEntityId,
      };
    });
  }
}
