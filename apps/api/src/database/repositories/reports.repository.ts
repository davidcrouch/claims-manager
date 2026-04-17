import { Injectable } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { eq, and, isNull, desc, sql } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB, type DrizzleDbOrTx } from '../drizzle.module';
import { reports } from '../schema';

export type ReportRow = typeof reports.$inferSelect;
export type ReportInsert = typeof reports.$inferInsert;

@Injectable()
export class ReportsRepository {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async findAll(params: {
    tenantId: string;
    page?: number;
    limit?: number;
    jobId?: string;
    claimId?: string;
    reportTypeId?: string;
  }): Promise<{ data: ReportRow[]; total: number }> {
    const page = params.page ?? 1;
    const limit = Math.min(params.limit ?? 20, 100);
    const skip = (page - 1) * limit;

    let whereClause = and(
      eq(reports.tenantId, params.tenantId),
      isNull(reports.deletedAt),
    );
    if (params.jobId) {
      whereClause = and(whereClause, eq(reports.jobId, params.jobId));
    }
    if (params.claimId) {
      whereClause = and(whereClause, eq(reports.claimId, params.claimId));
    }
    if (params.reportTypeId) {
      whereClause = and(
        whereClause,
        eq(reports.reportTypeLookupId, params.reportTypeId),
      );
    }

    const [data, countResult] = await Promise.all([
      this.db
        .select()
        .from(reports)
        .where(whereClause)
        .orderBy(desc(reports.updatedAt))
        .limit(limit)
        .offset(skip),
      this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(reports)
        .where(whereClause),
    ]);

    const total = countResult[0]?.count ?? 0;
    return { data, total };
  }

  async findOne(params: {
    id: string;
    tenantId: string;
  }): Promise<ReportRow | null> {
    const [row] = await this.db
      .select()
      .from(reports)
      .where(
        and(eq(reports.id, params.id), eq(reports.tenantId, params.tenantId)),
      )
      .limit(1);
    return row ?? null;
  }

  async findByJob(params: {
    jobId: string;
    tenantId: string;
  }): Promise<ReportRow[]> {
    return this.db
      .select()
      .from(reports)
      .where(
        and(
          eq(reports.jobId, params.jobId),
          eq(reports.tenantId, params.tenantId),
        ),
      )
      .orderBy(desc(reports.updatedAt));
  }

  async findByClaim(params: {
    claimId: string;
    tenantId: string;
  }): Promise<ReportRow[]> {
    return this.db
      .select()
      .from(reports)
      .where(
        and(
          eq(reports.claimId, params.claimId),
          eq(reports.tenantId, params.tenantId),
        ),
      )
      .orderBy(desc(reports.updatedAt));
  }

  async create(params: {
    data: ReportInsert;
    tx?: DrizzleDbOrTx;
  }): Promise<ReportRow> {
    const db = params.tx ?? this.db;
    const [inserted] = await db.insert(reports).values(params.data).returning();
    return inserted;
  }

  async update(params: {
    id: string;
    data: Partial<ReportInsert>;
    tx?: DrizzleDbOrTx;
  }): Promise<ReportRow | null> {
    const db = params.tx ?? this.db;
    const [updated] = await db
      .update(reports)
      .set({ ...params.data, updatedAt: new Date() })
      .where(eq(reports.id, params.id))
      .returning();
    return updated ?? null;
  }
}
