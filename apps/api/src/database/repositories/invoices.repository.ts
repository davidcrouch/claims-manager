import { Injectable } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { eq, and, desc, sql } from 'drizzle-orm';
import { DRIZZLE } from '../drizzle.module';
import type { DrizzleDB } from '../drizzle.module';
import { invoices } from '../schema';

export type InvoiceRow = typeof invoices.$inferSelect;
export type InvoiceInsert = typeof invoices.$inferInsert;

@Injectable()
export class InvoicesRepository {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async findAll(params: {
    tenantId: string;
    page?: number;
    limit?: number;
    purchaseOrderId?: string;
    statusId?: string;
  }): Promise<{ data: InvoiceRow[]; total: number }> {
    const page = params.page ?? 1;
    const limit = Math.min(params.limit ?? 20, 100);
    const skip = (page - 1) * limit;

    let whereClause = eq(invoices.tenantId, params.tenantId);
    if (params.purchaseOrderId) {
      whereClause = and(whereClause, eq(invoices.purchaseOrderId, params.purchaseOrderId))!;
    }
    if (params.statusId) {
      whereClause = and(whereClause, eq(invoices.statusLookupId, params.statusId))!;
    }

    const [data, countResult] = await Promise.all([
      this.db
        .select()
        .from(invoices)
        .where(whereClause)
        .orderBy(desc(invoices.updatedAt))
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

  async create(params: { data: InvoiceInsert }): Promise<InvoiceRow> {
    const [inserted] = await this.db.insert(invoices).values(params.data).returning();
    return inserted!;
  }

  async update(params: {
    id: string;
    data: Partial<InvoiceInsert>;
  }): Promise<InvoiceRow | null> {
    const [updated] = await this.db
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
