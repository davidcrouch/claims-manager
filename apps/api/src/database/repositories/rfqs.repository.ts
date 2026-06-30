import { Injectable, Inject } from '@nestjs/common';
import { eq, and, isNull, desc, asc, sql } from 'drizzle-orm';
import { DRIZZLE } from '../drizzle.module';
import type { DrizzleDB } from '../drizzle.module';
import { rfqs } from '../schema';

export type RfqRow = typeof rfqs.$inferSelect;
export type RfqInsert = typeof rfqs.$inferInsert;

function buildRfqsOrderBy(sort?: string) {
  switch (sort) {
    case 'updated_at_asc':
      return [asc(rfqs.updatedAt)];
    case 'created_at_desc':
      return [desc(rfqs.createdAt)];
    case 'created_at_asc':
      return [asc(rfqs.createdAt)];
    case 'rfq_number_asc':
      return [asc(rfqs.rfqNumber)];
    case 'rfq_number_desc':
      return [desc(rfqs.rfqNumber)];
    case 'sent_date_asc':
      return [asc(rfqs.sentDate)];
    case 'sent_date_desc':
      return [desc(rfqs.sentDate)];
    case 'due_date_asc':
      return [asc(rfqs.dueDate)];
    case 'due_date_desc':
      return [desc(rfqs.dueDate)];
    case 'status_asc':
      return [asc(rfqs.statusLookupId)];
    case 'status_desc':
      return [desc(rfqs.statusLookupId)];
    case 'vendor_asc':
      return [asc(rfqs.rfqToName)];
    case 'vendor_desc':
      return [desc(rfqs.rfqToName)];
    case 'updated_at_desc':
    default:
      return [desc(rfqs.updatedAt)];
  }
}

@Injectable()
export class RfqsRepository {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async findAll(params: {
    tenantId: string;
    page?: number;
    limit?: number;
    jobId?: string;
    quoteId?: string;
    vendorId?: string;
    sort?: string;
  }): Promise<{ data: RfqRow[]; total: number }> {
    const page = params.page ?? 1;
    const limit = Math.min(params.limit ?? 20, 100);
    const skip = (page - 1) * limit;

    let whereClause = and(
      eq(rfqs.tenantId, params.tenantId),
      isNull(rfqs.deletedAt),
    );
    if (params.jobId) {
      whereClause = and(whereClause, eq(rfqs.jobId, params.jobId));
    }
    if (params.quoteId) {
      whereClause = and(whereClause, eq(rfqs.quoteId, params.quoteId));
    }
    if (params.vendorId) {
      whereClause = and(whereClause, eq(rfqs.vendorId, params.vendorId));
    }

    const [data, countResult] = await Promise.all([
      this.db
        .select()
        .from(rfqs)
        .where(whereClause)
        .orderBy(...buildRfqsOrderBy(params.sort))
        .limit(limit)
        .offset(skip),
      this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(rfqs)
        .where(whereClause),
    ]);

    const total = countResult[0]?.count ?? 0;
    return { data, total };
  }

  async findOne(params: { id: string; tenantId: string }): Promise<RfqRow | null> {
    const [row] = await this.db
      .select()
      .from(rfqs)
      .where(and(eq(rfqs.id, params.id), eq(rfqs.tenantId, params.tenantId)))
      .limit(1);
    return row ?? null;
  }

  async findByJob(params: { jobId: string; tenantId: string }): Promise<RfqRow[]> {
    return this.db
      .select()
      .from(rfqs)
      .where(and(eq(rfqs.jobId, params.jobId), eq(rfqs.tenantId, params.tenantId)))
      .orderBy(desc(rfqs.updatedAt));
  }

  async findByQuote(params: { quoteId: string; tenantId: string }): Promise<RfqRow[]> {
    return this.db
      .select()
      .from(rfqs)
      .where(and(eq(rfqs.quoteId, params.quoteId), eq(rfqs.tenantId, params.tenantId)))
      .orderBy(desc(rfqs.updatedAt));
  }

  async create(params: { data: RfqInsert }): Promise<RfqRow> {
    const [created] = await this.db
      .insert(rfqs)
      .values(params.data)
      .returning();
    return created;
  }

  async update(params: {
    id: string;
    data: Partial<RfqInsert>;
  }): Promise<RfqRow | null> {
    const [updated] = await this.db
      .update(rfqs)
      .set({ ...params.data, updatedAt: new Date() })
      .where(eq(rfqs.id, params.id))
      .returning();
    return updated ?? null;
  }
}
