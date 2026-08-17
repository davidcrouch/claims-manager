import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Logger,
  Post,
} from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { eq, inArray } from 'drizzle-orm';
import { RequirePermission } from '../../auth/decorators/require-permission.decorator';
import { P } from '../../auth/permission-constants';
import { DRIZZLE, type DrizzleDB } from '../../database/drizzle.module';
import { inboundWebhookEvents } from '../../database/schema';
import { ConnectionResolverService } from '../external/connection-resolver.service';
import { WebhooksService } from './webhooks.service';

interface ReprocessByIdsDto {
  eventIds: string[];
}

interface ReprocessByStatusDto {
  status: 'pending';
  limit?: number;
}

type ReprocessDto = ReprocessByIdsDto | ReprocessByStatusDto;

@Controller('api/v1/webhooks')
export class WebhookAdminController {
  private readonly logger = new Logger('WebhookAdminController');

  constructor(
    private readonly webhooksService: WebhooksService,
    private readonly connectionResolver: ConnectionResolverService,
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
  ) {}

  @Post('reprocess')
  @HttpCode(HttpStatus.OK)
  @RequirePermission(P.integrations.manage)
  async reprocess(@Body() body: ReprocessDto): Promise<{
    processed: number;
    failed: number;
    unresolvable: number;
  }> {
    const logPrefix = 'WebhookAdminController.reprocess';
    let events: (typeof inboundWebhookEvents.$inferSelect)[];

    if ('eventIds' in body && Array.isArray(body.eventIds)) {
      events = await this.db
        .select()
        .from(inboundWebhookEvents)
        .where(inArray(inboundWebhookEvents.id, body.eventIds));
    } else {
      const limit = (body as ReprocessByStatusDto).limit ?? 50;
      events = await this.db
        .select()
        .from(inboundWebhookEvents)
        .where(eq(inboundWebhookEvents.processingStatus, 'pending'))
        .limit(limit);
    }

    this.logger.log(`${logPrefix} — processing ${events.length} event(s)`);

    let processed = 0;
    let failed = 0;
    let unresolvable = 0;

    for (const event of events) {
      let connectionId = event.connectionId;
      let tenantId = event.tenantId;
      let providerCode = event.providerCode ?? 'crunchwork';

      if (!connectionId && event.payloadTenantId && event.payloadClient) {
        const connection = await this.connectionResolver.resolveForWebhook({
          payloadTenantId: event.payloadTenantId,
          payloadClient: event.payloadClient,
        });

        if (!connection) {
          unresolvable++;
          continue;
        }

        connectionId = connection.id;
        tenantId = connection.tenantId;
        providerCode = connection.providerCode;

        await this.db
          .update(inboundWebhookEvents)
          .set({
            connectionId: connection.id,
            tenantId: connection.tenantId,
            hmacVerified: true,
          })
          .where(eq(inboundWebhookEvents.id, event.id));
      }

      if (!connectionId || !tenantId) {
        unresolvable++;
        continue;
      }

      try {
        await this.webhooksService.processEventAsync({
          eventId: event.id,
          tenantId,
          connectionId,
          providerCode,
          eventType: event.eventType,
          providerEntityId: event.payloadEntityId ?? '',
          eventTimestamp: event.eventTimestamp ?? undefined,
        });
        processed++;
      } catch (err) {
        failed++;
        this.logger.error(
          `${logPrefix} — eventId=${event.id} failed: ${(err as Error).message}`,
        );
      }
    }

    this.logger.log(
      `${logPrefix} — done: processed=${processed} failed=${failed} unresolvable=${unresolvable}`,
    );

    return { processed, failed, unresolvable };
  }
}
