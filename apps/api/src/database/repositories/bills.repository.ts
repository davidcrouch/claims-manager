import { Injectable } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { eq, and, desc, asc, sql, inArray, or, ilike } from 'drizzle-orm';
import { normalizeListJobIds } from '../../common/list-job-filter';
import { DRIZZLE, type DrizzleDB, type DrizzleDbOrTx } from '../drizzle.module';
import { bills } from '../schema';

export type BillRow = typeof bills.$inferSelect;
export type BillInsert = typeof bills.$inferInsert;

function buildBillsOrderBy(sort?: string) {
  switch (sort) {
    case 'updated_at_asc':
      return [asc(bills.updatedAt)];
    case 'created_at_desc':
      return [desc(bills.createdAt)];
    case 'created_at_asc':
      return [asc(bills.createdAt)];
    case 'bill_number_asc':
      return [asc(bills.billNumber)];
    case 'bill_number_desc':
      return [desc(bills.billNumber)];
    case 'total_amount_asc':
      return [asc(bills.totalAmount)];
    case 'total_amount_desc':
      return [desc(bills.totalAmount)];
    case 'received_date_asc':
      return [asc(bills.receivedDate)];
    case 'received_date_desc':
      return [desc(bills.receivedDate)];
    case 'due_date_asc':
      return [asc(bills.dueDate)];
    case 'due_date_desc':
      return [desc(bills.dueDate)];
    case 'status_asc':
      return [asc(bills.statusLookupId)];
    case 'status_desc':
      return [desc(bills.statusLookupId)];
    case 'vendor_asc':
      return [asc(bills.vendorId)];
    case 'vendor_desc':
      return [desc(bills.vendorId)];
    case 'updated_at_desc':
    default:
      return [desc(bills.updatedAt)];
  }
}

@Injectable()
export class BillsRepository {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async findAll(params: {
    tenantId: string;
    page?: number;
    limit?: number;
    jobId?: string;
    jobIds?: string[];
    purchaseOrderId?: string;
    /** Comma-separated status lookup IDs. */
    status?: string;
    vendorId?: string;
    invoiceId?: string;
    search?: string;
    sort?: string;
  }): Promise<{ data: BillRow[]; total: number }> {
    const page = params.page ?? 1;
    const limit = Math.min(params.limit ?? 20, 100);
    const skip = (page - 1) * limit;

    let whereClause = and(
      eq(bills.tenantId, params.tenantId),
      eq(bills.isDeleted, false),
    );
    const jobIds = normalizeListJobIds({ jobId: params.jobId, jobIds: params.jobIds });
    if (jobIds) {
      if (jobIds.length === 0) return { data: [], total: 0 };
      whereClause = and(
        whereClause,
        jobIds.length === 1 ? eq(bills.jobId, jobIds[0]) : inArray(bills.jobId, jobIds),
      );
    }
    if (params.purchaseOrderId) {
      whereClause = and(whereClause, eq(bills.purchaseOrderId, params.purchaseOrderId));
    }
    const statusIds = params.status?.split(',').map((value) => value.trim()).filter(Boolean) ?? [];
    const vendorIds = params.vendorId?.split(',').map((value) => value.trim()).filter(Boolean) ?? [];
    if (statusIds.length > 0) {
      whereClause = and(whereClause, inArray(bills.statusLookupId, statusIds));
    }
    if (vendorIds.length > 0) {
      whereClause = and(whereClause, inArray(bills.vendorId, vendorIds));
    }
    if (params.invoiceId) {
      whereClause = and(whereClause, eq(bills.invoiceId, params.invoiceId));
    }
    if (params.search?.trim()) {
      const term = `%${params.search.trim()}%`;
      whereClause = and(
        whereClause,
        or(
          ilike(bills.billNumber, term),
          ilike(bills.externalReference, term),
          ilike(bills.sourceExternalReference, term),
          ilike(bills.comments, term),
        )!,
      );
    }

    const [data, countResult] = await Promise.all([
      this.db
        .select()
        .from(bills)
        .where(whereClause)
        .orderBy(...buildBillsOrderBy(params.sort))
        .limit(limit)
        .offset(skip),
      this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(bills)
        .where(whereClause),
    ]);

    const total = countResult[0]?.count ?? 0;
    return { data, total };
  }

  async findOne(params: {
    id: string;
    tenantId: string;
  }): Promise<BillRow | null> {
    const [row] = await this.db
      .select()
      .from(bills)
      .where(
        and(eq(bills.id, params.id), eq(bills.tenantId, params.tenantId)),
      )
      .limit(1);
    return row ?? null;
  }

  async findByJob(params: {
    jobId: string;
    tenantId: string;
  }): Promise<BillRow[]> {
    return this.db
      .select()
      .from(bills)
      .where(
        and(
          eq(bills.jobId, params.jobId),
          eq(bills.tenantId, params.tenantId),
        ),
      )
      .orderBy(desc(bills.updatedAt));
  }

  async findByPurchaseOrder(params: {
    purchaseOrderId: string;
    tenantId: string;
  }): Promise<BillRow[]> {
    return this.db
      .select()
      .from(bills)
      .where(
        and(
          eq(bills.purchaseOrderId, params.purchaseOrderId),
          eq(bills.tenantId, params.tenantId),
        ),
      )
      .orderBy(desc(bills.updatedAt));
  }

  async findByVendor(params: {
    vendorId: string;
    tenantId: string;
  }): Promise<BillRow[]> {
    return this.db
      .select()
      .from(bills)
      .where(
        and(
          eq(bills.vendorId, params.vendorId),
          eq(bills.tenantId, params.tenantId),
        ),
      )
      .orderBy(desc(bills.updatedAt));
  }

  async findByInvoice(params: {
    invoiceId: string;
    tenantId: string;
  }): Promise<BillRow[]> {
    return this.db
      .select()
      .from(bills)
      .where(
        and(
          eq(bills.invoiceId, params.invoiceId),
          eq(bills.tenantId, params.tenantId),
        ),
      )
      .orderBy(desc(bills.updatedAt));
  }

  async create(params: { data: BillInsert; tx?: DrizzleDbOrTx }): Promise<BillRow> {
    const db = params.tx ?? this.db;
    const [inserted] = await db
      .insert(bills)
      .values(params.data)
      .returning();
    return inserted;
  }

  async update(params: {
    id: string;
    data: Partial<BillInsert>;
    tx?: DrizzleDbOrTx;
  }): Promise<BillRow | null> {
    const db = params.tx ?? this.db;
    const [updated] = await db
      .update(bills)
      .set({ ...params.data, updatedAt: new Date() })
      .where(eq(bills.id, params.id))
      .returning();
    return updated ?? null;
  }
}
