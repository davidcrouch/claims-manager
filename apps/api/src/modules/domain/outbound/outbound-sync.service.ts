import { Injectable, Logger, Inject } from '@nestjs/common';
import { eq, and } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB, type DrizzleDbOrTx } from '../../../database/drizzle.module';
import { outboundSyncQueue, integrationConnections } from '../../../database/schema';

@Injectable()
export class OutboundSyncService {
  private readonly logger = new Logger('OutboundSyncService');

  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async enqueue(params: {
    tenantId: string;
    connectionId: string;
    entityType: string;
    entityId: string;
    action: string;
    payload: Record<string, unknown>;
    sourceEvent?: string;
    idempotencyKey?: string;
    priority?: number;
    scheduledAt?: Date;
    tx: DrizzleDbOrTx;
  }): Promise<string> {
    const [row] = await params.tx
      .insert(outboundSyncQueue)
      .values({
        tenantId: params.tenantId,
        connectionId: params.connectionId,
        entityType: params.entityType,
        entityId: params.entityId,
        action: params.action,
        payload: params.payload,
        sourceEvent: params.sourceEvent,
        idempotencyKey: params.idempotencyKey,
        priority: params.priority ?? 0,
        scheduledAt: params.scheduledAt ?? new Date(),
        status: 'pending',
      })
      .onConflictDoNothing()
      .returning({ id: outboundSyncQueue.id });

    if (row) {
      this.logger.debug(
        `OutboundSyncService.enqueue — queued ${params.entityType}:${params.entityId} action=${params.action} id=${row.id}`,
      );
    }
    return row?.id ?? '';
  }

  async enqueueIfConnected(params: {
    tenantId: string;
    entityType: string;
    entityId: string;
    action: string;
    payload: Record<string, unknown>;
    sourceEvent?: string;
    tx: DrizzleDbOrTx;
  }): Promise<string | null> {
    const [connection] = await params.tx
      .select({ id: integrationConnections.id })
      .from(integrationConnections)
      .where(
        and(
          eq(integrationConnections.tenantId, params.tenantId),
          eq(integrationConnections.isActive, true),
        ),
      )
      .limit(1);

    if (!connection) return null;

    return this.enqueue({
      ...params,
      connectionId: connection.id,
    });
  }

  async cancelPending(params: {
    tenantId: string;
    entityType: string;
    entityId: string;
    tx?: DrizzleDbOrTx;
  }): Promise<number> {
    const db = params.tx ?? this.db;
    const result = await db
      .update(outboundSyncQueue)
      .set({ status: 'cancelled' })
      .where(
        and(
          eq(outboundSyncQueue.tenantId, params.tenantId),
          eq(outboundSyncQueue.entityType, params.entityType),
          eq(outboundSyncQueue.entityId, params.entityId),
          eq(outboundSyncQueue.status, 'pending'),
        ),
      )
      .returning({ id: outboundSyncQueue.id });

    return result.length;
  }
}
