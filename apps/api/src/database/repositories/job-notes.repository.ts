import { Injectable, Inject } from '@nestjs/common';
import { eq, and, desc, asc, sql, inArray, ilike } from 'drizzle-orm';
import { normalizeListJobIds } from '../../common/list-job-filter';
import { DRIZZLE, type DrizzleDB, type DrizzleDbOrTx } from '../drizzle.module';
import { jobNotes } from '../schema';

export type JobNoteRow = typeof jobNotes.$inferSelect;
export type JobNoteInsert = typeof jobNotes.$inferInsert;

@Injectable()
export class JobNotesRepository {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async findAll(params: {
    tenantId: string;
    page?: number;
    limit?: number;
    jobId?: string;
    jobIds?: string[];
    search?: string;
    sort?: string;
  }): Promise<{ data: JobNoteRow[]; total: number }> {
    const page = params.page ?? 1;
    const limit = Math.min(params.limit ?? 20, 100);
    const skip = (page - 1) * limit;

    let whereClause = eq(jobNotes.tenantId, params.tenantId);
    const jobIds = normalizeListJobIds({ jobId: params.jobId, jobIds: params.jobIds });
    if (jobIds) {
      if (jobIds.length === 0) return { data: [], total: 0 };
      whereClause = and(
        whereClause,
        jobIds.length === 1
          ? eq(jobNotes.jobId, jobIds[0])
          : inArray(jobNotes.jobId, jobIds),
      )!;
    }

    if (params.search?.trim()) {
      const term = `%${params.search.trim()}%`;
      whereClause = and(whereClause, ilike(jobNotes.body, term))!;
    }

    let orderBy;
    switch (params.sort) {
      case 'created_at_asc':
        orderBy = [asc(jobNotes.createdAt)];
        break;
      case 'created_at_desc':
      default:
        orderBy = [desc(jobNotes.createdAt)];
        break;
    }

    const [data, countResult] = await Promise.all([
      this.db
        .select()
        .from(jobNotes)
        .where(whereClause)
        .orderBy(...orderBy)
        .limit(limit)
        .offset(skip),
      this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(jobNotes)
        .where(whereClause),
    ]);

    const total = countResult[0]?.count ?? 0;
    return { data, total };
  }

  async findOne(params: { id: string; tenantId: string }): Promise<JobNoteRow | null> {
    const [row] = await this.db
      .select()
      .from(jobNotes)
      .where(and(eq(jobNotes.id, params.id), eq(jobNotes.tenantId, params.tenantId)))
      .limit(1);
    return row ?? null;
  }

  async create(params: { data: JobNoteInsert; tx?: DrizzleDbOrTx }): Promise<JobNoteRow> {
    const db = params.tx ?? this.db;
    const [inserted] = await db.insert(jobNotes).values(params.data).returning();
    return inserted!;
  }

  async delete(params: {
    id: string;
    tenantId: string;
    tx?: DrizzleDbOrTx;
  }): Promise<JobNoteRow | null> {
    const db = params.tx ?? this.db;
    const [deleted] = await db
      .delete(jobNotes)
      .where(and(eq(jobNotes.id, params.id), eq(jobNotes.tenantId, params.tenantId)))
      .returning();
    return deleted ?? null;
  }
}
