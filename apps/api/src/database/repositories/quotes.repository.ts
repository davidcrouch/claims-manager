import { Injectable } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { eq, and, isNull, desc, sql } from 'drizzle-orm';
import { DRIZZLE } from '../drizzle.module';
import type { DrizzleDB } from '../drizzle.module';
import { quotes } from '../schema';

export type QuoteRow = typeof quotes.$inferSelect;
export type QuoteInsert = typeof quotes.$inferInsert;

@Injectable()
export class QuotesRepository {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async findAll(params: {
    tenantId: string;
    page?: number;
    limit?: number;
    jobId?: string;
    statusId?: string;
  }): Promise<{ data: QuoteRow[]; total: number }> {
    const page = params.page ?? 1;
    const limit = Math.min(params.limit ?? 20, 100);
    const skip = (page - 1) * limit;

    let whereClause = and(
      eq(quotes.tenantId, params.tenantId),
      isNull(quotes.deletedAt),
    );
    if (params.jobId) {
      whereClause = and(whereClause, eq(quotes.jobId, params.jobId));
    }
    if (params.statusId) {
      whereClause = and(whereClause, eq(quotes.statusLookupId, params.statusId));
    }

    const [data, countResult] = await Promise.all([
      this.db
        .select()
        .from(quotes)
        .where(whereClause)
        .orderBy(desc(quotes.updatedAt))
        .limit(limit)
        .offset(skip),
      this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(quotes)
        .where(whereClause),
    ]);

    const total = countResult[0]?.count ?? 0;
    return { data, total };
  }

  async findOne(params: { id: string; tenantId: string }): Promise<QuoteRow | null> {
    const [row] = await this.db
      .select()
      .from(quotes)
      .where(and(eq(quotes.id, params.id), eq(quotes.tenantId, params.tenantId)))
      .limit(1);
    return row ?? null;
  }

  async findByJob(params: { jobId: string; tenantId: string }): Promise<QuoteRow[]> {
    return this.db
      .select()
      .from(quotes)
      .where(and(eq(quotes.jobId, params.jobId), eq(quotes.tenantId, params.tenantId)))
      .orderBy(desc(quotes.updatedAt));
  }

  async create(params: { data: QuoteInsert }): Promise<QuoteRow> {
    const [inserted] = await this.db.insert(quotes).values(params.data).returning();
    return inserted!;
  }

  async update(params: {
    id: string;
    data: Partial<QuoteInsert>;
  }): Promise<QuoteRow | null> {
    const [updated] = await this.db
      .update(quotes)
      .set({ ...params.data, updatedAt: new Date() })
      .where(eq(quotes.id, params.id))
      .returning();
    return updated ?? null;
  }

  async countByTenant(params: { tenantId: string }): Promise<number> {
    const [r] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(quotes)
      .where(eq(quotes.tenantId, params.tenantId));
    return r?.count ?? 0;
  }
}
