import { Injectable, Inject } from '@nestjs/common';
import { eq, and, desc } from 'drizzle-orm';
import { DRIZZLE } from '../drizzle.module';
import type { DrizzleDB, DrizzleDbOrTx } from '../drizzle.module';
import { invoiceSendRequests, invoiceSendRecipients } from '../schema';

export type InvoiceSendRequestRow = typeof invoiceSendRequests.$inferSelect;
export type InvoiceSendRequestInsert = typeof invoiceSendRequests.$inferInsert;
export type InvoiceSendRecipientRow = typeof invoiceSendRecipients.$inferSelect;
export type InvoiceSendRecipientInsert = typeof invoiceSendRecipients.$inferInsert;

@Injectable()
export class InvoiceSendRequestsRepository {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async findAllByInvoice(params: {
    tenantId: string;
    invoiceId: string;
  }): Promise<InvoiceSendRequestRow[]> {
    return this.db
      .select()
      .from(invoiceSendRequests)
      .where(
        and(
          eq(invoiceSendRequests.tenantId, params.tenantId),
          eq(invoiceSendRequests.invoiceId, params.invoiceId),
        ),
      )
      .orderBy(desc(invoiceSendRequests.createdAt));
  }

  async findById(params: {
    tenantId: string;
    id: string;
  }): Promise<InvoiceSendRequestRow | null> {
    const rows = await this.db
      .select()
      .from(invoiceSendRequests)
      .where(
        and(
          eq(invoiceSendRequests.tenantId, params.tenantId),
          eq(invoiceSendRequests.id, params.id),
        ),
      );
    return rows[0] ?? null;
  }

  async create(params: {
    data: InvoiceSendRequestInsert;
    tx?: DrizzleDbOrTx;
  }): Promise<InvoiceSendRequestRow> {
    const db = params.tx ?? this.db;
    const [row] = await db.insert(invoiceSendRequests).values(params.data).returning();
    return row;
  }

  async updateStatus(params: {
    id: string;
    status: string;
    tx?: DrizzleDbOrTx;
  }): Promise<void> {
    const db = params.tx ?? this.db;
    await db
      .update(invoiceSendRequests)
      .set({ status: params.status, updatedAt: new Date() })
      .where(eq(invoiceSendRequests.id, params.id));
  }

  async findRecipientsByRequestId(params: {
    sendRequestId: string;
  }): Promise<InvoiceSendRecipientRow[]> {
    return this.db
      .select()
      .from(invoiceSendRecipients)
      .where(eq(invoiceSendRecipients.sendRequestId, params.sendRequestId));
  }

  async createRecipients(params: {
    data: InvoiceSendRecipientInsert[];
    tx?: DrizzleDbOrTx;
  }): Promise<InvoiceSendRecipientRow[]> {
    const db = params.tx ?? this.db;
    if (params.data.length === 0) return [];
    return db.insert(invoiceSendRecipients).values(params.data).returning();
  }

  async updateRecipientStatus(params: {
    id: string;
    status: string;
    errorMessage?: string | null;
    resendMessageId?: string | null;
    sentAt?: Date | null;
    retryCount?: number;
    recipientEmail?: string;
    tx?: DrizzleDbOrTx;
  }): Promise<void> {
    const db = params.tx ?? this.db;
    const setFields: Record<string, unknown> = {
      status: params.status,
      updatedAt: new Date(),
    };
    if (params.errorMessage !== undefined) setFields.errorMessage = params.errorMessage;
    if (params.resendMessageId !== undefined) setFields.resendMessageId = params.resendMessageId;
    if (params.sentAt !== undefined) setFields.sentAt = params.sentAt;
    if (params.retryCount !== undefined) setFields.retryCount = params.retryCount;
    if (params.recipientEmail !== undefined) setFields.recipientEmail = params.recipientEmail;

    await db
      .update(invoiceSendRecipients)
      .set(setFields)
      .where(eq(invoiceSendRecipients.id, params.id));
  }
}
