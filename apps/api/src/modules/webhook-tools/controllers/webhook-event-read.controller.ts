import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Logger,
  NotFoundException,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Public } from '../../../auth/decorators/public.decorator';
import {
  InboundWebhookEventsRepository,
  ExternalProcessingLogRepository,
} from '../../../database/repositories';
import { resolveEntityType } from '../../webhooks/event-type-resolver';
import { ToolAuthGuard } from '../tool-auth.guard';

/**
 * HTTP endpoint that backs `tool.claims-manager-webhook.webhook-event-read`.
 * Called from the sandboxed inline-ts tool module
 * `apps/api/more0/definitions/tools/webhook-event-read/webhook-event-read.ts`
 * via fetch + X-Tool-Secret.
 */
@Controller('api/v1/webhook-tools/events')
@Public()
@UseGuards(ToolAuthGuard)
export class WebhookEventReadController {
  private readonly logger = new Logger('WebhookEventReadController');

  constructor(
    private readonly webhookRepo: InboundWebhookEventsRepository,
    private readonly processingLogRepo: ExternalProcessingLogRepository,
  ) {}

  @Post('read')
  @HttpCode(HttpStatus.OK)
  async read(@Body() body: { eventId: string }): Promise<{
    eventId: string;
    externalEventId: string;
    tenantId: string;
    connectionId: string;
    providerCode: string;
    providerEntityType: string;
    providerEntityId: string;
    eventType: string;
    eventTimestamp: string;
    rawPayload: Record<string, unknown> | null;
    processingLogId: string | null;
  }> {
    const logPrefix = 'WebhookEventReadController.read';
    if (!body?.eventId) {
      throw new BadRequestException(
        `${logPrefix} — missing required field: eventId`,
      );
    }

    this.logger.log(`${logPrefix} — eventId=${body.eventId}`);

    const row = await this.webhookRepo.findById({ id: body.eventId });
    if (!row) {
      throw new NotFoundException(
        `${logPrefix} — event not found: ${body.eventId}`,
      );
    }

    const providerEntityType =
      row.providerEntityType ?? resolveEntityType(row.eventType);
    if (!providerEntityType) {
      throw new BadRequestException(
        `${logPrefix} — EVENT_UNSUPPORTED_TYPE eventId=${body.eventId} eventType=${row.eventType}`,
      );
    }

    if (!row.connectionId || !row.tenantId || !row.payloadEntityId) {
      throw new BadRequestException(
        `${logPrefix} — EVENT_UNRESOLVED eventId=${body.eventId} connectionId=${row.connectionId ?? 'null'} tenantId=${row.tenantId ?? 'null'} providerEntityId=${row.payloadEntityId ?? 'null'}`,
      );
    }

    const existingLog = await this.processingLogRepo.findByEventId({
      eventId: row.id,
    });

    return {
      eventId: row.id,
      externalEventId: row.externalEventId,
      tenantId: row.tenantId,
      connectionId: row.connectionId,
      providerCode: row.providerCode ?? 'crunchwork',
      providerEntityType,
      providerEntityId: row.payloadEntityId,
      eventType: row.eventType,
      eventTimestamp: row.eventTimestamp.toISOString(),
      rawPayload: (row.rawBodyJson as Record<string, unknown> | null) ?? null,
      processingLogId: existingLog?.id ?? null,
    };
  }
}
