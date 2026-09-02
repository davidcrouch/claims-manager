import { Injectable, Inject } from '@nestjs/common';
import { eq, and, desc } from 'drizzle-orm';
import { DRIZZLE } from '../drizzle.module';
import type { DrizzleDB, DrizzleDbOrTx } from '../drizzle.module';
import { poSendRequests, poSendRecipients } from '../schema';

export type PoSendRequestRow = typeof poSendRequests.$inferSelect;
export type PoSendRequestInsert = typeof poSendRequests.$inferInsert;
export type PoSendRecipientRow = typeof poSendRecipients.$inferSelect;
export type PoSendRecipientInsert = typeof poSendRecipients.$inferInsert;

@Injectable()
export class PoSendRequestsRepository {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async findAllByPurchaseOrder(params: {
    tenantId: string;
    purchaseOrderId: string;
  }): Promise<PoSendRequestRow[]> {
    return this.db
      .select()
      .from(poSendRequests)
      .where(
        and(
          eq(poSendRequests.tenantId, params.tenantId),
          eq(poSendRequests.purchaseOrderId, params.purchaseOrderId),
        ),
      )
      .orderBy(desc(poSendRequests.createdAt));
  }

  async findById(params: {
    tenantId: string;
    id: string;
  }): Promise<PoSendRequestRow | null> {
    const rows = await this.db
      .select()
      .from(poSendRequests)
      .where(
        and(eq(poSendRequests.tenantId, params.tenantId), eq(poSendRequests.id, params.id)),
      );
    return rows[0] ?? null;
  }

  async create(params: {
    data: PoSendRequestInsert;
    tx?: DrizzleDbOrTx;
  }): Promise<PoSendRequestRow> {
    const db = params.tx ?? this.db;
    const [row] = await db.insert(poSendRequests).values(params.data).returning();
    return row;
  }

  async updateStatus(params: {
    id: string;
    status: string;
    tx?: DrizzleDbOrTx;
  }): Promise<void> {
    const db = params.tx ?? this.db;
    await db
      .update(poSendRequests)
      .set({ status: params.status, updatedAt: new Date() })
      .where(eq(poSendRequests.id, params.id));
  }

  async findRecipientsByRequestId(params: {
    sendRequestId: string;
  }): Promise<PoSendRecipientRow[]> {
    return this.db
      .select()
      .from(poSendRecipients)
      .where(eq(poSendRecipients.sendRequestId, params.sendRequestId));
  }

  async createRecipients(params: {
    data: PoSendRecipientInsert[];
    tx?: DrizzleDbOrTx;
  }): Promise<PoSendRecipientRow[]> {
    const db = params.tx ?? this.db;
    if (params.data.length === 0) return [];
    return db.insert(poSendRecipients).values(params.data).returning();
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
      .update(poSendRecipients)
      .set(setFields)
      .where(eq(poSendRecipients.id, params.id));
  }
}
