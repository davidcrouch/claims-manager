import { Injectable } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { eq, and, isNull, desc, sql, gte } from 'drizzle-orm';
import { DRIZZLE } from '../drizzle.module';
import type { DrizzleDB } from '../drizzle.module';
import { jobs, lookupValues } from '../schema';

export type JobRow = typeof jobs.$inferSelect;
export type JobInsert = typeof jobs.$inferInsert;

@Injectable()
export class JobsRepository {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async findAll(params: {
    tenantId: string;
    page?: number;
    limit?: number;
    claimId?: string;
  }): Promise<{ data: JobRow[]; total: number }> {
    const page = params.page ?? 1;
    const limit = Math.min(params.limit ?? 20, 100);
    const skip = (page - 1) * limit;

    const baseWhere = and(eq(jobs.tenantId, params.tenantId), isNull(jobs.deletedAt));
    const whereClause = params.claimId
      ? and(baseWhere, eq(jobs.claimId, params.claimId))
      : baseWhere;

    const [data, countResult] = await Promise.all([
      this.db
        .select()
        .from(jobs)
        .where(whereClause)
        .orderBy(desc(jobs.updatedAt))
        .limit(limit)
        .offset(skip),
      this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(jobs)
        .where(whereClause),
    ]);

    const total = countResult[0]?.count ?? 0;
    return { data, total };
  }

  async findOne(params: { id: string; tenantId: string }): Promise<JobRow | null> {
    const [row] = await this.db
      .select()
      .from(jobs)
      .where(and(eq(jobs.id, params.id), eq(jobs.tenantId, params.tenantId)))
      .limit(1);
    return row ?? null;
  }

  async findByIdAndTenant(params: { id: string; tenantId: string }): Promise<JobRow | null> {
    return this.findOne(params);
  }

  async create(params: { data: JobInsert }): Promise<JobRow> {
    const [inserted] = await this.db.insert(jobs).values(params.data).returning();
    return inserted!;
  }

  async update(params: {
    id: string;
    data: Partial<JobInsert>;
  }): Promise<JobRow | null> {
    const [updated] = await this.db
      .update(jobs)
      .set({ ...params.data, updatedAt: new Date() })
      .where(eq(jobs.id, params.id))
      .returning();
    return updated ?? null;
  }

  async countByTenant(params: { tenantId: string }): Promise<number> {
    const [r] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(jobs)
      .where(eq(jobs.tenantId, params.tenantId));
    return r?.count ?? 0;
  }

  async countByTenantSince(params: {
    tenantId: string;
    since: Date;
  }): Promise<number> {
    const [r] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(jobs)
      .where(
        and(
          eq(jobs.tenantId, params.tenantId),
          gte(jobs.createdAt, params.since),
        ),
      );
    return r?.count ?? 0;
  }

  async countByStatusGrouped(params: {
    tenantId: string;
  }): Promise<{ status: string; count: string }[]> {
    const result = await this.db
      .select({
        status: sql<string>`COALESCE(${lookupValues.name}, 'Unknown')`.as('status'),
        count: sql<string>`COUNT(*)::text`.as('count'),
      })
      .from(jobs)
      .leftJoin(lookupValues, eq(jobs.statusLookupId, lookupValues.id))
      .where(and(eq(jobs.tenantId, params.tenantId), isNull(jobs.deletedAt)))
      .groupBy(sql`COALESCE(${lookupValues.name}, 'Unknown')`);
    return result as { status: string; count: string }[];
  }
}
