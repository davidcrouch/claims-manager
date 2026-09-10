import { Injectable, Inject } from '@nestjs/common';
import { eq, and, desc } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB, type DrizzleDbOrTx } from '../drizzle.module';
import { invoicePayments } from '../schema';

export type InvoicePaymentRow = typeof invoicePayments.$inferSelect;
export type InvoicePaymentInsert = typeof invoicePayments.$inferInsert;

@Injectable()
export class InvoicePaymentsRepository {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async findByInvoice(params: {
    invoiceId: string;
    tenantId: string;
    tx?: DrizzleDbOrTx;
  }): Promise<InvoicePaymentRow[]> {
    const db = params.tx ?? this.db;
    return db
      .select()
      .from(invoicePayments)
      .where(
        and(
          eq(invoicePayments.invoiceId, params.invoiceId),
          eq(invoicePayments.tenantId, params.tenantId),
        ),
      )
      .orderBy(desc(invoicePayments.receivedAt), desc(invoicePayments.createdAt));
  }

  async findOne(params: {
    id: string;
    invoiceId: string;
    tenantId: string;
    tx?: DrizzleDbOrTx;
  }): Promise<InvoicePaymentRow | null> {
    const db = params.tx ?? this.db;
    const [row] = await db
      .select()
      .from(invoicePayments)
      .where(
        and(
          eq(invoicePayments.id, params.id),
          eq(invoicePayments.invoiceId, params.invoiceId),
          eq(invoicePayments.tenantId, params.tenantId),
        ),
      )
      .limit(1);
    return row ?? null;
  }

  async create(params: {
    data: InvoicePaymentInsert;
    tx?: DrizzleDbOrTx;
  }): Promise<InvoicePaymentRow> {
    const db = params.tx ?? this.db;
    const [inserted] = await db.insert(invoicePayments).values(params.data).returning();
    return inserted!;
  }

  async update(params: {
    id: string;
    tenantId: string;
    data: Partial<InvoicePaymentInsert>;
    tx?: DrizzleDbOrTx;
  }): Promise<InvoicePaymentRow | null> {
    const db = params.tx ?? this.db;
    const [updated] = await db
      .update(invoicePayments)
      .set(params.data)
      .where(
        and(
          eq(invoicePayments.id, params.id),
          eq(invoicePayments.tenantId, params.tenantId),
        ),
      )
      .returning();
    return updated ?? null;
  }

  async delete(params: {
    id: string;
    invoiceId: string;
    tenantId: string;
    tx?: DrizzleDbOrTx;
  }): Promise<InvoicePaymentRow | null> {
    const db = params.tx ?? this.db;
    const [deleted] = await db
      .delete(invoicePayments)
      .where(
        and(
          eq(invoicePayments.id, params.id),
          eq(invoicePayments.invoiceId, params.invoiceId),
          eq(invoicePayments.tenantId, params.tenantId),
        ),
      )
      .returning();
    return deleted ?? null;
  }
}

