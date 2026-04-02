import { Injectable } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { eq, and, desc } from 'drizzle-orm';
import { DRIZZLE } from '../drizzle.module';
import type { DrizzleDB } from '../drizzle.module';
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

  async create(params: { data: AttachmentInsert }): Promise<AttachmentRow> {
    const [inserted] = await this.db.insert(attachments).values(params.data).returning();
    return inserted!;
  }

  async update(params: {
    id: string;
    data: Partial<AttachmentInsert>;
  }): Promise<AttachmentRow | null> {
    const [updated] = await this.db
      .update(attachments)
      .set({ ...params.data, updatedAt: new Date() })
      .where(eq(attachments.id, params.id))
      .returning();
    return updated ?? null;
  }
}
