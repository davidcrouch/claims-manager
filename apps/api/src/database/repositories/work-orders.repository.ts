import { Injectable } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { eq, and, isNull, desc, asc, sql } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB, type DrizzleDbOrTx } from '../drizzle.module';
import { workOrders } from '../schema';

export type WorkOrderRow = typeof workOrders.$inferSelect;
export type WorkOrderInsert = typeof workOrders.$inferInsert;

function buildWorkOrdersOrderBy(sort?: string) {
  switch (sort) {
    case 'updated_at_asc':
      return [asc(workOrders.updatedAt)];
    case 'created_at_desc':
      return [desc(workOrders.createdAt)];
    case 'created_at_asc':
      return [asc(workOrders.createdAt)];
    case 'work_order_number_asc':
      return [asc(workOrders.workOrderNumber)];
    case 'work_order_number_desc':
      return [desc(workOrders.workOrderNumber)];
    case 'total_amount_asc':
      return [asc(workOrders.totalAmount)];
    case 'total_amount_desc':
      return [desc(workOrders.totalAmount)];
    case 'start_date_asc':
      return [asc(workOrders.startDate)];
    case 'start_date_desc':
      return [desc(workOrders.startDate)];
    case 'status_asc':
      return [asc(workOrders.statusLookupId)];
    case 'status_desc':
      return [desc(workOrders.statusLookupId)];
    case 'wo_type_asc':
      return [asc(workOrders.workOrderTypeLookupId)];
    case 'wo_type_desc':
      return [desc(workOrders.workOrderTypeLookupId)];
    case 'source_asc':
      return [asc(workOrders.sourceExternalReference)];
    case 'source_desc':
      return [desc(workOrders.sourceExternalReference)];
    case 'updated_at_desc':
    default:
      return [desc(workOrders.updatedAt)];
  }
}

@Injectable()
export class WorkOrdersRepository {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async findAll(params: {
    tenantId: string;
    page?: number;
    limit?: number;
    jobId?: string;
    purchaseOrderId?: string;
    sort?: string;
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
        .orderBy(...buildWorkOrdersOrderBy(params.sort))
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
