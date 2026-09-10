import { Injectable, Inject } from '@nestjs/common';
import { eq, and, desc, count, ilike, or, sql } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB, type DrizzleDbOrTx } from '../drizzle.module';
import { feedbackItems } from '../schema';

export type FeedbackItemRow = typeof feedbackItems.$inferSelect;
export type FeedbackItemInsert = typeof feedbackItems.$inferInsert;

@Injectable()
export class FeedbackItemsRepository {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async create(params: {
    data: FeedbackItemInsert;
    tx?: DrizzleDbOrTx;
  }): Promise<FeedbackItemRow> {
    const db = params.tx ?? this.db;
    const [row] = await db
      .insert(feedbackItems)
      .values(params.data)
      .returning();
    return row;
  }

  async findOne(params: {
    id: string;
    tenantId: string;
  }): Promise<FeedbackItemRow | undefined> {
    const [row] = await this.db
      .select()
      .from(feedbackItems)
      .where(
        and(
          eq(feedbackItems.id, params.id),
          eq(feedbackItems.tenantId, params.tenantId),
        ),
      )
      .limit(1);
    return row;
  }

  async findAll(params: {
    tenantId: string;
    type?: string;
    status?: string;
    priority?: string;
    search?: string;
    page?: number;
    limit?: number;
  }): Promise<{ data: FeedbackItemRow[]; total: number }> {
    const page = params.page ?? 1;
    const limit = Math.min(params.limit ?? 20, 100);
    const skip = (page - 1) * limit;

    const conditions = [eq(feedbackItems.tenantId, params.tenantId)];

    if (params.type) {
      conditions.push(eq(feedbackItems.type, params.type));
    }
    if (params.status) {
      conditions.push(eq(feedbackItems.status, params.status));
    }
    if (params.priority) {
      conditions.push(eq(feedbackItems.priority, params.priority));
    }
    if (params.search) {
      conditions.push(
        or(
          ilike(feedbackItems.title, `%${params.search}%`),
          ilike(feedbackItems.description, `%${params.search}%`),
        )!,
      );
    }

    const whereClause = and(...conditions);

    const [data, countResult] = await Promise.all([
      this.db
        .select()
        .from(feedbackItems)
        .where(whereClause)
        .orderBy(desc(feedbackItems.createdAt))
        .offset(skip)
        .limit(limit),
      this.db
        .select({ value: count() })
        .from(feedbackItems)
        .where(whereClause),
    ]);

    return { data, total: countResult[0]?.value ?? 0 };
  }

  async update(params: {
    id: string;
    tenantId: string;
    data: Partial<
      Pick<
        FeedbackItemInsert,
        'status' | 'priority' | 'resolution' | 'tags' | 'title' | 'description'
      >
    >;
  }): Promise<FeedbackItemRow | undefined> {
    const [row] = await this.db
      .update(feedbackItems)
      .set({ ...params.data, updatedAt: new Date() })
      .where(
        and(
          eq(feedbackItems.id, params.id),
          eq(feedbackItems.tenantId, params.tenantId),
        ),
      )
      .returning();
    return row;
  }

  async delete(params: {
    id: string;
    tenantId: string;
  }): Promise<FeedbackItemRow | undefined> {
    const [row] = await this.db
      .delete(feedbackItems)
      .where(
        and(
          eq(feedbackItems.id, params.id),
          eq(feedbackItems.tenantId, params.tenantId),
        ),
      )
      .returning();
    return row;
  }

  async countByStatus(params: {
    tenantId: string;
  }): Promise<Record<string, number>> {
    const rows = await this.db
      .select({
        status: feedbackItems.status,
        count: count(),
      })
      .from(feedbackItems)
      .where(eq(feedbackItems.tenantId, params.tenantId))
      .groupBy(feedbackItems.status);

    const result: Record<string, number> = {};
    for (const row of rows) {
      result[row.status] = row.count;
    }
    return result;
  }

  async countByType(params: {
    tenantId: string;
  }): Promise<Record<string, number>> {
    const rows = await this.db
      .select({
        type: feedbackItems.type,
        count: count(),
      })
      .from(feedbackItems)
      .where(eq(feedbackItems.tenantId, params.tenantId))
      .groupBy(feedbackItems.type);

    const result: Record<string, number> = {};
    for (const row of rows) {
      result[row.type] = row.count;
    }
    return result;
  }
}
