import { Injectable, Inject } from '@nestjs/common';
import { eq, and, desc, sql } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB, type DrizzleDbOrTx } from '../drizzle.module';
import { externalProcessingLog } from '../schema';

export type ExternalProcessingLogRow =
  typeof externalProcessingLog.$inferSelect;
export type ExternalProcessingLogInsert =
  typeof externalProcessingLog.$inferInsert;

@Injectable()
export class ExternalProcessingLogRepository {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async create(params: {
    data: ExternalProcessingLogInsert;
    tx?: DrizzleDbOrTx;
  }): Promise<ExternalProcessingLogRow> {
    const db = params.tx ?? this.db;
    const [inserted] = await db
      .insert(externalProcessingLog)
      .values(params.data)
      .returning();
    return inserted;
  }

  async updateStatus(params: {
    id: string;
    status: string;
    completedAt?: Date;
    errorMessage?: string;
    externalObjectId?: string;
    workflowRunId?: string;
    metadata?: Record<string, unknown>;
    tx?: DrizzleDbOrTx;
  }): Promise<ExternalProcessingLogRow | null> {
    const db = params.tx ?? this.db;
    const setData: Record<string, unknown> = {
      status: params.status,
      updatedAt: new Date(),
    };
    if (params.completedAt !== undefined)
      setData.completedAt = params.completedAt;
    if (params.errorMessage !== undefined)
      setData.errorMessage = params.errorMessage;
    if (params.externalObjectId !== undefined)
      setData.externalObjectId = params.externalObjectId;
    if (params.workflowRunId !== undefined)
      setData.workflowRunId = params.workflowRunId;
    if (params.metadata !== undefined) setData.metadata = params.metadata;

    const [updated] = await db
      .update(externalProcessingLog)
      .set(setData)
      .where(eq(externalProcessingLog.id, params.id))
      .returning();
    return updated ?? null;
  }

  async findByEventId(params: {
    eventId: string;
  }): Promise<ExternalProcessingLogRow | null> {
    const [row] = await this.db
      .select()
      .from(externalProcessingLog)
      .where(eq(externalProcessingLog.eventId, params.eventId))
      .limit(1);
    return row ?? null;
  }

  async findByTenantAndType(params: {
    tenantId: string;
    providerEntityType?: string;
    status?: string;
    page?: number;
    limit?: number;
  }): Promise<{ data: ExternalProcessingLogRow[]; total: number }> {
    const page = params.page ?? 1;
    const limit = Math.min(params.limit ?? 20, 100);
    const skip = (page - 1) * limit;

    const conditions = [eq(externalProcessingLog.tenantId, params.tenantId)];
    if (params.providerEntityType) {
      conditions.push(
        eq(externalProcessingLog.providerEntityType, params.providerEntityType),
      );
    }
    if (params.status) {
      conditions.push(eq(externalProcessingLog.status, params.status));
    }

    const whereClause = and(...conditions);

    const [data, countResult] = await Promise.all([
      this.db
        .select()
        .from(externalProcessingLog)
        .where(whereClause)
        .orderBy(desc(externalProcessingLog.createdAt))
        .limit(limit)
        .offset(skip),
      this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(externalProcessingLog)
        .where(whereClause),
    ]);

    return { data, total: countResult[0]?.count ?? 0 };
  }
}
