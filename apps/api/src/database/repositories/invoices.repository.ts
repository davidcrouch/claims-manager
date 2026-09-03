import { Injectable } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { eq, and, desc, asc, sql, inArray, or, ilike } from 'drizzle-orm';
import { normalizeListJobIds } from '../../common/list-job-filter';
import { DRIZZLE, type DrizzleDB, type DrizzleDbOrTx } from '../drizzle.module';
import { invoices } from '../schema';

export type InvoiceRow = typeof invoices.$inferSelect;
export type InvoiceInsert = typeof invoices.$inferInsert;

/** CW insurer invoice # (e.g. 781) on invoice_payload.invoiceNumber. */
const insurerInvoiceNumber = sql`(NULLIF(${invoices.invoicePayload}->>'invoiceNumber', ''))::numeric`;

function buildInvoicesOrderBy(sort?: string) {
  switch (sort) {
    case 'updated_at_asc':
      return [asc(invoices.updatedAt)];
    case 'created_at_desc':
      return [desc(invoices.createdAt)];
    case 'created_at_asc':
      return [asc(invoices.createdAt)];
    case 'invoice_number_asc':
      return [asc(invoices.invoiceNumber)];
    case 'invoice_number_desc':
      return [desc(invoices.invoiceNumber)];
    case 'insurer_ref_asc':
      return [asc(insurerInvoiceNumber)];
    case 'insurer_ref_desc':
      return [desc(insurerInvoiceNumber)];
    case 'total_amount_asc':
      return [asc(invoices.totalAmount)];
    case 'total_amount_desc':
      return [desc(invoices.totalAmount)];
    case 'issue_date_asc':
      return [asc(invoices.issueDate)];
    case 'issue_date_desc':
      return [desc(invoices.issueDate)];
    case 'status_asc':
      return [asc(invoices.statusLookupId)];
    case 'status_desc':
      return [desc(invoices.statusLookupId)];
    case 'updated_at_desc':
    default:
      return [desc(invoices.updatedAt)];
  }
}

@Injectable()
export class InvoicesRepository {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async findAll(params: {
    tenantId: string;
    page?: number;
    limit?: number;
    purchaseOrderId?: string;
    workOrderId?: string;
    jobId?: string;
    jobIds?: string[];
    /** Comma-separated status lookup IDs. */
    status?: string;
    /** @deprecated Use status. */
    statusId?: string;
    search?: string;
    sort?: string;
  }): Promise<{ data: InvoiceRow[]; total: number }> {
    const page = params.page ?? 1;
    const limit = Math.min(params.limit ?? 20, 100);
    const skip = (page - 1) * limit;

    const statusIds = (params.status ?? params.statusId)
      ?.split(',')
      .map((value) => value.trim())
      .filter(Boolean) ?? [];
    let whereClause = eq(invoices.tenantId, params.tenantId);
    if (params.purchaseOrderId) {
      whereClause = and(whereClause, eq(invoices.purchaseOrderId, params.purchaseOrderId))!;
    }
    if (params.workOrderId) {
      whereClause = and(whereClause, eq(invoices.workOrderId, params.workOrderId))!;
    }
    const jobIds = normalizeListJobIds({ jobId: params.jobId, jobIds: params.jobIds });
    if (jobIds) {
      if (jobIds.length === 0) return { data: [], total: 0 };
      whereClause = and(
        whereClause,
        jobIds.length === 1 ? eq(invoices.jobId, jobIds[0]) : inArray(invoices.jobId, jobIds),
      )!;
    }
    if (statusIds.length > 0) {
      whereClause = and(whereClause, inArray(invoices.statusLookupId, statusIds))!;
    }
    if (params.search?.trim()) {
      const term = `%${params.search.trim()}%`;
      whereClause = and(
        whereClause,
        or(
          ilike(invoices.invoiceNumber, term),
          ilike(invoices.internalNumber, term),
          sql`${invoices.invoicePayload}->>'invoiceNumber' ILIKE ${term}`,
          ilike(invoices.sourceExternalReference, term),
          ilike(invoices.comments, term),
        )!,
      )!;
    }

    const [data, countResult] = await Promise.all([
      this.db
        .select()
        .from(invoices)
        .where(whereClause)
        .orderBy(...buildInvoicesOrderBy(params.sort))
        .limit(limit)
        .offset(skip),
      this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(invoices)
        .where(whereClause),
    ]);

    const total = countResult[0]?.count ?? 0;
    return { data, total };
  }

  async findOne(params: { id: string; tenantId: string }): Promise<InvoiceRow | null> {
    const [row] = await this.db
      .select()
      .from(invoices)
      .where(and(eq(invoices.id, params.id), eq(invoices.tenantId, params.tenantId)))
      .limit(1);
    return row ?? null;
  }

  async findByPurchaseOrder(params: {
    purchaseOrderId: string;
    tenantId: string;
  }): Promise<InvoiceRow[]> {
    return this.db
      .select()
      .from(invoices)
      .where(
        and(
          eq(invoices.purchaseOrderId, params.purchaseOrderId),
          eq(invoices.tenantId, params.tenantId),
        ),
      )
      .orderBy(desc(invoices.updatedAt));
  }

  async findByJob(params: {
    jobId: string;
    tenantId: string;
  }): Promise<InvoiceRow[]> {
    return this.db
      .select()
      .from(invoices)
      .where(
        and(
          eq(invoices.jobId, params.jobId),
          eq(invoices.tenantId, params.tenantId),
        ),
      )
      .orderBy(desc(invoices.updatedAt));
  }

  async create(params: { data: InvoiceInsert; tx?: DrizzleDbOrTx }): Promise<InvoiceRow> {
    const db = params.tx ?? this.db;
    const [inserted] = await db.insert(invoices).values(params.data).returning();
    return inserted!;
  }

  async update(params: {
    id: string;
    data: Partial<InvoiceInsert>;
    tx?: DrizzleDbOrTx;
  }): Promise<InvoiceRow | null> {
    const db = params.tx ?? this.db;
    const [updated] = await db
      .update(invoices)
      .set({ ...params.data, updatedAt: new Date() })
      .where(eq(invoices.id, params.id))
      .returning();
    return updated ?? null;
  }

  async countByTenantAndDeleted(params: {
    tenantId: string;
    isDeleted: boolean;
  }): Promise<number> {
    const [r] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(invoices)
      .where(
        and(
          eq(invoices.tenantId, params.tenantId),
          eq(invoices.isDeleted, params.isDeleted),
        ),
      );
    return r?.count ?? 0;
  }
}
