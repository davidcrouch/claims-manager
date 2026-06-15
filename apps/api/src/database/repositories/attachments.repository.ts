import { Injectable } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { eq, and, desc } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB, type DrizzleDbOrTx } from '../drizzle.module';
import { attachments } from '../schema';

export type AttachmentRow = typeof attachments.$inferSelect;
export type AttachmentInsert = typeof attachments.$inferInsert;

@Injectable()
export class AttachmentsRepository {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async findOne(params: { id: string; tenantId: string }): Promise<AttachmentRow | null> {
    const [row] = await this.db
      .select()
      .from(attachments)
      .where(and(eq(attachments.id, params.id), eq(attachments.tenantId, params.tenantId)))
      .limit(1);
    return row ?? null;
  }

  async findByRelatedRecord(params: {
    tenantId: string;
    relatedRecordType: string;
    relatedRecordId: string;
  }): Promise<AttachmentRow[]> {
    return this.db
      .select()
      .from(attachments)
      .where(
        and(
          eq(attachments.tenantId, params.tenantId),
          eq(attachments.relatedRecordType, params.relatedRecordType),
          eq(attachments.relatedRecordId, params.relatedRecordId),
        ),
      )
      .orderBy(desc(attachments.createdAt));
  }

  async create(params: { data: AttachmentInsert; tx?: DrizzleDbOrTx }): Promise<AttachmentRow> {
    const db = params.tx ?? this.db;
    const [inserted] = await db.insert(attachments).values(params.data).returning();
    return inserted!;
  }

  async update(params: {
    id: string;
    data: Partial<AttachmentInsert>;
    tx?: DrizzleDbOrTx;
  }): Promise<AttachmentRow | null> {
    const db = params.tx ?? this.db;
    const [updated] = await db
      .update(attachments)
      .set({ ...params.data, updatedAt: new Date() })
      .where(eq(attachments.id, params.id))
      .returning();
    return updated ?? null;
  }
}
