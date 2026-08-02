import { Injectable, Inject } from '@nestjs/common';
import { and, count, desc, eq, gte, ilike, lte, type SQL } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB } from '../drizzle.module';
import { aiMessageAudit } from '../schema';

export type AiMessageAuditRow = typeof aiMessageAudit.$inferSelect;
export type AiMessageAuditInsert = typeof aiMessageAudit.$inferInsert;

export interface AiAuditListFilters {
  tenantId: string;
  userId?: string;
  model?: string;
  status?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
}

@Injectable()
export class AiMessageAuditRepository {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async create(data: AiMessageAuditInsert): Promise<AiMessageAuditRow> {
    const [inserted] = await this.db.insert(aiMessageAudit).values(data).returning();
    return inserted!;
  }

  async findByTenant(params: {
    tenantId: string;
    limit?: number;
  }): Promise<AiMessageAuditRow[]> {
    const limit = Math.min(params.limit ?? 100, 500);
    return this.db
      .select()
      .from(aiMessageAudit)
      .where(eq(aiMessageAudit.tenantId, params.tenantId))
      .orderBy(desc(aiMessageAudit.createdAt))
      .limit(limit);
  }

  async findAuditLog(
    filters: AiAuditListFilters,
  ): Promise<{ rows: AiMessageAuditRow[]; total: number }> {
    const page = Math.max(filters.page ?? 1, 1);
    const limit = Math.min(Math.max(filters.limit ?? 25, 1), 500);
    const offset = (page - 1) * limit;

    const conditions: SQL[] = [eq(aiMessageAudit.tenantId, filters.tenantId)];
    if (filters.userId) {
      conditions.push(eq(aiMessageAudit.userId, filters.userId));
    }
    if (filters.model) {
      conditions.push(ilike(aiMessageAudit.model, `%${filters.model}%`));
    }
    if (filters.status) {
      conditions.push(eq(aiMessageAudit.status, filters.status));
    }
    if (filters.dateFrom) {
      conditions.push(gte(aiMessageAudit.createdAt, new Date(filters.dateFrom)));
    }
    if (filters.dateTo) {
      const end = new Date(filters.dateTo);
      end.setHours(23, 59, 59, 999);
      conditions.push(lte(aiMessageAudit.createdAt, end));
    }

    const where = and(...conditions);

    const [rows, totalResult] = await Promise.all([
      this.db
        .select()
        .from(aiMessageAudit)
        .where(where)
        .orderBy(desc(aiMessageAudit.createdAt))
        .limit(limit)
        .offset(offset),
      this.db
        .select({ count: count() })
        .from(aiMessageAudit)
        .where(where),
    ]);

    return { rows, total: totalResult[0]?.count ?? 0 };
  }

  async findById(params: {
    tenantId: string;
    id: string;
  }): Promise<AiMessageAuditRow | null> {
    const [row] = await this.db
      .select()
      .from(aiMessageAudit)
      .where(
        and(
          eq(aiMessageAudit.tenantId, params.tenantId),
          eq(aiMessageAudit.id, params.id),
        ),
      )
      .limit(1);
    return row ?? null;
  }

  async findByConversation(params: {
    tenantId: string;
    conversationId: string;
  }): Promise<AiMessageAuditRow[]> {
    return this.db
      .select()
      .from(aiMessageAudit)
      .where(
        and(
          eq(aiMessageAudit.tenantId, params.tenantId),
          eq(aiMessageAudit.conversationId, params.conversationId),
        ),
      )
      .orderBy(desc(aiMessageAudit.createdAt));
  }
}
