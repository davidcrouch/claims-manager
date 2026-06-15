import { Injectable } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { eq, and, isNull, desc, sql } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB, type DrizzleDbOrTx } from '../drizzle.module';
import { workOrders } from '../schema';

export type WorkOrderRow = typeof workOrders.$inferSelect;
export type WorkOrderInsert = typeof workOrders.$inferInsert;

@Injectable()
export class WorkOrdersRepository {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async findAll(params: {
    tenantId: string;
    page?: number;
    limit?: number;
    jobId?: string;
    purchaseOrderId?: string;
  }): Promise<{ data: WorkOrderRow[]; total: number }> {
    const page = params.page ?? 1;
    const limit = Math.min(params.limit ?? 20, 100);
    const skip = (page - 1) * limit;

    let whereClause = and(
      eq(workOrders.tenantId, params.tenantId),
      isNull(workOrders.deletedAt),
    );
    if (params.jobId) {
      whereClause = and(whereClause, eq(workOrders.jobId, params.jobId));
    }
    if (params.purchaseOrderId) {
      whereClause = and(whereClause, eq(workOrders.purchaseOrderId, params.purchaseOrderId));
    }

    const [data, countResult] = await Promise.all([
      this.db
        .select()
        .from(workOrders)
        .where(whereClause)
        .orderBy(desc(workOrders.updatedAt))
        .limit(limit)
        .offset(skip),
      this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(workOrders)
        .where(whereClause),
    ]);

    const total = countResult[0]?.count ?? 0;
    return { data, total };
  }

  async findOne(params: { id: string; tenantId: string }): Promise<WorkOrderRow | null> {
    const [row] = await this.db
      .select()
      .from(workOrders)
      .where(and(eq(workOrders.id, params.id), eq(workOrders.tenantId, params.tenantId)))
      .limit(1);
    return row ?? null;
  }

  async findByJob(params: { jobId: string; tenantId: string }): Promise<WorkOrderRow[]> {
    return this.db
      .select()
      .from(workOrders)
      .where(and(eq(workOrders.jobId, params.jobId), eq(workOrders.tenantId, params.tenantId)))
      .orderBy(desc(workOrders.updatedAt));
  }

  async findByPurchaseOrder(params: {
    purchaseOrderId: string;
    tenantId: string;
  }): Promise<WorkOrderRow[]> {
    return this.db
      .select()
      .from(workOrders)
      .where(
        and(
          eq(workOrders.purchaseOrderId, params.purchaseOrderId),
          eq(workOrders.tenantId, params.tenantId),
        ),
      )
      .orderBy(desc(workOrders.updatedAt));
  }

  async create(params: { data: WorkOrderInsert; tx?: DrizzleDbOrTx }): Promise<WorkOrderRow> {
    const db = params.tx ?? this.db;
    const [row] = await db.insert(workOrders).values(params.data).returning();
    return row;
  }

  async update(params: {
    id: string;
    data: Partial<WorkOrderInsert>;
    tx?: DrizzleDbOrTx;
  }): Promise<WorkOrderRow | null> {
    const db = params.tx ?? this.db;
    const [updated] = await db
      .update(workOrders)
      .set({ ...params.data, updatedAt: new Date() })
      .where(eq(workOrders.id, params.id))
      .returning();
    return updated ?? null;
  }
}
