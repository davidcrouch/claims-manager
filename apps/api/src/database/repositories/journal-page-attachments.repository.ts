import { Injectable, Inject } from '@nestjs/common';
import { eq, and, asc, sql, inArray } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB } from '../drizzle.module';
import { journalPageAttachments } from '../schema';

export type JournalPageAttachmentRow = typeof journalPageAttachments.$inferSelect;
export type JournalPageAttachmentInsert = typeof journalPageAttachments.$inferInsert;

@Injectable()
export class JournalPageAttachmentsRepository {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async findByPage(params: {
    tenantId: string;
    journalPageId: string;
  }): Promise<JournalPageAttachmentRow[]> {
    return this.db
      .select()
      .from(journalPageAttachments)
      .where(
        and(
          eq(journalPageAttachments.tenantId, params.tenantId),
          eq(journalPageAttachments.journalPageId, params.journalPageId),
        ),
      )
      .orderBy(asc(journalPageAttachments.sortIndex));
  }

  async findByPageIds(params: {
    tenantId: string;
    journalPageIds: string[];
  }): Promise<JournalPageAttachmentRow[]> {
    if (params.journalPageIds.length === 0) return [];
    return this.db
      .select()
      .from(journalPageAttachments)
      .where(
        and(
          eq(journalPageAttachments.tenantId, params.tenantId),
          inArray(journalPageAttachments.journalPageId, params.journalPageIds),
        ),
      )
      .orderBy(asc(journalPageAttachments.sortIndex));
  }

  async findOne(params: {
    id: string;
    tenantId: string;
  }): Promise<JournalPageAttachmentRow | null> {
    const [row] = await this.db
      .select()
      .from(journalPageAttachments)
      .where(
        and(
          eq(journalPageAttachments.id, params.id),
          eq(journalPageAttachments.tenantId, params.tenantId),
        ),
      )
      .limit(1);
    return row ?? null;
  }

  async create(params: { data: JournalPageAttachmentInsert }): Promise<JournalPageAttachmentRow> {
    const [inserted] = await this.db
      .insert(journalPageAttachments)
      .values(params.data)
      .returning();
    return inserted;
  }

  async delete(params: { id: string; tenantId: string }): Promise<void> {
    await this.db
      .delete(journalPageAttachments)
      .where(
        and(
          eq(journalPageAttachments.id, params.id),
          eq(journalPageAttachments.tenantId, params.tenantId),
        ),
      );
  }

  async getNextSortIndex(params: { journalPageId: string; tenantId: string }): Promise<number> {
    const [result] = await this.db
      .select({ max: sql<number>`coalesce(max(sort_index), -1)::int` })
      .from(journalPageAttachments)
      .where(
        and(
          eq(journalPageAttachments.journalPageId, params.journalPageId),
          eq(journalPageAttachments.tenantId, params.tenantId),
        ),
      );
    return (result?.max ?? -1) + 1;
  }
}
