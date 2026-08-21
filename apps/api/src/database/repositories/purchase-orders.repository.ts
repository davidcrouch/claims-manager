import { Injectable } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { eq, and, isNull, desc, asc, sql, inArray, or, ilike, getTableColumns } from 'drizzle-orm';
import { normalizeListJobIds } from '../../common/list-job-filter';
import { DRIZZLE, type DrizzleDB, type DrizzleDbOrTx } from '../drizzle.module';
import { purchaseOrders, vendors } from '../schema';

export type PurchaseOrderRow = typeof purchaseOrders.$inferSelect;
export type PurchaseOrderInsert = typeof purchaseOrders.$inferInsert;

function buildPurchaseOrdersOrderBy(sort?: string) {
  switch (sort) {
    case 'updated_at_asc':
      return [asc(purchaseOrders.updatedAt)];
    case 'created_at_desc':
      return [desc(purchaseOrders.createdAt)];
    case 'created_at_asc':
      return [asc(purchaseOrders.createdAt)];
    case 'purchase_order_number_asc':
      return [asc(purchaseOrders.purchaseOrderNumber)];
    case 'purchase_order_number_desc':
      return [desc(purchaseOrders.purchaseOrderNumber)];
    case 'total_amount_asc':
      return [asc(purchaseOrders.totalAmount)];
    case 'total_amount_desc':
      return [desc(purchaseOrders.totalAmount)];
    case 'external_id_asc':
      return [asc(purchaseOrders.externalId)];
    case 'external_id_desc':
      return [desc(purchaseOrders.externalId)];
    case 'status_asc':
      return [asc(purchaseOrders.statusLookupId)];
    case 'status_desc':
      return [desc(purchaseOrders.statusLookupId)];
    case 'vendor_asc':
      return [asc(purchaseOrders.vendorId)];
    case 'vendor_desc':
      return [desc(purchaseOrders.vendorId)];
    case 'updated_at_desc':
    default:
      return [desc(purchaseOrders.updatedAt)];
  }
}

@Injectable()
export class PurchaseOrdersRepository {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async findAll(params: {
    tenantId: string;
    page?: number;
    limit?: number;
    jobId?: string;
    jobIds?: string[];
    /** Comma-separated status lookup IDs. */
    status?: string;
    vendorId?: string;
    ownershipStatus?: string;
    captureMethod?: string;
    search?: string;
    sort?: string;
  }): Promise<{ data: PurchaseOrderRow[]; total: number }> {
    const page = params.page ?? 1;
    const limit = Math.min(params.limit ?? 20, 100);
    const skip = (page - 1) * limit;

    let whereClause = and(
      eq(purchaseOrders.tenantId, params.tenantId),
      isNull(purchaseOrders.deletedAt),
    );
    const jobIds = normalizeListJobIds({ jobId: params.jobId, jobIds: params.jobIds });
    if (jobIds) {
      if (jobIds.length === 0) return { data: [], total: 0 };
      whereClause = and(
        whereClause,
        jobIds.length === 1
          ? eq(purchaseOrders.jobId, jobIds[0])
          : inArray(purchaseOrders.jobId, jobIds),
      );
    }
    const statusIds = params.status?.split(',').map((value) => value.trim()).filter(Boolean) ?? [];
    const vendorIds = params.vendorId?.split(',').map((value) => value.trim()).filter(Boolean) ?? [];
    if (statusIds.length > 0) {
      whereClause = and(whereClause, inArray(purchaseOrders.statusLookupId, statusIds));
    }
    if (vendorIds.length > 0) {
      whereClause = and(whereClause, inArray(purchaseOrders.vendorId, vendorIds));
    }
    if (params.ownershipStatus) {
      whereClause = and(whereClause, eq(purchaseOrders.ownershipStatus, params.ownershipStatus));
    }
    if (params.captureMethod) {
      whereClause = and(whereClause, eq(purchaseOrders.captureMethod, params.captureMethod));
    }
    if (params.search?.trim()) {
      const term = `%${params.search.trim()}%`;
      whereClause = and(
        whereClause,
        or(
          ilike(purchaseOrders.purchaseOrderNumber, term),
          ilike(purchaseOrders.name, term),
          ilike(purchaseOrders.externalId, term),
          ilike(purchaseOrders.poForName, term),
          ilike(vendors.name, term),
        )!,
      );
    }

    const [data, countResult] = await Promise.all([
      this.db
        .select(getTableColumns(purchaseOrders))
        .from(purchaseOrders)
        .leftJoin(vendors, eq(purchaseOrders.vendorId, vendors.id))
        .where(whereClause)
        .orderBy(...buildPurchaseOrdersOrderBy(params.sort))
        .limit(limit)
        .offset(skip),
      this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(purchaseOrders)
        .leftJoin(vendors, eq(purchaseOrders.vendorId, vendors.id))
        .where(whereClause),
    ]);

    const total = countResult[0]?.count ?? 0;
    return { data, total };
  }

  async findOne(params: { id: string; tenantId: string }): Promise<PurchaseOrderRow | null> {
    const [row] = await this.db
      .select()
      .from(purchaseOrders)
      .where(and(eq(purchaseOrders.id, params.id), eq(purchaseOrders.tenantId, params.tenantId)))
      .limit(1);
    return row ?? null;
  }

  async findByJob(params: { jobId: string; tenantId: string }): Promise<PurchaseOrderRow[]> {
    return this.db
      .select()
      .from(purchaseOrders)
      .where(and(eq(purchaseOrders.jobId, params.jobId), eq(purchaseOrders.tenantId, params.tenantId)))
      .orderBy(desc(purchaseOrders.updatedAt));
  }

  async create(params: {
    data: PurchaseOrderInsert;
    tx?: DrizzleDbOrTx;
  }): Promise<PurchaseOrderRow> {
    const db = params.tx ?? this.db;
    const [inserted] = await db
      .insert(purchaseOrders)
      .values({ ...params.data, createdAt: new Date() })
      .returning();
    return inserted;
  }

  async update(params: {
    id: string;
    data: Partial<PurchaseOrderInsert>;
    tx?: DrizzleDbOrTx;
  }): Promise<PurchaseOrderRow | null> {
    const db = params.tx ?? this.db;
    const [updated] = await db
      .update(purchaseOrders)
      .set({ ...params.data, updatedAt: new Date() })
      .where(eq(purchaseOrders.id, params.id))
      .returning();
    return updated ?? null;
  }
}
