import { Injectable, Inject } from '@nestjs/common';
import { eq, and, desc, isNull, sql, inArray, or, ilike, ne } from 'drizzle-orm';
import { normalizeListJobIds } from '../../common/list-job-filter';
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
    search?: string;
    jobId?: string;
    jobIds?: string[];
  }): Promise<{ data: Array<JournalRow & { jobId: string | null; pageCount: number }>; total: number }> {
    const page = params.page ?? 1;
    const limit = Math.min(params.limit ?? 20, 100);
    const skip = (page - 1) * limit;

    let whereClause = and(
      eq(journals.tenantId, params.tenantId),
      isNull(journals.deletedAt),
      ne(journals.status, 'deleted'),
    );
    const statuses = params.status?.split(',').map((value) => value.trim()).filter(Boolean) ?? [];
    if (statuses.length > 0) {
      whereClause = and(whereClause, inArray(journals.status, statuses));
    }
    if (params.search?.trim()) {
      const term = `%${params.search.trim()}%`;
      whereClause = and(
        whereClause,
        or(
          ilike(journals.name, term),
          ilike(journals.description, term),
          ilike(journals.addressSuburb, term),
        )!,
      );
    }

    const jobIds = normalizeListJobIds({ jobId: params.jobId, jobIds: params.jobIds });
    if (jobIds) {
      if (jobIds.length === 0) {
        return { data: [], total: 0 };
      }
      const linkWhere =
        jobIds.length === 1
          ? and(
              eq(journalEntityLinks.tenantId, params.tenantId),
              eq(journalEntityLinks.entityType, 'Job'),
              eq(journalEntityLinks.entityId, jobIds[0]),
            )
          : and(
              eq(journalEntityLinks.tenantId, params.tenantId),
              eq(journalEntityLinks.entityType, 'Job'),
              inArray(journalEntityLinks.entityId, jobIds),
            );
      const linked = await this.db
        .select({ journalId: journalEntityLinks.journalId })
        .from(journalEntityLinks)
        .where(linkWhere);
      const journalIds = linked.map((row) => row.journalId);
      if (journalIds.length === 0) {
        return { data: [], total: 0 };
      }
      whereClause = and(whereClause, inArray(journals.id, journalIds));
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

    if (data.length === 0) {
      return { data: [], total };
    }

    const journalIds = data.map((row) => row.id);
    const [jobLinks, pageCounts] = await Promise.all([
      this.db
        .select({
          journalId: journalEntityLinks.journalId,
          entityId: journalEntityLinks.entityId,
        })
        .from(journalEntityLinks)
        .where(
          and(
            eq(journalEntityLinks.tenantId, params.tenantId),
            eq(journalEntityLinks.entityType, 'Job'),
            inArray(journalEntityLinks.journalId, journalIds),
          ),
        ),
      this.getPageCounts({ tenantId: params.tenantId, journalIds }),
    ]);

    const jobIdByJournal = new Map<string, string>();
    for (const link of jobLinks) {
      if (!jobIdByJournal.has(link.journalId)) {
        jobIdByJournal.set(link.journalId, link.entityId);
      }
    }

    return {
      data: data.map((row) => ({
        ...row,
        jobId: jobIdByJournal.get(row.id) ?? null,
        pageCount: pageCounts.get(row.id) ?? 0,
      })),
      total,
    };
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
    search?: string;
    status?: string;
  }): Promise<Array<JournalRow & { pageCount: number }>> {
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
    let whereClause = and(
      eq(journals.tenantId, params.tenantId),
      inArray(journals.id, journalIds),
      isNull(journals.deletedAt),
      ne(journals.status, 'deleted'),
    );
    const statuses = params.status?.split(',').map((value) => value.trim()).filter(Boolean) ?? [];
    if (statuses.length > 0) {
      whereClause = and(whereClause, inArray(journals.status, statuses));
    }
    if (params.search?.trim()) {
      const term = `%${params.search.trim()}%`;
      whereClause = and(
        whereClause,
        or(
          ilike(journals.name, term),
          ilike(journals.description, term),
          ilike(journals.addressSuburb, term),
        )!,
      );
    }

    const [rows, pageCounts] = await Promise.all([
      this.db
        .select()
        .from(journals)
        .where(whereClause)
        .orderBy(desc(journals.updatedAt)),
      this.getPageCounts({ tenantId: params.tenantId, journalIds }),
    ]);

    return rows.map((row) => ({
      ...row,
      pageCount: pageCounts.get(row.id) ?? 0,
    }));
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

  async getPageCounts(params: {
    tenantId: string;
    journalIds: string[];
  }): Promise<Map<string, number>> {
    if (params.journalIds.length === 0) return new Map();

    const rows = await this.db
      .select({
        journalId: journalPages.journalId,
        count: sql<number>`count(*)::int`,
      })
      .from(journalPages)
      .where(
        and(
          eq(journalPages.tenantId, params.tenantId),
          inArray(journalPages.journalId, params.journalIds),
          isNull(journalPages.deletedAt),
        ),
      )
      .groupBy(journalPages.journalId);

    const counts = new Map<string, number>();
    for (const row of rows) {
      counts.set(row.journalId, row.count);
    }
    return counts;
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
