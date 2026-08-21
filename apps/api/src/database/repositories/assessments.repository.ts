import { Injectable, Inject } from '@nestjs/common';
import { eq, and, desc, isNull, sql, inArray, ilike } from 'drizzle-orm';
import { normalizeListJobIds } from '../../common/list-job-filter';
import { DRIZZLE, type DrizzleDB } from '../drizzle.module';
import { assessments } from '../schema';

export type AssessmentRow = typeof assessments.$inferSelect;
export type AssessmentInsert = typeof assessments.$inferInsert;

@Injectable()
export class AssessmentsRepository {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async findAll(params: {
    tenantId: string;
    page?: number;
    limit?: number;
    status?: string;
    jobId?: string;
    jobIds?: string[];
    search?: string;
  }): Promise<{ data: AssessmentRow[]; total: number }> {
    const page = params.page ?? 1;
    const limit = Math.min(params.limit ?? 20, 100);
    const skip = (page - 1) * limit;

    let whereClause = and(
      eq(assessments.tenantId, params.tenantId),
      isNull(assessments.deletedAt),
    );

    const statuses = params.status?.split(',').map((v) => v.trim()).filter(Boolean) ?? [];
    if (statuses.length > 0) {
      whereClause = and(whereClause, inArray(assessments.status, statuses));
    }

    const jobIds = normalizeListJobIds({ jobId: params.jobId, jobIds: params.jobIds });
    if (jobIds) {
      if (jobIds.length === 0) return { data: [], total: 0 };
      whereClause = and(
        whereClause,
        jobIds.length === 1
          ? eq(assessments.jobId, jobIds[0])
          : inArray(assessments.jobId, jobIds),
      );
    }

    if (params.search?.trim()) {
      const term = `%${params.search.trim()}%`;
      whereClause = and(whereClause, ilike(assessments.name, term));
    }

    const [data, countResult] = await Promise.all([
      this.db
        .select()
        .from(assessments)
        .where(whereClause)
        .orderBy(desc(assessments.updatedAt))
        .limit(limit)
        .offset(skip),
      this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(assessments)
        .where(whereClause),
    ]);

    const total = countResult[0]?.count ?? 0;
    return { data, total };
  }

  async findOne(params: { id: string; tenantId: string }): Promise<AssessmentRow | null> {
    const [row] = await this.db
      .select()
      .from(assessments)
      .where(
        and(
          eq(assessments.id, params.id),
          eq(assessments.tenantId, params.tenantId),
          isNull(assessments.deletedAt),
        ),
      )
      .limit(1);
    return row ?? null;
  }

  async create(params: { data: AssessmentInsert }): Promise<AssessmentRow> {
    const [inserted] = await this.db
      .insert(assessments)
      .values(params.data)
      .returning();
    return inserted;
  }

  async update(params: {
    id: string;
    tenantId: string;
    data: Partial<AssessmentInsert>;
  }): Promise<AssessmentRow | null> {
    const [updated] = await this.db
      .update(assessments)
      .set({ ...params.data, updatedAt: new Date() })
      .where(and(eq(assessments.id, params.id), eq(assessments.tenantId, params.tenantId)))
      .returning();
    return updated ?? null;
  }

  async softDelete(params: { id: string; tenantId: string }): Promise<void> {
    await this.db
      .update(assessments)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(assessments.id, params.id), eq(assessments.tenantId, params.tenantId)));
  }
}
