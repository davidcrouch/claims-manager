import { Injectable, Logger, OnModuleInit, OnModuleDestroy, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { and, eq, lt, isNull, isNotNull } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB } from '../../database/drizzle.module';
import { inboundWebhookEvents } from '../../database/schema';
import { ConnectionResolverService } from '../external/connection-resolver.service';
import { WebhooksService } from './webhooks.service';

/**
 * Polls for stuck webhook events and re-attempts processing.
 *
 * Two passes per sweep cycle:
 * 1. Resolution pass — events with connection_id IS NULL that can now be
 *    resolved (e.g. because a connection_identifiers row was added). Stamps
 *    the connection and proceeds to processing.
 * 2. Reprocess pass — events with connection_id set but still at 'pending'
 *    status (crashed between persist and processEventAsync). Re-invokes
 *    processEventAsync.
 *
 * Uses FOR UPDATE SKIP LOCKED to prevent double-processing across instances.
 */
@Injectable()
export class WebhookSweepService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger('WebhookSweepService');
  private sweepInterval: ReturnType<typeof setInterval> | null = null;
  private sweeping = false;

  constructor(
    private readonly configService: ConfigService,
    private readonly connectionResolver: ConnectionResolverService,
    private readonly webhooksService: WebhooksService,
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
  ) {}

  onModuleInit(): void {
    const enabled = this.configService.get<boolean>('webhook.sweepEnabled', true);
    if (!enabled) {
      this.logger.log('WebhookSweepService — disabled via webhook.sweepEnabled=false');
      return;
    }

    const intervalMs = this.configService.get<number>('webhook.sweepIntervalMs', 30_000);
    this.sweepInterval = setInterval(() => void this.sweep(), intervalMs);
    this.logger.log(`WebhookSweepService — started polling every ${intervalMs}ms`);
  }

  onModuleDestroy(): void {
    if (this.sweepInterval) {
      clearInterval(this.sweepInterval);
      this.sweepInterval = null;
    }
  }

  async sweep(): Promise<{ resolved: number; reprocessed: number; failed: number }> {
    if (this.sweeping) return { resolved: 0, reprocessed: 0, failed: 0 };
    this.sweeping = true;

    let resolved = 0;
    let reprocessed = 0;
    let failed = 0;

    try {
      const staleThreshold = new Date(Date.now() - 30_000);

      // Pass 1: Resolve unresolved events (connection_id IS NULL)
      const unresolvedEvents = await this.db
        .select()
        .from(inboundWebhookEvents)
        .where(
          and(
            eq(inboundWebhookEvents.processingStatus, 'pending'),
            isNull(inboundWebhookEvents.connectionId),
            isNotNull(inboundWebhookEvents.payloadTenantId),
            isNotNull(inboundWebhookEvents.payloadClient),
            lt(inboundWebhookEvents.createdAt, staleThreshold),
          ),
        )
        .limit(10)
        .for('update', { skipLocked: true });

      for (const event of unresolvedEvents) {
        try {
          const connection = await this.connectionResolver.resolveForWebhook({
            payloadTenantId: event.payloadTenantId!,
            payloadClient: event.payloadClient!,
          });

          if (!connection) continue;

          await this.db
            .update(inboundWebhookEvents)
            .set({
              connectionId: connection.id,
              tenantId: connection.tenantId,
              hmacVerified: true,
            })
            .where(eq(inboundWebhookEvents.id, event.id));

          resolved++;

          await this.webhooksService.processEventAsync({
            eventId: event.id,
            tenantId: connection.tenantId,
            connectionId: connection.id,
            providerCode: connection.providerCode,
            eventType: event.eventType,
            providerEntityId: event.payloadEntityId ?? '',
            eventTimestamp: event.eventTimestamp ?? undefined,
          });

          reprocessed++;
        } catch (err) {
          failed++;
          this.logger.error(
            `WebhookSweepService.sweep — failed resolving/processing eventId=${event.id}: ${(err as Error).message}`,
          );
        }
      }

      // Pass 2: Reprocess events that have connection but are still pending
      const stuckEvents = await this.db
        .select()
        .from(inboundWebhookEvents)
        .where(
          and(
            eq(inboundWebhookEvents.processingStatus, 'pending'),
            isNotNull(inboundWebhookEvents.connectionId),
            lt(inboundWebhookEvents.createdAt, staleThreshold),
          ),
        )
        .limit(10)
        .for('update', { skipLocked: true });

      for (const event of stuckEvents) {
        try {
          await this.webhooksService.processEventAsync({
            eventId: event.id,
            tenantId: event.tenantId!,
            connectionId: event.connectionId!,
            providerCode: event.providerCode ?? 'crunchwork',
            eventType: event.eventType,
            providerEntityId: event.payloadEntityId ?? '',
            eventTimestamp: event.eventTimestamp ?? undefined,
          });
          reprocessed++;
        } catch (err) {
          failed++;
          this.logger.error(
            `WebhookSweepService.sweep — failed reprocessing eventId=${event.id}: ${(err as Error).message}`,
          );
        }
      }

      if (resolved > 0 || reprocessed > 0 || failed > 0) {
        this.logger.log(
          `WebhookSweepService.sweep — resolved=${resolved} reprocessed=${reprocessed} failed=${failed}`,
        );
      }
    } finally {
      this.sweeping = false;
    }

    return { resolved, reprocessed, failed };
  }
}
