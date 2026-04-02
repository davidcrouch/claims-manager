import { Injectable } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { eq, and, isNull, desc, sql } from 'drizzle-orm';
import { DRIZZLE } from '../drizzle.module';
import type { DrizzleDB } from '../drizzle.module';
import { purchaseOrders } from '../schema';

export type PurchaseOrderRow = typeof purchaseOrders.$inferSelect;
export type PurchaseOrderInsert = typeof purchaseOrders.$inferInsert;

@Injectable()
export class PurchaseOrdersRepository {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async findAll(params: {
    tenantId: string;
    page?: number;
    limit?: number;
    jobId?: string;
    vendorId?: string;
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
        .orderBy(desc(purchaseOrders.updatedAt))
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

  async update(params: {
    id: string;
    data: Partial<PurchaseOrderInsert>;
  }): Promise<PurchaseOrderRow | null> {
    const [updated] = await this.db
      .update(purchaseOrders)
      .set({ ...params.data, updatedAt: new Date() })
      .where(eq(purchaseOrders.id, params.id))
      .returning();
    return updated ?? null;
  }
}
