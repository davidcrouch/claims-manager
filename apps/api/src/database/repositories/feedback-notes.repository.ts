import { Injectable, Inject } from '@nestjs/common';
import { eq, and, asc, inArray } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB, type DrizzleDbOrTx } from '../drizzle.module';
import { feedbackNotes } from '../schema';

export type FeedbackNoteRow = typeof feedbackNotes.$inferSelect;
export type FeedbackNoteInsert = typeof feedbackNotes.$inferInsert;

@Injectable()
export class FeedbackNotesRepository {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async findByFeedbackItem(params: {
    feedbackItemId: string;
    tenantId: string;
    tx?: DrizzleDbOrTx;
  }): Promise<FeedbackNoteRow[]> {
    const db = params.tx ?? this.db;
    return db
      .select()
      .from(feedbackNotes)
      .where(
        and(
          eq(feedbackNotes.feedbackItemId, params.feedbackItemId),
          eq(feedbackNotes.tenantId, params.tenantId),
        ),
      )
      .orderBy(asc(feedbackNotes.createdAt), asc(feedbackNotes.id));
  }

  async findByFeedbackItemIds(params: {
    feedbackItemIds: string[];
    tenantId: string;
    tx?: DrizzleDbOrTx;
  }): Promise<FeedbackNoteRow[]> {
    if (params.feedbackItemIds.length === 0) return [];
    const db = params.tx ?? this.db;
    return db
      .select()
      .from(feedbackNotes)
      .where(
        and(
          eq(feedbackNotes.tenantId, params.tenantId),
          inArray(feedbackNotes.feedbackItemId, params.feedbackItemIds),
        ),
      )
      .orderBy(asc(feedbackNotes.createdAt), asc(feedbackNotes.id));
  }

  async findOne(params: {
    id: string;
    feedbackItemId: string;
    tenantId: string;
    tx?: DrizzleDbOrTx;
  }): Promise<FeedbackNoteRow | null> {
    const db = params.tx ?? this.db;
    const [row] = await db
      .select()
      .from(feedbackNotes)
      .where(
        and(
          eq(feedbackNotes.id, params.id),
          eq(feedbackNotes.feedbackItemId, params.feedbackItemId),
          eq(feedbackNotes.tenantId, params.tenantId),
        ),
      )
      .limit(1);
    return row ?? null;
  }

  async create(params: {
    data: FeedbackNoteInsert;
    tx?: DrizzleDbOrTx;
  }): Promise<FeedbackNoteRow> {
    const db = params.tx ?? this.db;
    const [inserted] = await db.insert(feedbackNotes).values(params.data).returning();
    return inserted!;
  }

  async update(params: {
    id: string;
    tenantId: string;
    body: string;
    tx?: DrizzleDbOrTx;
  }): Promise<FeedbackNoteRow | null> {
    const db = params.tx ?? this.db;
    const [updated] = await db
      .update(feedbackNotes)
      .set({ body: params.body, updatedAt: new Date() })
      .where(
        and(
          eq(feedbackNotes.id, params.id),
          eq(feedbackNotes.tenantId, params.tenantId),
        ),
      )
      .returning();
    return updated ?? null;
  }

  async delete(params: {
    id: string;
    tenantId: string;
    tx?: DrizzleDbOrTx;
  }): Promise<FeedbackNoteRow | null> {
    const db = params.tx ?? this.db;
    const [deleted] = await db
      .delete(feedbackNotes)
      .where(
        and(
          eq(feedbackNotes.id, params.id),
          eq(feedbackNotes.tenantId, params.tenantId),
        ),
      )
      .returning();
    return deleted ?? null;
  }
}
