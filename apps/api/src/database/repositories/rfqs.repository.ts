import { Injectable, Inject } from '@nestjs/common';
import { eq, and, isNull, desc, asc, sql, inArray, or, ilike } from 'drizzle-orm';
import { normalizeListJobIds } from '../../common/list-job-filter';
import { DRIZZLE } from '../drizzle.module';
import type { DrizzleDB, DrizzleDbOrTx } from '../drizzle.module';
import { rfqs, rfqSendRequests, rfqSendRecipients } from '../schema';

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
    jobIds?: string[];
    quoteId?: string;
    /** Comma-separated status lookup IDs. */
    status?: string;
    vendorId?: string;
    search?: string;
    sort?: string;
  }): Promise<{ data: RfqRow[]; total: number }> {
    const page = params.page ?? 1;
    const limit = Math.min(params.limit ?? 20, 100);
    const skip = (page - 1) * limit;

    let whereClause = and(
      eq(rfqs.tenantId, params.tenantId),
      isNull(rfqs.deletedAt),
    );
    const jobIds = normalizeListJobIds({ jobId: params.jobId, jobIds: params.jobIds });
    if (jobIds) {
      if (jobIds.length === 0) return { data: [], total: 0 };
      whereClause = and(
        whereClause,
        jobIds.length === 1 ? eq(rfqs.jobId, jobIds[0]) : inArray(rfqs.jobId, jobIds),
      );
    }
    if (params.quoteId) {
      whereClause = and(whereClause, eq(rfqs.quoteId, params.quoteId));
    }
    const statusIds = params.status?.split(',').map((value) => value.trim()).filter(Boolean) ?? [];
    const vendorIds = params.vendorId?.split(',').map((value) => value.trim()).filter(Boolean) ?? [];
    if (statusIds.length > 0) {
      whereClause = and(whereClause, inArray(rfqs.statusLookupId, statusIds));
    }
    if (vendorIds.length > 0) {
      whereClause = and(whereClause, inArray(rfqs.vendorId, vendorIds));
    }
    if (params.search?.trim()) {
      const term = `%${params.search.trim()}%`;
      whereClause = and(
        whereClause,
        or(
          ilike(rfqs.rfqNumber, term),
          ilike(rfqs.name, term),
          ilike(rfqs.rfqToName, term),
          ilike(rfqs.note, term),
          ilike(rfqs.sourceExternalReference, term),
        )!,
      );
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

  /**
   * RFQs sent to a recipient email (send-request recipients and RFQ "to" email).
   * Matching is by email only — contact UUID is not used.
   */
  async findSentToEmail(params: {
    tenantId: string;
    email: string;
    jobId?: string;
  }): Promise<RfqRow[]> {
    const email = params.email.trim().toLowerCase();
    if (!email) return [];

    let sentWhere = and(
      eq(rfqs.tenantId, params.tenantId),
      isNull(rfqs.deletedAt),
      eq(rfqSendRequests.tenantId, params.tenantId),
      sql`lower(${rfqSendRecipients.recipientEmail}) = ${email}`,
    );
    if (params.jobId) {
      sentWhere = and(sentWhere, eq(rfqs.jobId, params.jobId));
    }

    const sentRows = await this.db
      .select({ rfq: rfqs })
      .from(rfqs)
      .innerJoin(rfqSendRequests, eq(rfqSendRequests.rfqId, rfqs.id))
      .innerJoin(
        rfqSendRecipients,
        eq(rfqSendRecipients.sendRequestId, rfqSendRequests.id),
      )
      .where(sentWhere)
      .orderBy(desc(rfqs.updatedAt));

    const byId = new Map<string, RfqRow>();
    for (const row of sentRows) {
      byId.set(row.rfq.id, row.rfq);
    }

    let toWhere = and(
      eq(rfqs.tenantId, params.tenantId),
      isNull(rfqs.deletedAt),
      or(
        sql`lower(${rfqs.rfqToEmail}) = ${email}`,
        sql`lower(${rfqs.rfqTo}->>'email') = ${email}`,
      ),
    );
    if (params.jobId) {
      toWhere = and(toWhere, eq(rfqs.jobId, params.jobId));
    }

    const toRows = await this.db
      .select()
      .from(rfqs)
      .where(toWhere)
      .orderBy(desc(rfqs.updatedAt));
    for (const row of toRows) {
      byId.set(row.id, row);
    }

    return [...byId.values()].sort((a, b) => {
      const aTime = a.updatedAt instanceof Date ? a.updatedAt.getTime() : 0;
      const bTime = b.updatedAt instanceof Date ? b.updatedAt.getTime() : 0;
      return bTime - aTime;
    });
  }

  async create(params: { data: RfqInsert; tx?: DrizzleDbOrTx }): Promise<RfqRow> {
    const db = params.tx ?? this.db;
    const [created] = await db
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
