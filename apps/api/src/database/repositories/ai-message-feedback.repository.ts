import { Injectable, Inject } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB } from '../drizzle.module';
import { aiMessageFeedback } from '../schema';

@Injectable()
export class AiMessageFeedbackRepository {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async upsert(row: {
    tenantId: string;
    userId: string;
    conversationId: string;
    messageId: string;
    rating: 'positive' | 'negative';
    categories: string[];
    comment: string | null;
  }) {
    const [existing] = await this.db
      .select()
      .from(aiMessageFeedback)
      .where(
        and(
          eq(aiMessageFeedback.messageId, row.messageId),
          eq(aiMessageFeedback.userId, row.userId),
        ),
      )
      .limit(1);

    if (existing) {
      const [updated] = await this.db
        .update(aiMessageFeedback)
        .set({
          rating: row.rating,
          categories: row.categories,
          comment: row.comment,
          updatedAt: new Date(),
        })
        .where(eq(aiMessageFeedback.id, existing.id))
        .returning();
      return updated;
    }

    const [created] = await this.db
      .insert(aiMessageFeedback)
      .values({
        tenantId: row.tenantId,
        userId: row.userId,
        conversationId: row.conversationId,
        messageId: row.messageId,
        rating: row.rating,
        categories: row.categories,
        comment: row.comment,
      })
      .returning();
    return created;
  }

  async listByConversation(tenantId: string, conversationId: string, userId: string) {
    return this.db
      .select()
      .from(aiMessageFeedback)
      .where(
        and(
          eq(aiMessageFeedback.tenantId, tenantId),
          eq(aiMessageFeedback.conversationId, conversationId),
          eq(aiMessageFeedback.userId, userId),
        ),
      );
  }
}
