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
  OnModuleInit,
  Optional,
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
import { CrunchworkJobMapper } from '../mappers/crunchwork-job.mapper';
import { CrunchworkClaimMapper } from '../mappers/crunchwork-claim.mapper';
import { CrunchworkPurchaseOrderMapper } from '../mappers/crunchwork-purchase-order.mapper';
import { CrunchworkInvoiceMapper } from '../mappers/crunchwork-invoice.mapper';
import { CrunchworkTaskMapper } from '../mappers/crunchwork-task.mapper';
import { CrunchworkMessageMapper } from '../mappers/crunchwork-message.mapper';
import { CrunchworkAttachmentMapper } from '../mappers/crunchwork-attachment.mapper';

export interface EntityMapper {
  map(params: {
    externalObject: Record<string, unknown>;
    tenantId: string;
    connectionId: string;
  }): Promise<{ internalEntityId: string; internalEntityType: string }>;
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
export class ExternalToolsController implements OnModuleInit {
  private readonly logger = new Logger('ExternalToolsController');
  private mappers: Record<string, EntityMapper> = {};

  constructor(
    private readonly crunchworkService: CrunchworkService,
    private readonly externalObjectService: ExternalObjectService,
    private readonly externalObjectsRepo: ExternalObjectsRepository,
    private readonly processingLogRepo: ExternalProcessingLogRepository,
    private readonly eventAttemptsRepo: ExternalEventAttemptsRepository,
    @Optional() private readonly jobMapper?: CrunchworkJobMapper,
    @Optional() private readonly claimMapper?: CrunchworkClaimMapper,
    @Optional() private readonly poMapper?: CrunchworkPurchaseOrderMapper,
    @Optional() private readonly invoiceMapper?: CrunchworkInvoiceMapper,
    @Optional() private readonly taskMapper?: CrunchworkTaskMapper,
    @Optional() private readonly messageMapper?: CrunchworkMessageMapper,
    @Optional() private readonly attachmentMapper?: CrunchworkAttachmentMapper,
  ) {}

  onModuleInit(): void {
    if (this.jobMapper) this.mappers['job'] = this.jobMapper;
    if (this.claimMapper) this.mappers['claim'] = this.claimMapper;
    if (this.poMapper) this.mappers['purchase_order'] = this.poMapper;
    if (this.invoiceMapper) this.mappers['invoice'] = this.invoiceMapper;
    if (this.taskMapper) this.mappers['task'] = this.taskMapper;
    if (this.messageMapper) this.mappers['message'] = this.messageMapper;
    if (this.attachmentMapper) this.mappers['attachment'] = this.attachmentMapper;
  }

  registerMapper(params: { entityType: string; mapper: EntityMapper }): void {
    this.mappers[params.entityType] = params.mapper;
  }

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
      providerCode: string;
      providerEntityType: string;
      providerEntityId: string;
      normalizedEntityType?: string;
      payload: Record<string, unknown>;
      sourceEventId?: string;
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
      providerCode: body.providerCode,
      providerEntityType: body.providerEntityType,
      providerEntityId: body.providerEntityId,
      normalizedEntityType: body.normalizedEntityType ?? body.providerEntityType,
      payload: body.payload,
      sourceEventId: body.sourceEventId,
    });

    return {
      externalObject: result.externalObject as unknown as Record<string, unknown>,
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
  ): Promise<{ internalEntityId: string; internalEntityType: string }> {
    this.logger.log(
      `ExternalToolsController.mapEntity — entityType=${entityType} externalObjectId=${body.externalObjectId}`,
    );

    const mapper = this.mappers[entityType];
    if (!mapper) {
      throw new BadRequestException(`No mapper registered for entity type: ${entityType}`);
    }

    const externalObject = await this.externalObjectsRepo.findById({
      id: body.externalObjectId,
    });
    if (!externalObject) {
      throw new BadRequestException(`External object not found: ${body.externalObjectId}`);
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
      completedAt: body.status === 'completed' || body.status === 'failed' ? new Date() : undefined,
      externalObjectId: body.externalObjectId,
      errorMessage: body.errorMessage,
    });

    return { success: true };
  }

  static resolveEntityType(eventType: string): string | null {
    return EVENT_TYPE_TO_ENTITY[eventType] ?? null;
  }
}
