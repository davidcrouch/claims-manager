import { Injectable } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { eq, and, desc, asc, sql } from 'drizzle-orm';
import { DRIZZLE } from '../drizzle.module';
import type { DrizzleDB } from '../drizzle.module';
import { tasks } from '../schema';

export type TaskRow = typeof tasks.$inferSelect;
export type TaskInsert = typeof tasks.$inferInsert;

@Injectable()
export class TasksRepository {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async findAll(params: {
    tenantId: string;
    page?: number;
    limit?: number;
    jobId?: string;
    claimId?: string;
    status?: string;
  }): Promise<{ data: TaskRow[]; total: number }> {
    const page = params.page ?? 1;
    const limit = Math.min(params.limit ?? 20, 100);
    const skip = (page - 1) * limit;

    let whereClause = eq(tasks.tenantId, params.tenantId);
    if (params.jobId) {
      whereClause = and(whereClause, eq(tasks.jobId, params.jobId))!;
    }
    if (params.claimId) {
      whereClause = and(whereClause, eq(tasks.claimId, params.claimId))!;
    }
    if (params.status) {
      whereClause = and(whereClause, eq(tasks.status, params.status))!;
    }

    const [data, countResult] = await Promise.all([
      this.db
        .select()
        .from(tasks)
        .where(whereClause)
        .orderBy(asc(tasks.dueDate), desc(tasks.createdAt))
        .limit(limit)
        .offset(skip),
      this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(tasks)
        .where(whereClause),
    ]);

    const total = countResult[0]?.count ?? 0;
    return { data, total };
  }

  async findOne(params: { id: string; tenantId: string }): Promise<TaskRow | null> {
    const [row] = await this.db
      .select()
      .from(tasks)
      .where(and(eq(tasks.id, params.id), eq(tasks.tenantId, params.tenantId)))
      .limit(1);
    return row ?? null;
  }

  async findByJob(params: { jobId: string; tenantId: string }): Promise<TaskRow[]> {
    return this.db
      .select()
      .from(tasks)
      .where(and(eq(tasks.jobId, params.jobId), eq(tasks.tenantId, params.tenantId)))
      .orderBy(asc(tasks.dueDate));
  }

  async findByClaim(params: { claimId: string; tenantId: string }): Promise<TaskRow[]> {
    return this.db
      .select()
      .from(tasks)
      .where(and(eq(tasks.claimId, params.claimId), eq(tasks.tenantId, params.tenantId)))
      .orderBy(asc(tasks.dueDate));
  }

  async create(params: { data: TaskInsert }): Promise<TaskRow> {
    const [inserted] = await this.db.insert(tasks).values(params.data).returning();
    return inserted!;
  }

  async update(params: {
    id: string;
    data: Partial<TaskInsert>;
  }): Promise<TaskRow | null> {
    const [updated] = await this.db
      .update(tasks)
      .set({ ...params.data, updatedAt: new Date() })
      .where(eq(tasks.id, params.id))
      .returning();
    return updated ?? null;
  }

  async countByTenantAndStatus(params: {
    tenantId: string;
    status: string;
  }): Promise<number> {
    const [r] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(tasks)
      .where(
        and(
          eq(tasks.tenantId, params.tenantId),
          eq(tasks.status, params.status),
        ),
      );
    return r?.count ?? 0;
  }
}
