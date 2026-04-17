import {
  Controller,
  Post,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  UseGuards,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { Public } from '../../../auth/decorators/public.decorator';
import { ToolAuthGuard } from './tool-auth.guard';
import { ExternalObjectService } from '../external-object.service';
import { CrunchworkService } from '../../../crunchwork/crunchwork.service';
import {
  ExternalObjectsRepository,
  ExternalProcessingLogRepository,
  ExternalEventAttemptsRepository,
} from '../../../database/repositories';
import { EntityMapperRegistry } from '../entity-mapper.registry';
import type { DrizzleDbOrTx } from '../../../database/drizzle.module';

export interface EntityMapper {
  map(params: {
    externalObject: Record<string, unknown>;
    tenantId: string;
    connectionId: string;
    tx?: DrizzleDbOrTx;
  }): Promise<{
    internalEntityId: string;
    internalEntityType: string;
    skipped?: string;
  }>;
}

const EVENT_TYPE_TO_ENTITY: Record<string, string> = {
  NEW_JOB: 'job',
  UPDATE_JOB: 'job',
  NEW_CLAIM: 'claim',
  UPDATE_CLAIM: 'claim',
  NEW_PURCHASE_ORDER: 'purchase_order',
  UPDATE_PURCHASE_ORDER: 'purchase_order',
  NEW_INVOICE: 'invoice',
  UPDATE_INVOICE: 'invoice',
  NEW_MESSAGE: 'message',
  NEW_TASK: 'task',
  UPDATE_TASK: 'task',
  NEW_ATTACHMENT: 'attachment',
  UPDATE_ATTACHMENT: 'attachment',
  NEW_QUOTE: 'quote',
  UPDATE_QUOTE: 'quote',
  NEW_REPORT: 'report',
  UPDATE_REPORT: 'report',
  NEW_APPOINTMENT: 'appointment',
  UPDATE_APPOINTMENT: 'appointment',
};

@Controller('api/v1/tools')
@Public()
@UseGuards(ToolAuthGuard)
export class ExternalToolsController {
  private readonly logger = new Logger('ExternalToolsController');

  constructor(
    private readonly crunchworkService: CrunchworkService,
    private readonly externalObjectService: ExternalObjectService,
    private readonly externalObjectsRepo: ExternalObjectsRepository,
    private readonly processingLogRepo: ExternalProcessingLogRepository,
    private readonly eventAttemptsRepo: ExternalEventAttemptsRepository,
    private readonly mapperRegistry: EntityMapperRegistry,
  ) {}

  @Post('crunchwork/fetch')
  @HttpCode(HttpStatus.OK)
  async fetchEntity(
    @Body()
    body: {
      connectionId: string;
      providerEntityType: string;
      providerEntityId: string;
    },
  ): Promise<{ payload: Record<string, unknown> }> {
    this.logger.log(
      `ExternalToolsController.fetchEntity — type=${body.providerEntityType} id=${body.providerEntityId}`,
    );

    const payload = await this.crunchworkService.fetchEntityByType({
      connectionId: body.connectionId,
      entityType: body.providerEntityType,
      entityId: body.providerEntityId,
    });

    return { payload };
  }

  @Post('external-objects/upsert')
  @HttpCode(HttpStatus.OK)
  async upsertExternalObject(
    @Body()
    body: {
      tenantId: string;
      connectionId: string;
      providerId?: string;
      providerCode: string;
      providerEntityType: string;
      providerEntityId: string;
      normalizedEntityType?: string;
      payload: Record<string, unknown>;
      sourceEventId?: string;
      sourceEventType?: string;
      sourceEventTimestamp?: string;
    },
  ): Promise<{
    externalObject: Record<string, unknown>;
    isNew: boolean;
    hashChanged: boolean;
  }> {
    this.logger.log(
      `ExternalToolsController.upsertExternalObject — ${body.providerEntityType}/${body.providerEntityId}`,
    );

    const result = await this.externalObjectService.upsertFromFetch({
      tenantId: body.tenantId,
      connectionId: body.connectionId,
      providerId: body.providerId,
      providerCode: body.providerCode,
      providerEntityType: body.providerEntityType,
      providerEntityId: body.providerEntityId,
      normalizedEntityType:
        body.normalizedEntityType ?? body.providerEntityType,
      payload: body.payload,
      sourceEventId: body.sourceEventId,
      sourceEventType: body.sourceEventType,
      sourceEventTimestamp: body.sourceEventTimestamp
        ? new Date(body.sourceEventTimestamp)
        : undefined,
    });

    return {
      externalObject: result.externalObject as unknown as Record<
        string,
        unknown
      >,
      isNew: result.isNew,
      hashChanged: result.hashChanged,
    };
  }

  @Post('mappers/:entityType')
  @HttpCode(HttpStatus.OK)
  async mapEntity(
    @Param('entityType') entityType: string,
    @Body()
    body: {
      externalObjectId: string;
      tenantId: string;
      connectionId: string;
    },
  ): Promise<{
    internalEntityId: string;
    internalEntityType: string;
    skipped?: string;
  }> {
    this.logger.log(
      `ExternalToolsController.mapEntity — entityType=${entityType} externalObjectId=${body.externalObjectId}`,
    );

    const mapper = this.mapperRegistry.get({ entityType });
    if (!mapper) {
      throw new BadRequestException(
        `No mapper registered for entity type: ${entityType}`,
      );
    }

    const externalObject = await this.externalObjectsRepo.findById({
      id: body.externalObjectId,
    });
    if (!externalObject) {
      throw new BadRequestException(
        `External object not found: ${body.externalObjectId}`,
      );
    }

    return mapper.map({
      externalObject: externalObject as unknown as Record<string, unknown>,
      tenantId: body.tenantId,
      connectionId: body.connectionId,
    });
  }

  @Post('processing-log/update')
  @HttpCode(HttpStatus.OK)
  async updateProcessingLog(
    @Body()
    body: {
      processingLogId: string;
      status: string;
      externalObjectId?: string;
      errorMessage?: string;
    },
  ): Promise<{ success: boolean }> {
    this.logger.log(
      `ExternalToolsController.updateProcessingLog — id=${body.processingLogId} status=${body.status}`,
    );

    await this.processingLogRepo.updateStatus({
      id: body.processingLogId,
      status: body.status,
      completedAt:
        body.status === 'completed' || body.status === 'failed'
          ? new Date()
          : undefined,
      externalObjectId: body.externalObjectId,
      errorMessage: body.errorMessage,
    });

    return { success: true };
  }

  static resolveEntityType(eventType: string): string | null {
    return EVENT_TYPE_TO_ENTITY[eventType] ?? null;
  }
}
