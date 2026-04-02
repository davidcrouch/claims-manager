import { Injectable, Inject } from '@nestjs/common';
import { eq, and, desc, sql } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB, type DrizzleDbOrTx } from '../drizzle.module';
import { externalObjects } from '../schema';

export type ExternalObjectRow = typeof externalObjects.$inferSelect;
export type ExternalObjectInsert = typeof externalObjects.$inferInsert;

@Injectable()
export class ExternalObjectsRepository {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async findById(params: { id: string }): Promise<ExternalObjectRow | null> {
    const [row] = await this.db
      .select()
      .from(externalObjects)
      .where(eq(externalObjects.id, params.id))
      .limit(1);
    return row ?? null;
  }

  async findByProviderEntity(params: {
    connectionId: string;
    providerEntityType: string;
    providerEntityId: string;
    tx?: DrizzleDbOrTx;
  }): Promise<ExternalObjectRow | null> {
    const db = params.tx ?? this.db;
    const [row] = await db
      .select()
      .from(externalObjects)
      .where(
        and(
          eq(externalObjects.connectionId, params.connectionId),
          eq(externalObjects.providerEntityType, params.providerEntityType),
          eq(externalObjects.providerEntityId, params.providerEntityId),
        ),
      )
      .limit(1);
    return row ?? null;
  }

  async upsert(params: {
    data: ExternalObjectInsert;
    tx?: DrizzleDbOrTx;
  }): Promise<{ row: ExternalObjectRow; wasInserted: boolean }> {
    const db = params.tx ?? this.db;
    const now = new Date();

    const [row] = await db
      .insert(externalObjects)
      .values({
        ...params.data,
        lastFetchedAt: params.data.lastFetchedAt ?? now,
        fetchStatus: params.data.fetchStatus ?? 'fetched',
      })
      .onConflictDoUpdate({
        target: [
          externalObjects.connectionId,
          externalObjects.providerEntityType,
          externalObjects.providerEntityId,
        ],
        set: {
          latestPayload: sql`excluded.latest_payload`,
          payloadHash: sql`excluded.payload_hash`,
          fetchStatus: sql`excluded.fetch_status`,
          lastFetchedAt: sql`excluded.last_fetched_at`,
          lastFetchEventId: sql`excluded.last_fetch_event_id`,
          metadata: sql`excluded.metadata`,
          updatedAt: now,
        },
      })
      .returning();

    const wasInserted = row!.createdAt.getTime() === row!.updatedAt.getTime();
    return { row: row!, wasInserted };
  }

  async findByTenantAndType(params: {
    tenantId: string;
    normalizedEntityType: string;
    page?: number;
    limit?: number;
  }): Promise<{ data: ExternalObjectRow[]; total: number }> {
    const page = params.page ?? 1;
    const limit = Math.min(params.limit ?? 20, 100);
    const skip = (page - 1) * limit;

    const whereClause = and(
      eq(externalObjects.tenantId, params.tenantId),
      eq(externalObjects.normalizedEntityType, params.normalizedEntityType),
    );

    const [data, countResult] = await Promise.all([
      this.db
        .select()
        .from(externalObjects)
        .where(whereClause)
        .orderBy(desc(externalObjects.updatedAt))
        .limit(limit)
        .offset(skip),
      this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(externalObjects)
        .where(whereClause),
    ]);

    return { data, total: countResult[0]?.count ?? 0 };
  }
}
