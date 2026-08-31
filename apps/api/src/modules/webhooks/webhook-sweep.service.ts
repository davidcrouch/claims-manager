import { Injectable, Logger, OnModuleInit, OnModuleDestroy, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { and, eq, lt, isNull, isNotNull, desc, sql, or } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB } from '../../database/drizzle.module';
import { inboundWebhookEvents } from '../../database/schema';
import { ConnectionResolverService } from '../external/connection-resolver.service';
import { WebhooksService } from './webhooks.service';

/**
 * Polls for stuck webhook events and re-attempts processing.
 *
 * Three passes per sweep cycle (run in priority order):
 * 1. Reprocess pass — events with connection_id set but still at 'pending'
 *    status (crashed between persist and processEventAsync). These are
 *    guaranteed processable so they run first.
 * 2. Resolution pass — events with connection_id IS NULL that can now be
 *    resolved (e.g. because a connection_identifiers row was added). Stamps
 *    the connection and proceeds to processing. Ordered newest-first so
 *    recently arrived events aren't starved by old unresolvable ones.
 *    Events that exceed `sweepMaxRetries` resolution attempts are excluded.
 * 3. Unmapped re-drive — events that reached 'completed_unmapped' (parent
 *    was missing at projection time) are re-driven through the full pipeline.
 *    When the parent has since landed, the projection succeeds on retry.
 *    Capped by `sweepMaxRetries` to park permanently unmappable events.
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
    this.sweepInterval = setInterval(() => {
      void this.sweep().catch((err: unknown) => {
        const message = err instanceof Error ? err.message : String(err);
        this.logger.error(`WebhookSweepService.sweep — unexpected error: ${message}`);
      });
    }, intervalMs);
    this.logger.log(`WebhookSweepService — started polling every ${intervalMs}ms`);
  }

  onModuleDestroy(): void {
    if (this.sweepInterval) {
      clearInterval(this.sweepInterval);
      this.sweepInterval = null;
    }
  }

  async sweep(): Promise<{ resolved: number; reprocessed: number; redriven: number; failed: number }> {
    if (this.sweeping) return { resolved: 0, reprocessed: 0, redriven: 0, failed: 0 };
    this.sweeping = true;

    let resolved = 0;
    let reprocessed = 0;
    let redriven = 0;
    let failed = 0;

    try {
      const staleThreshold = new Date(Date.now() - 30_000);
      const batchSize = this.configService.get<number>('webhook.sweepBatchSize', 10);
      const maxRetries = this.configService.get<number>('webhook.sweepMaxRetries', 10);

      // Pass 1: Reprocess events that have connection but are still pending
      // (or stuck in dispatch_failed after a More0/gateway outage). These are
      // guaranteed processable so they get priority.
      const stuckEvents = await this.db
        .select()
        .from(inboundWebhookEvents)
        .where(
          and(
            or(
              eq(inboundWebhookEvents.processingStatus, 'pending'),
              eq(inboundWebhookEvents.processingStatus, 'dispatch_failed'),
            ),
            isNotNull(inboundWebhookEvents.connectionId),
            lt(inboundWebhookEvents.createdAt, staleThreshold),
          ),
        )
        .limit(batchSize)
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

      // Pass 2: Resolve unresolved events (connection_id IS NULL).
      // Ordered newest-first so recent events aren't starved by old unresolvable ones.
      // Events with retry_count >= maxRetries are excluded (parked).
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
            lt(inboundWebhookEvents.retryCount, maxRetries),
          ),
        )
        .orderBy(desc(inboundWebhookEvents.createdAt))
        .limit(batchSize)
        .for('update', { skipLocked: true });

      for (const event of unresolvedEvents) {
        try {
          const connection = await this.connectionResolver.resolveForWebhook({
            payloadTenantId: event.payloadTenantId!,
            payloadClient: event.payloadClient!,
          });

          if (!connection) {
            const newRetryCount = event.retryCount + 1;
            await this.db
              .update(inboundWebhookEvents)
              .set({ retryCount: sql`retry_count + 1` })
              .where(eq(inboundWebhookEvents.id, event.id));

            if (newRetryCount >= maxRetries) {
              this.logger.warn(
                `WebhookSweepService.sweep — eventId=${event.id} exhausted resolution retries (${maxRetries}); parking`,
              );
            }
            continue;
          }

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

      // Pass 3: Re-drive completed_unmapped events whose parents may have
      // landed since the original attempt. Reset status to 'pending' and
      // reprocess so the full pipeline (fetch + projection) runs again.
      const unmappedEnabled = this.configService.get<boolean>('webhook.sweepUnmappedEnabled', true);
      if (unmappedEnabled) {
        const unmappedThresholdMs = this.configService.get<number>(
          'webhook.sweepUnmappedThresholdMs',
          60_000,
        );
        const unmappedThreshold = new Date(Date.now() - unmappedThresholdMs);

        const unmappedEvents = await this.db
          .select()
          .from(inboundWebhookEvents)
          .where(
            and(
              eq(inboundWebhookEvents.processingStatus, 'completed_unmapped'),
              isNotNull(inboundWebhookEvents.connectionId),
              lt(inboundWebhookEvents.createdAt, unmappedThreshold),
              lt(inboundWebhookEvents.retryCount, maxRetries),
            ),
          )
          .orderBy(desc(inboundWebhookEvents.createdAt))
          .limit(batchSize)
          .for('update', { skipLocked: true });

        for (const event of unmappedEvents) {
          try {
            await this.db
              .update(inboundWebhookEvents)
              .set({
                processingStatus: 'pending',
                retryCount: sql`retry_count + 1`,
              })
              .where(eq(inboundWebhookEvents.id, event.id));

            await this.webhooksService.processEventAsync({
              eventId: event.id,
              tenantId: event.tenantId!,
              connectionId: event.connectionId!,
              providerCode: event.providerCode ?? 'crunchwork',
              eventType: event.eventType,
              providerEntityId: event.payloadEntityId ?? '',
              eventTimestamp: event.eventTimestamp ?? undefined,
            });
            redriven++;
          } catch (err) {
            failed++;
            this.logger.error(
              `WebhookSweepService.sweep — failed re-driving unmapped eventId=${event.id}: ${(err as Error).message}`,
            );
          }
        }
      }

      if (resolved > 0 || reprocessed > 0 || redriven > 0 || failed > 0) {
        this.logger.log(
          `WebhookSweepService.sweep — resolved=${resolved} reprocessed=${reprocessed} redriven=${redriven} failed=${failed}`,
        );
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`WebhookSweepService.sweep — unexpected error: ${message}`);
    } finally {
      this.sweeping = false;
    }

    return { resolved, reprocessed, redriven, failed };
  }
}
