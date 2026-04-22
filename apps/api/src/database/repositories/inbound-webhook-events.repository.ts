import { Injectable } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { eq, or, and, desc, count as drizzleCount, max, inArray } from 'drizzle-orm';
import { DRIZZLE } from '../drizzle.module';
import type { DrizzleDB, DrizzleDbOrTx } from '../drizzle.module';
import { inboundWebhookEvents, integrationConnections } from '../schema';

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

  async findById(params: {
    id: string;
  }): Promise<InboundWebhookEventRow | null> {
    const [row] = await this.db
      .select()
      .from(inboundWebhookEvents)
      .where(eq(inboundWebhookEvents.id, params.id))
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

  /**
   * Build a WHERE condition matching events belonging to a provider+tenant.
   * Matches events where:
   *  - provider_code is set directly, OR
   *  - connection_id belongs to one of the provider's connections (tenant-scoped)
   */
  private providerTenantCondition(providerCode: string, tenantId: string) {
    const connectionIds = this.db
      .select({ id: integrationConnections.id })
      .from(integrationConnections)
      .where(
        and(
          eq(integrationConnections.providerCode, providerCode),
          eq(integrationConnections.tenantId, tenantId),
        ),
      );

    return or(
      eq(inboundWebhookEvents.providerCode, providerCode),
      inArray(inboundWebhookEvents.connectionId, connectionIds),
    )!;
  }

  async findByProviderCode(params: {
    providerCode: string;
    tenantId: string;
    status?: string;
    page?: number;
    limit?: number;
  }): Promise<{ data: InboundWebhookEventRow[]; total: number }> {
    const limit = params.limit ?? 20;
    const offset = ((params.page ?? 1) - 1) * limit;

    const ownership = this.providerTenantCondition(params.providerCode, params.tenantId);
    const whereClause = params.status
      ? and(ownership, eq(inboundWebhookEvents.processingStatus, params.status))!
      : ownership;

    const [data, countResult] = await Promise.all([
      this.db
        .select()
        .from(inboundWebhookEvents)
        .where(whereClause)
        .orderBy(desc(inboundWebhookEvents.createdAt))
        .limit(limit)
        .offset(offset),
      this.db
        .select({ count: drizzleCount() })
        .from(inboundWebhookEvents)
        .where(whereClause),
    ]);

    return { data, total: countResult[0]?.count ?? 0 };
  }

  async findByConnectionId(params: {
    connectionId: string;
    tenantId: string;
    status?: string;
    page?: number;
    limit?: number;
  }): Promise<{ data: InboundWebhookEventRow[]; total: number }> {
    const limit = params.limit ?? 20;
    const offset = ((params.page ?? 1) - 1) * limit;

    const ownership = and(
      eq(inboundWebhookEvents.connectionId, params.connectionId),
      or(
        eq(inboundWebhookEvents.tenantId, params.tenantId),
        eq(inboundWebhookEvents.payloadTenantId, params.tenantId),
      )!,
    )!;
    const whereClause = params.status
      ? and(ownership, eq(inboundWebhookEvents.processingStatus, params.status))!
      : ownership;

    const [data, countResult] = await Promise.all([
      this.db
        .select()
        .from(inboundWebhookEvents)
        .where(whereClause)
        .orderBy(desc(inboundWebhookEvents.createdAt))
        .limit(limit)
        .offset(offset),
      this.db
        .select({ count: drizzleCount() })
        .from(inboundWebhookEvents)
        .where(whereClause),
    ]);

    return { data, total: countResult[0]?.count ?? 0 };
  }

  async countByConnectionId(params: { connectionId: string; tenantId: string }): Promise<number> {
    const [result] = await this.db
      .select({ count: drizzleCount() })
      .from(inboundWebhookEvents)
      .where(
        and(
          eq(inboundWebhookEvents.connectionId, params.connectionId),
          or(
            eq(inboundWebhookEvents.tenantId, params.tenantId),
            eq(inboundWebhookEvents.payloadTenantId, params.tenantId),
          )!,
        ),
      );
    return result?.count ?? 0;
  }

  async countErrorsByConnectionId(params: { connectionId: string; tenantId: string }): Promise<number> {
    const [result] = await this.db
      .select({ count: drizzleCount() })
      .from(inboundWebhookEvents)
      .where(
        and(
          eq(inboundWebhookEvents.connectionId, params.connectionId),
          or(
            eq(inboundWebhookEvents.tenantId, params.tenantId),
            eq(inboundWebhookEvents.payloadTenantId, params.tenantId),
          )!,
          eq(inboundWebhookEvents.processingStatus, 'failed'),
        ),
      );
    return result?.count ?? 0;
  }

  async lastEventAtByConnectionId(params: { connectionId: string; tenantId: string }): Promise<Date | null> {
    const [result] = await this.db
      .select({ lastAt: max(inboundWebhookEvents.createdAt) })
      .from(inboundWebhookEvents)
      .where(
        and(
          eq(inboundWebhookEvents.connectionId, params.connectionId),
          or(
            eq(inboundWebhookEvents.tenantId, params.tenantId),
            eq(inboundWebhookEvents.payloadTenantId, params.tenantId),
          )!,
        ),
      );
    return result?.lastAt ?? null;
  }

  async countByProviderCode(params: { providerCode: string; tenantId: string }): Promise<number> {
    const [result] = await this.db
      .select({ count: drizzleCount() })
      .from(inboundWebhookEvents)
      .where(this.providerTenantCondition(params.providerCode, params.tenantId));
    return result?.count ?? 0;
  }

  async countErrorsByProviderCode(params: { providerCode: string; tenantId: string }): Promise<number> {
    const [result] = await this.db
      .select({ count: drizzleCount() })
      .from(inboundWebhookEvents)
      .where(
        and(
          this.providerTenantCondition(params.providerCode, params.tenantId),
          eq(inboundWebhookEvents.processingStatus, 'failed'),
        ),
      );
    return result?.count ?? 0;
  }

  async lastEventAtByProviderCode(params: { providerCode: string; tenantId: string }): Promise<Date | null> {
    const [result] = await this.db
      .select({ lastAt: max(inboundWebhookEvents.createdAt) })
      .from(inboundWebhookEvents)
      .where(this.providerTenantCondition(params.providerCode, params.tenantId));
    return result?.lastAt ?? null;
  }
}
