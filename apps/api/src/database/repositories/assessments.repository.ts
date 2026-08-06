import { Injectable, Inject } from '@nestjs/common';
import { eq, and, desc, isNull, sql, inArray } from 'drizzle-orm';
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

    if (params.jobId) {
      whereClause = and(whereClause, eq(assessments.jobId, params.jobId));
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
