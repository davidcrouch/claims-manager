import { Injectable } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { eq, and, desc, sql } from 'drizzle-orm';
import { DRIZZLE } from '../drizzle.module';
import type { DrizzleDB } from '../drizzle.module';
import { bills } from '../schema';

export type BillRow = typeof bills.$inferSelect;
export type BillInsert = typeof bills.$inferInsert;

@Injectable()
export class BillsRepository {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async findAll(params: {
    tenantId: string;
    page?: number;
    limit?: number;
    jobId?: string;
    purchaseOrderId?: string;
    vendorId?: string;
    invoiceId?: string;
  }): Promise<{ data: BillRow[]; total: number }> {
    const page = params.page ?? 1;
    const limit = Math.min(params.limit ?? 20, 100);
    const skip = (page - 1) * limit;

    let whereClause = and(
      eq(bills.tenantId, params.tenantId),
      eq(bills.isDeleted, false),
    );
    if (params.jobId) {
      whereClause = and(whereClause, eq(bills.jobId, params.jobId));
    }
    if (params.purchaseOrderId) {
      whereClause = and(whereClause, eq(bills.purchaseOrderId, params.purchaseOrderId));
    }
    if (params.vendorId) {
      whereClause = and(whereClause, eq(bills.vendorId, params.vendorId));
    }
    if (params.invoiceId) {
      whereClause = and(whereClause, eq(bills.invoiceId, params.invoiceId));
    }

    const [data, countResult] = await Promise.all([
      this.db
        .select()
        .from(bills)
        .where(whereClause)
        .orderBy(desc(bills.updatedAt))
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

  async create(params: { data: BillInsert }): Promise<BillRow> {
    const [inserted] = await this.db
      .insert(bills)
      .values(params.data)
      .returning();
    return inserted;
  }

  async update(params: {
    id: string;
    data: Partial<BillInsert>;
  }): Promise<BillRow | null> {
    const [updated] = await this.db
      .update(bills)
      .set({ ...params.data, updatedAt: new Date() })
      .where(eq(bills.id, params.id))
      .returning();
    return updated ?? null;
  }
}
