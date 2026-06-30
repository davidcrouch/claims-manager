import { Injectable } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { eq, and, isNull, desc, asc, sql } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB, type DrizzleDbOrTx } from '../drizzle.module';
import { purchaseOrders } from '../schema';

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
    vendorId?: string;
    sort?: string;
  }): Promise<{ data: PurchaseOrderRow[]; total: number }> {
    const page = params.page ?? 1;
    const limit = Math.min(params.limit ?? 20, 100);
    const skip = (page - 1) * limit;

    let whereClause = and(
      eq(purchaseOrders.tenantId, params.tenantId),
      isNull(purchaseOrders.deletedAt),
    );
    if (params.jobId) {
      whereClause = and(whereClause, eq(purchaseOrders.jobId, params.jobId));
    }
    if (params.vendorId) {
      whereClause = and(whereClause, eq(purchaseOrders.vendorId, params.vendorId));
    }

    const [data, countResult] = await Promise.all([
      this.db
        .select()
        .from(purchaseOrders)
        .where(whereClause)
        .orderBy(...buildPurchaseOrdersOrderBy(params.sort))
        .limit(limit)
        .offset(skip),
      this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(purchaseOrders)
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
