import { Injectable } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { eq, and, isNull, desc, asc, sql } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB, type DrizzleDbOrTx } from '../drizzle.module';
import { proposals } from '../schema';

export type ProposalRow = typeof proposals.$inferSelect;
export type ProposalInsert = typeof proposals.$inferInsert;

function buildProposalsOrderBy(sort?: string) {
  switch (sort) {
    case 'updated_at_asc':
      return [asc(proposals.updatedAt)];
    case 'created_at_desc':
      return [desc(proposals.createdAt)];
    case 'created_at_asc':
      return [asc(proposals.createdAt)];
    case 'proposal_number_asc':
      return [asc(proposals.proposalNumber)];
    case 'proposal_number_desc':
      return [desc(proposals.proposalNumber)];
    case 'total_amount_asc':
      return [asc(proposals.totalAmount)];
    case 'total_amount_desc':
      return [desc(proposals.totalAmount)];
    case 'received_date_asc':
      return [asc(proposals.receivedDate)];
    case 'received_date_desc':
      return [desc(proposals.receivedDate)];
    case 'status_asc':
      return [asc(proposals.statusLookupId)];
    case 'status_desc':
      return [desc(proposals.statusLookupId)];
    case 'vendor_asc':
      return [asc(proposals.proposalToName)];
    case 'vendor_desc':
      return [desc(proposals.proposalToName)];
    case 'updated_at_desc':
    default:
      return [desc(proposals.updatedAt)];
  }
}

@Injectable()
export class ProposalsRepository {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async findAll(params: {
    tenantId: string;
    page?: number;
    limit?: number;
    jobId?: string;
    rfqId?: string;
    vendorId?: string;
    sort?: string;
  }): Promise<{ data: ProposalRow[]; total: number }> {
    const page = params.page ?? 1;
    const limit = Math.min(params.limit ?? 20, 100);
    const skip = (page - 1) * limit;

    let whereClause = and(
      eq(proposals.tenantId, params.tenantId),
      isNull(proposals.deletedAt),
    );
    if (params.jobId) {
      whereClause = and(whereClause, eq(proposals.jobId, params.jobId));
    }
    if (params.rfqId) {
      whereClause = and(whereClause, eq(proposals.rfqId, params.rfqId));
    }
    if (params.vendorId) {
      whereClause = and(whereClause, eq(proposals.vendorId, params.vendorId));
    }

    const [data, countResult] = await Promise.all([
      this.db
        .select()
        .from(proposals)
        .where(whereClause)
        .orderBy(...buildProposalsOrderBy(params.sort))
        .limit(limit)
        .offset(skip),
      this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(proposals)
        .where(whereClause),
    ]);

    const total = countResult[0]?.count ?? 0;
    return { data, total };
  }

  async findOne(params: {
    id: string;
    tenantId: string;
  }): Promise<ProposalRow | null> {
    const [row] = await this.db
      .select()
      .from(proposals)
      .where(
        and(eq(proposals.id, params.id), eq(proposals.tenantId, params.tenantId)),
      )
      .limit(1);
    return row ?? null;
  }

  async findByJob(params: {
    jobId: string;
    tenantId: string;
  }): Promise<ProposalRow[]> {
    return this.db
      .select()
      .from(proposals)
      .where(
        and(
          eq(proposals.jobId, params.jobId),
          eq(proposals.tenantId, params.tenantId),
        ),
      )
      .orderBy(desc(proposals.updatedAt));
  }

  async findByRfq(params: {
    rfqId: string;
    tenantId: string;
  }): Promise<ProposalRow[]> {
    return this.db
      .select()
      .from(proposals)
      .where(
        and(
          eq(proposals.rfqId, params.rfqId),
          eq(proposals.tenantId, params.tenantId),
        ),
      )
      .orderBy(desc(proposals.updatedAt));
  }

  async findByVendor(params: {
    vendorId: string;
    tenantId: string;
  }): Promise<ProposalRow[]> {
    return this.db
      .select()
      .from(proposals)
      .where(
        and(
          eq(proposals.vendorId, params.vendorId),
          eq(proposals.tenantId, params.tenantId),
        ),
      )
      .orderBy(desc(proposals.updatedAt));
  }

  async create(params: { data: ProposalInsert; tx?: DrizzleDbOrTx }): Promise<ProposalRow> {
    const db = params.tx ?? this.db;
    const [inserted] = await db
      .insert(proposals)
      .values(params.data)
      .returning();
    return inserted;
  }

  async update(params: {
    id: string;
    data: Partial<ProposalInsert>;
    tx?: DrizzleDbOrTx;
  }): Promise<ProposalRow | null> {
    const db = params.tx ?? this.db;
    const [updated] = await db
      .update(proposals)
      .set({ ...params.data, updatedAt: new Date() })
      .where(eq(proposals.id, params.id))
      .returning();
    return updated ?? null;
  }
}
