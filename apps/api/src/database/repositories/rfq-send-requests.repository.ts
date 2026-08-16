import { Injectable, Inject } from '@nestjs/common';
import { eq, and, desc } from 'drizzle-orm';
import { DRIZZLE } from '../drizzle.module';
import type { DrizzleDB, DrizzleDbOrTx } from '../drizzle.module';
import { rfqSendRequests, rfqSendRecipients } from '../schema';

export type RfqSendRequestRow = typeof rfqSendRequests.$inferSelect;
export type RfqSendRequestInsert = typeof rfqSendRequests.$inferInsert;
export type RfqSendRecipientRow = typeof rfqSendRecipients.$inferSelect;
export type RfqSendRecipientInsert = typeof rfqSendRecipients.$inferInsert;

@Injectable()
export class RfqSendRequestsRepository {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async findAllByRfq(params: {
    tenantId: string;
    rfqId: string;
  }): Promise<RfqSendRequestRow[]> {
    return this.db
      .select()
      .from(rfqSendRequests)
      .where(
        and(
          eq(rfqSendRequests.tenantId, params.tenantId),
          eq(rfqSendRequests.rfqId, params.rfqId),
        ),
      )
      .orderBy(desc(rfqSendRequests.createdAt));
  }

  async findById(params: {
    tenantId: string;
    id: string;
  }): Promise<RfqSendRequestRow | null> {
    const rows = await this.db
      .select()
      .from(rfqSendRequests)
      .where(
        and(
          eq(rfqSendRequests.tenantId, params.tenantId),
          eq(rfqSendRequests.id, params.id),
        ),
      );
    return rows[0] ?? null;
  }

  async create(params: {
    data: RfqSendRequestInsert;
    tx?: DrizzleDbOrTx;
  }): Promise<RfqSendRequestRow> {
    const db = params.tx ?? this.db;
    const [row] = await db
      .insert(rfqSendRequests)
      .values(params.data)
      .returning();
    return row;
  }

  async updateStatus(params: {
    id: string;
    status: string;
    tx?: DrizzleDbOrTx;
  }): Promise<void> {
    const db = params.tx ?? this.db;
    await db
      .update(rfqSendRequests)
      .set({ status: params.status, updatedAt: new Date() })
      .where(eq(rfqSendRequests.id, params.id));
  }

  async findRecipientsByRequestId(params: {
    sendRequestId: string;
  }): Promise<RfqSendRecipientRow[]> {
    return this.db
      .select()
      .from(rfqSendRecipients)
      .where(eq(rfqSendRecipients.sendRequestId, params.sendRequestId));
  }

  async findRecipientById(params: {
    id: string;
  }): Promise<RfqSendRecipientRow | null> {
    const rows = await this.db
      .select()
      .from(rfqSendRecipients)
      .where(eq(rfqSendRecipients.id, params.id));
    return rows[0] ?? null;
  }

  async createRecipients(params: {
    data: RfqSendRecipientInsert[];
    tx?: DrizzleDbOrTx;
  }): Promise<RfqSendRecipientRow[]> {
    const db = params.tx ?? this.db;
    if (params.data.length === 0) return [];
    return db
      .insert(rfqSendRecipients)
      .values(params.data)
      .returning();
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
      .update(rfqSendRecipients)
      .set(setFields)
      .where(eq(rfqSendRecipients.id, params.id));
  }
}
