import { Injectable, Inject } from '@nestjs/common';
import { eq, and, desc, isNull, sql, inArray } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB } from '../drizzle.module';
import { journals, journalPages, journalEntityLinks } from '../schema';

export type JournalRow = typeof journals.$inferSelect;
export type JournalInsert = typeof journals.$inferInsert;
export type JournalEntityLinkRow = typeof journalEntityLinks.$inferSelect;
export type JournalEntityLinkInsert = typeof journalEntityLinks.$inferInsert;

@Injectable()
export class JournalsRepository {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async findAll(params: {
    tenantId: string;
    page?: number;
    limit?: number;
    status?: string;
  }): Promise<{ data: JournalRow[]; total: number }> {
    const page = params.page ?? 1;
    const limit = Math.min(params.limit ?? 20, 100);
    const skip = (page - 1) * limit;

    let whereClause = and(
      eq(journals.tenantId, params.tenantId),
      isNull(journals.deletedAt),
    );
    if (params.status) {
      whereClause = and(whereClause, eq(journals.status, params.status));
    }

    const [data, countResult] = await Promise.all([
      this.db
        .select()
        .from(journals)
        .where(whereClause)
        .orderBy(desc(journals.updatedAt))
        .limit(limit)
        .offset(skip),
      this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(journals)
        .where(whereClause),
    ]);

    const total = countResult[0]?.count ?? 0;
    return { data, total };
  }

  async findOne(params: { id: string; tenantId: string }): Promise<JournalRow | null> {
    const [row] = await this.db
      .select()
      .from(journals)
      .where(
        and(
          eq(journals.id, params.id),
          eq(journals.tenantId, params.tenantId),
          isNull(journals.deletedAt),
        ),
      )
      .limit(1);
    return row ?? null;
  }

  async findByEntity(params: {
    tenantId: string;
    entityType: string;
    entityId: string;
  }): Promise<JournalRow[]> {
    const links = await this.db
      .select({ journalId: journalEntityLinks.journalId })
      .from(journalEntityLinks)
      .where(
        and(
          eq(journalEntityLinks.tenantId, params.tenantId),
          eq(journalEntityLinks.entityType, params.entityType),
          eq(journalEntityLinks.entityId, params.entityId),
        ),
      );

    if (links.length === 0) return [];

    const journalIds = links.map((l) => l.journalId);
    return this.db
      .select()
      .from(journals)
      .where(
        and(
          eq(journals.tenantId, params.tenantId),
          inArray(journals.id, journalIds),
          isNull(journals.deletedAt),
        ),
      )
      .orderBy(desc(journals.updatedAt));
  }

  async create(params: { data: JournalInsert }): Promise<JournalRow> {
    const [inserted] = await this.db
      .insert(journals)
      .values(params.data)
      .returning();
    return inserted;
  }

  async update(params: { id: string; tenantId: string; data: Partial<JournalInsert> }): Promise<JournalRow | null> {
    const [updated] = await this.db
      .update(journals)
      .set({ ...params.data, updatedAt: new Date() })
      .where(and(eq(journals.id, params.id), eq(journals.tenantId, params.tenantId)))
      .returning();
    return updated ?? null;
  }

  async softDelete(params: { id: string; tenantId: string }): Promise<void> {
    await this.db
      .update(journals)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(journals.id, params.id), eq(journals.tenantId, params.tenantId)));
  }

  async getPageCount(params: { journalId: string; tenantId: string }): Promise<number> {
    const [result] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(journalPages)
      .where(
        and(
          eq(journalPages.journalId, params.journalId),
          eq(journalPages.tenantId, params.tenantId),
          isNull(journalPages.deletedAt),
        ),
      );
    return result?.count ?? 0;
  }

  // -- Entity links --

  async linkToEntity(params: { data: JournalEntityLinkInsert }): Promise<JournalEntityLinkRow | null> {
    const [inserted] = await this.db
      .insert(journalEntityLinks)
      .values(params.data)
      .onConflictDoNothing()
      .returning();
    return inserted ?? null;
  }

  async unlinkFromEntity(params: {
    tenantId: string;
    journalId: string;
    entityType: string;
    entityId: string;
  }): Promise<void> {
    await this.db
      .delete(journalEntityLinks)
      .where(
        and(
          eq(journalEntityLinks.tenantId, params.tenantId),
          eq(journalEntityLinks.journalId, params.journalId),
          eq(journalEntityLinks.entityType, params.entityType),
          eq(journalEntityLinks.entityId, params.entityId),
        ),
      );
  }

  async getEntityLinks(params: {
    tenantId: string;
    journalId: string;
  }): Promise<JournalEntityLinkRow[]> {
    return this.db
      .select()
      .from(journalEntityLinks)
      .where(
        and(
          eq(journalEntityLinks.tenantId, params.tenantId),
          eq(journalEntityLinks.journalId, params.journalId),
        ),
      );
  }
}
