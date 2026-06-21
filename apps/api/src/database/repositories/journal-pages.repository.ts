import { Injectable, Inject } from '@nestjs/common';
import { eq, and, desc, asc, isNull, sql } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB } from '../drizzle.module';
import { journalPages } from '../schema';

export type JournalPageRow = typeof journalPages.$inferSelect;
export type JournalPageInsert = typeof journalPages.$inferInsert;

@Injectable()
export class JournalPagesRepository {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async findByJournal(params: {
    tenantId: string;
    journalId: string;
    limit?: number;
    offset?: number;
  }): Promise<{ data: JournalPageRow[]; total: number }> {
    const limit = Math.min(params.limit ?? 20, 100);
    const offset = params.offset ?? 0;

    const whereClause = and(
      eq(journalPages.tenantId, params.tenantId),
      eq(journalPages.journalId, params.journalId),
      isNull(journalPages.deletedAt),
    );

    const [data, countResult] = await Promise.all([
      this.db
        .select()
        .from(journalPages)
        .where(whereClause)
        .orderBy(asc(journalPages.sortIndex), desc(journalPages.capturedAt))
        .limit(limit)
        .offset(offset),
      this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(journalPages)
        .where(whereClause),
    ]);

    const total = countResult[0]?.count ?? 0;
    return { data, total };
  }

  async findOne(params: { id: string; tenantId: string }): Promise<JournalPageRow | null> {
    const [row] = await this.db
      .select()
      .from(journalPages)
      .where(
        and(
          eq(journalPages.id, params.id),
          eq(journalPages.tenantId, params.tenantId),
          isNull(journalPages.deletedAt),
        ),
      )
      .limit(1);
    return row ?? null;
  }

  async create(params: { data: JournalPageInsert }): Promise<JournalPageRow> {
    const [inserted] = await this.db
      .insert(journalPages)
      .values(params.data)
      .returning();
    return inserted;
  }

  async update(params: { id: string; tenantId: string; data: Partial<JournalPageInsert> }): Promise<JournalPageRow | null> {
    const [updated] = await this.db
      .update(journalPages)
      .set({ ...params.data, updatedAt: new Date() })
      .where(and(eq(journalPages.id, params.id), eq(journalPages.tenantId, params.tenantId)))
      .returning();
    return updated ?? null;
  }

  async softDelete(params: { id: string; tenantId: string }): Promise<void> {
    await this.db
      .update(journalPages)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(journalPages.id, params.id), eq(journalPages.tenantId, params.tenantId)));
  }

  async reorder(params: { journalId: string; tenantId: string; pageIds: string[] }): Promise<void> {
    await this.db.transaction(async (tx) => {
      for (let i = 0; i < params.pageIds.length; i++) {
        await tx
          .update(journalPages)
          .set({ sortIndex: i, updatedAt: new Date() })
          .where(
            and(
              eq(journalPages.id, params.pageIds[i]),
              eq(journalPages.tenantId, params.tenantId),
            ),
          );
      }
    });
  }

  async getNextSortIndex(params: { journalId: string; tenantId: string }): Promise<number> {
    const [result] = await this.db
      .select({ max: sql<number>`coalesce(max(sort_index), -1)::int` })
      .from(journalPages)
      .where(
        and(
          eq(journalPages.journalId, params.journalId),
          eq(journalPages.tenantId, params.tenantId),
        ),
      );
    return (result?.max ?? -1) + 1;
  }
}
