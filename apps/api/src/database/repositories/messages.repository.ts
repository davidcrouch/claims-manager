import { Injectable } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { eq, and, or, desc, sql } from 'drizzle-orm';
import { DRIZZLE } from '../drizzle.module';
import type { DrizzleDB } from '../drizzle.module';
import { messages } from '../schema';

export type MessageRow = typeof messages.$inferSelect;
export type MessageInsert = typeof messages.$inferInsert;

@Injectable()
export class MessagesRepository {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async findAll(params: {
    tenantId: string;
    page?: number;
    limit?: number;
    jobId?: string;
    fromJobId?: string;
    toJobId?: string;
  }): Promise<{ data: MessageRow[]; total: number }> {
    const page = params.page ?? 1;
    const limit = Math.min(params.limit ?? 20, 100);
    const skip = (page - 1) * limit;

    let whereClause = eq(messages.tenantId, params.tenantId);
    if (params.jobId) {
      whereClause = and(
        whereClause,
        or(
          eq(messages.fromJobId, params.jobId),
          eq(messages.toJobId, params.jobId),
        ),
      )!;
    }
    if (params.fromJobId) {
      whereClause = and(whereClause, eq(messages.fromJobId, params.fromJobId))!;
    }
    if (params.toJobId) {
      whereClause = and(whereClause, eq(messages.toJobId, params.toJobId))!;
    }

    const [data, countResult] = await Promise.all([
      this.db
        .select()
        .from(messages)
        .where(whereClause)
        .orderBy(desc(messages.createdAt))
        .limit(limit)
        .offset(skip),
      this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(messages)
        .where(whereClause),
    ]);

    const total = countResult[0]?.count ?? 0;
    return { data, total };
  }

  async findOne(params: { id: string; tenantId: string }): Promise<MessageRow | null> {
    const [row] = await this.db
      .select()
      .from(messages)
      .where(and(eq(messages.id, params.id), eq(messages.tenantId, params.tenantId)))
      .limit(1);
    return row ?? null;
  }

  async create(params: { data: MessageInsert }): Promise<MessageRow> {
    const [inserted] = await this.db.insert(messages).values(params.data).returning();
    return inserted!;
  }

  async update(params: {
    id: string;
    data: Partial<MessageInsert>;
  }): Promise<MessageRow | null> {
    const [updated] = await this.db
      .update(messages)
      .set({ ...params.data, updatedAt: new Date() })
      .where(eq(messages.id, params.id))
      .returning();
    return updated ?? null;
  }
}
