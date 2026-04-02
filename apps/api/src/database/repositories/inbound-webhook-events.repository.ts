import { Injectable } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { eq, or, and, desc } from 'drizzle-orm';
import { DRIZZLE } from '../drizzle.module';
import type { DrizzleDB, DrizzleDbOrTx } from '../drizzle.module';
import { inboundWebhookEvents } from '../schema';

export type InboundWebhookEventRow = typeof inboundWebhookEvents.$inferSelect;
export type InboundWebhookEventInsert = typeof inboundWebhookEvents.$inferInsert;

@Injectable()
export class InboundWebhookEventsRepository {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async findByExternalEventId(params: {
    externalEventId: string;
  }): Promise<InboundWebhookEventRow | null> {
    const [row] = await this.db
      .select()
      .from(inboundWebhookEvents)
      .where(eq(inboundWebhookEvents.externalEventId, params.externalEventId))
      .limit(1);
    return row ?? null;
  }

  async create(params: { data: InboundWebhookEventInsert; tx?: DrizzleDbOrTx }): Promise<InboundWebhookEventRow> {
    const db = params.tx ?? this.db;
    const [inserted] = await db
      .insert(inboundWebhookEvents)
      .values(params.data)
      .returning();
    return inserted!;
  }

  async updateProcessingStatus(params: {
    id: string;
    processingStatus: string;
    processedAt?: Date;
    processingError?: string | null;
    tx?: DrizzleDbOrTx;
  }): Promise<InboundWebhookEventRow | null> {
    const db = params.tx ?? this.db;
    const setData: Record<string, unknown> = {
      processingStatus: params.processingStatus,
    };
    if (params.processedAt !== undefined) setData.processedAt = params.processedAt;
    if (params.processingError !== undefined) setData.processingError = params.processingError;

    const [updated] = await db
      .update(inboundWebhookEvents)
      .set(setData)
      .where(eq(inboundWebhookEvents.id, params.id))
      .returning();
    return updated ?? null;
  }

  async findRecentProcessed(params: {
    tenantId: string;
    limit?: number;
  }): Promise<InboundWebhookEventRow[]> {
    return this.db
      .select()
      .from(inboundWebhookEvents)
      .where(
        and(
          or(
            eq(inboundWebhookEvents.tenantId, params.tenantId),
            eq(inboundWebhookEvents.payloadTenantId, params.tenantId),
          )!,
          eq(inboundWebhookEvents.processingStatus, 'processed'),
        ),
      )
      .orderBy(desc(inboundWebhookEvents.createdAt))
      .limit(params.limit ?? 20);
  }
}
