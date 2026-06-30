import { Injectable, Logger, OnModuleInit, OnModuleDestroy, Inject } from '@nestjs/common';
import { eq, and, lte, sql, inArray } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB } from '../../../database/drizzle.module';
import { outboundSyncQueue, integrationConnections, jobs } from '../../../database/schema';
import type { OutboundAdapter, OutboundPushResult } from './outbound-adapter.interface';

interface OutboundQueueRow {
  id: string;
  tenantId: string;
  connectionId: string;
  entityType: string;
  entityId: string;
  action: string;
  payload: Record<string, unknown>;
  status: string;
  attempts: number;
  maxAttempts: number;
}

@Injectable()
export class OutboundWorkerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger('OutboundWorker');
  private polling = false;
  private pollInterval: ReturnType<typeof setInterval> | null = null;
  private adapters: Map<string, OutboundAdapter> = new Map();

  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  registerAdapter(providerCode: string, adapter: OutboundAdapter): void {
    this.adapters.set(providerCode, adapter);
    this.logger.debug(`OutboundWorker.registerAdapter — ${providerCode}`);
  }

  onModuleInit(): void {
    const enabled = process.env.OUTBOUND_ENABLED !== 'false';
    if (!enabled) {
      this.logger.log('OutboundWorker — disabled via OUTBOUND_ENABLED=false');
      return;
    }

    const intervalMs = parseInt(process.env.OUTBOUND_POLL_INTERVAL_MS ?? '5000', 10);
    this.polling = true;
    this.pollInterval = setInterval(() => this.poll(), intervalMs);
    this.logger.log(`OutboundWorker — started polling every ${intervalMs}ms`);
  }

  onModuleDestroy(): void {
    this.polling = false;
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }

  private async poll(): Promise<void> {
    if (!this.polling) return;

    try {
      const batchSize = parseInt(process.env.OUTBOUND_BATCH_SIZE ?? '10', 10);
      const batch = await this.claimBatch(batchSize);
      if (batch.length === 0) return;

      for (const record of batch) {
        await this.processRecord(record);
      }
    } catch (err) {
      this.logger.error(`OutboundWorker.poll — unexpected error: ${err}`);
    }
  }

  private async claimBatch(limit: number): Promise<OutboundQueueRow[]> {
    const now = new Date();
    return this.db.transaction(async (tx) => {
      const rows = await tx
        .select({
          id: outboundSyncQueue.id,
          tenantId: outboundSyncQueue.tenantId,
          connectionId: outboundSyncQueue.connectionId,
          entityType: outboundSyncQueue.entityType,
          entityId: outboundSyncQueue.entityId,
          action: outboundSyncQueue.action,
          payload: outboundSyncQueue.payload,
          status: outboundSyncQueue.status,
          attempts: outboundSyncQueue.attempts,
          maxAttempts: outboundSyncQueue.maxAttempts,
        })
        .from(outboundSyncQueue)
        .where(
          and(
            eq(outboundSyncQueue.status, 'pending'),
            lte(outboundSyncQueue.scheduledAt, now),
            sql`${outboundSyncQueue.attempts} < ${outboundSyncQueue.maxAttempts}`,
          ),
        )
        .orderBy(
          sql`${outboundSyncQueue.priority} DESC`,
          outboundSyncQueue.scheduledAt,
        )
        .limit(limit)
        .for('update', { skipLocked: true });

      if (rows.length === 0) return [];

      const ids = rows.map((r) => r.id);
      await tx
        .update(outboundSyncQueue)
        .set({
          status: 'processing',
          lastAttemptedAt: now,
          attempts: sql`${outboundSyncQueue.attempts} + 1`,
        })
        .where(inArray(outboundSyncQueue.id, ids));

      return rows as OutboundQueueRow[];
    });
  }

  private async processRecord(record: OutboundQueueRow): Promise<void> {
    const logPrefix = `OutboundWorker.process[${record.id}]`;

    const [connection] = await this.db
      .select({
        id: integrationConnections.id,
        providerCode: integrationConnections.providerCode,
      })
      .from(integrationConnections)
      .where(eq(integrationConnections.id, record.connectionId))
      .limit(1);

    if (!connection) {
      this.logger.error(`${logPrefix} — connection ${record.connectionId} not found`);
      await this.markFailed(record.id, record.entityType, record.entityId, 'Connection not found');
      return;
    }

    const adapter = this.adapters.get(connection.providerCode);
    if (!adapter) {
      this.logger.error(`${logPrefix} — no adapter for provider '${connection.providerCode}'`);
      await this.markFailed(record.id, record.entityType, record.entityId, `No adapter for ${connection.providerCode}`);
      return;
    }

    try {
      const result = await adapter.push({
        connectionId: record.connectionId,
        entityType: record.entityType,
        entityId: record.entityId,
        action: record.action,
        payload: record.payload,
      });

      await this.markSent(record.id);
      await this.patchEntity(record, result);
      this.logger.log(`${logPrefix} — sent ${record.entityType}:${record.entityId} action=${record.action}`);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`${logPrefix} — failed: ${errorMsg}`);

      if (record.attempts + 1 >= record.maxAttempts) {
        await this.markFailed(record.id, record.entityType, record.entityId, errorMsg);
      } else {
        const backoffMs = Math.min(1000 * Math.pow(2, record.attempts), 300_000);
        await this.scheduleRetry(record.id, backoffMs, errorMsg);
      }
    }
  }

  private async patchEntity(record: OutboundQueueRow, result: OutboundPushResult): Promise<void> {
    if (record.entityType === 'job') {
      const patchData: Record<string, unknown> = {
        syncStatus: 'synced',
        updatedAt: new Date(),
      };
      if (result.externalReference) {
        patchData.externalReference = result.externalReference;
      }
      if (result.responsePayload) {
        patchData.apiPayload = result.responsePayload;
      }
      await this.db
        .update(jobs)
        .set(patchData)
        .where(eq(jobs.id, record.entityId));
    }
  }

  private async markSent(id: string): Promise<void> {
    await this.db
      .update(outboundSyncQueue)
      .set({ status: 'sent', processedAt: new Date() })
      .where(eq(outboundSyncQueue.id, id));
  }

  private async markFailed(id: string, entityType: string, entityId: string, error: string): Promise<void> {
    await this.db
      .update(outboundSyncQueue)
      .set({ status: 'failed', lastError: error })
      .where(eq(outboundSyncQueue.id, id));

    if (entityType === 'job') {
      await this.db
        .update(jobs)
        .set({ syncStatus: 'failed', updatedAt: new Date() })
        .where(eq(jobs.id, entityId));
    }
  }

  private async scheduleRetry(id: string, backoffMs: number, error: string): Promise<void> {
    const nextAttempt = new Date(Date.now() + backoffMs);
    await this.db
      .update(outboundSyncQueue)
      .set({
        status: 'pending',
        scheduledAt: nextAttempt,
        lastError: error,
      })
      .where(eq(outboundSyncQueue.id, id));
  }
}
