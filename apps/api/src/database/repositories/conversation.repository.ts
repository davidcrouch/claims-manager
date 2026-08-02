import { Injectable, Inject } from '@nestjs/common';
import { and, desc, eq, ilike } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB } from '../drizzle.module';
import { chatConversation, conversationShare } from '../schema';

export type ChatConversationRow = typeof chatConversation.$inferSelect;
export type ChatConversationInsert = typeof chatConversation.$inferInsert;

export type ConversationShareRow = typeof conversationShare.$inferSelect;
export type ConversationShareInsert = typeof conversationShare.$inferInsert;

@Injectable()
export class ConversationRepository {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async findByUser(params: {
    tenantId: string;
    userId: string;
    search?: string;
  }): Promise<ChatConversationRow[]> {
    const conditions = [
      eq(chatConversation.tenantId, params.tenantId),
      eq(chatConversation.userId, params.userId),
    ];

    if (params.search?.trim()) {
      conditions.push(ilike(chatConversation.title, `%${params.search.trim()}%`));
    }

    return this.db
      .select()
      .from(chatConversation)
      .where(and(...conditions))
      .orderBy(desc(chatConversation.updatedAt));
  }

  async findById(
    id: string,
    tenantId: string,
  ): Promise<ChatConversationRow | null> {
    const [row] = await this.db
      .select()
      .from(chatConversation)
      .where(
        and(eq(chatConversation.id, id), eq(chatConversation.tenantId, tenantId)),
      )
      .limit(1);
    return row ?? null;
  }

  async create(data: ChatConversationInsert): Promise<ChatConversationRow> {
    const [inserted] = await this.db
      .insert(chatConversation)
      .values(data)
      .returning();
    return inserted!;
  }

  async update(
    id: string,
    tenantId: string,
    data: Partial<ChatConversationInsert>,
  ): Promise<ChatConversationRow | null> {
    const [updated] = await this.db
      .update(chatConversation)
      .set({ ...data, updatedAt: new Date() })
      .where(
        and(eq(chatConversation.id, id), eq(chatConversation.tenantId, tenantId)),
      )
      .returning();
    return updated ?? null;
  }

  async delete(id: string, tenantId: string): Promise<boolean> {
    const deleted = await this.db
      .delete(chatConversation)
      .where(
        and(eq(chatConversation.id, id), eq(chatConversation.tenantId, tenantId)),
      )
      .returning({ id: chatConversation.id });
    return deleted.length > 0;
  }

  async createShare(data: ConversationShareInsert): Promise<ConversationShareRow> {
    const [inserted] = await this.db
      .insert(conversationShare)
      .values(data)
      .returning();
    return inserted!;
  }

  async findShareByToken(token: string): Promise<ConversationShareRow | null> {
    const [row] = await this.db
      .select()
      .from(conversationShare)
      .where(eq(conversationShare.shareToken, token))
      .limit(1);
    return row ?? null;
  }
}
