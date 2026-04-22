import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Inject,
  Logger,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Public } from '../../../auth/decorators/public.decorator';
import { DRIZZLE, type DrizzleDB } from '../../../database/drizzle.module';
import {
  ExternalProcessingLogRepository,
  InboundWebhookEventsRepository,
} from '../../../database/repositories';
import { ExternalObjectService } from '../../external/external-object.service';
import { ToolAuthGuard } from '../tool-auth.guard';

/**
 * HTTP endpoint that backs `tool.claims-manager-webhook.external-object-upsert`.
 * Called from the sandboxed inline-ts tool module
 * `apps/api/more0/definitions/tools/external-object-upsert/external-object-upsert.ts`.
 */
@Controller('api/v1/webhook-tools/external-objects')
@Public()
@UseGuards(ToolAuthGuard)
export class ExternalObjectUpsertController {
  private readonly logger = new Logger('ExternalObjectUpsertController');

  constructor(
    private readonly externalObjectService: ExternalObjectService,
    private readonly processingLogRepo: ExternalProcessingLogRepository,
    private readonly webhookRepo: InboundWebhookEventsRepository,
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
  ) {}

  @Post('upsert')
  @HttpCode(HttpStatus.OK)
  async upsert(
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
      sourceEventType?: string;
      sourceEventTimestamp?: string;
      archiveObjectUri?: string;
      eventId?: string;
    },
  ): Promise<{
    externalObject: Record<string, unknown>;
    processingLogId: string | null;
    isNew: boolean;
    hashChanged: boolean;
    payloadHash: string;
  }> {
    const logPrefix = 'ExternalObjectUpsertController.upsert';
    this.logger.log(
      `${logPrefix} — ${body.providerEntityType}/${body.providerEntityId} eventId=${body.eventId ?? 'none'} archive=${body.archiveObjectUri ? 'yes' : 'no'}`,
    );

    let externalObject: Record<string, unknown> | null = null;
    let isNew = false;
    let hashChanged = false;
    let payloadHash = '';
    let processingLogId: string | null = null;

    await this.db.transaction(async (tx) => {
      const result = await this.externalObjectService.upsertFromFetch({
        tenantId: body.tenantId,
        connectionId: body.connectionId,
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
        archiveObjectUri: body.archiveObjectUri,
        tx,
      });
      externalObject = result.externalObject as unknown as Record<
        string,
        unknown
      >;
      isNew = result.isNew;
      hashChanged = result.hashChanged;
      payloadHash = result.payloadHash;

      if (body.eventId) {
        const existing = await this.processingLogRepo.findByEventId({
          eventId: body.eventId,
        });
        if (existing) {
          processingLogId = existing.id;
          await this.processingLogRepo.updateStatus({
            id: existing.id,
            status: 'processing',
            externalObjectId: result.externalObject.id,
            tx,
          });
        } else {
          const logEntry = await this.processingLogRepo.create({
            data: {
              tenantId: body.tenantId,
              connectionId: body.connectionId,
              eventId: body.eventId,
              providerEntityType: body.providerEntityType,
              providerEntityId: body.providerEntityId,
              action: 'webhook_process',
              status: 'processing',
              externalObjectId: result.externalObject.id,
            },
            tx,
          });
          processingLogId = logEntry.id;
        }

        await this.webhookRepo.updateProcessingStatus({
          id: body.eventId,
          processingStatus: 'fetched',
          tx,
        });
      }
    });

    return {
      externalObject: externalObject!,
      processingLogId,
      isNew,
      hashChanged,
      payloadHash,
    };
  }
}
