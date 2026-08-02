import { Injectable, Inject } from '@nestjs/common';
import { and, desc, eq } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB } from '../drizzle.module';
import { aiUserMemory } from '../schema';

export type AiUserMemoryRow = typeof aiUserMemory.$inferSelect;
export type AiUserMemoryInsert = typeof aiUserMemory.$inferInsert;

@Injectable()
export class AiUserMemoryRepository {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async findByTenantAndUser(params: {
    tenantId: string;
    userId: string;
    scope?: string;
    scopeId?: string;
    limit?: number;
  }): Promise<AiUserMemoryRow[]> {
    const conditions = [
      eq(aiUserMemory.tenantId, params.tenantId),
      eq(aiUserMemory.userId, params.userId),
    ];
    if (params.scope) {
      conditions.push(eq(aiUserMemory.scope, params.scope));
    }
    if (params.scopeId) {
      conditions.push(eq(aiUserMemory.scopeId, params.scopeId));
    }
    return this.db
      .select()
      .from(aiUserMemory)
      .where(and(...conditions))
      .orderBy(desc(aiUserMemory.updatedAt))
      .limit(params.limit ?? 100);
  }

  async upsert(data: AiUserMemoryInsert): Promise<AiUserMemoryRow> {
    const [row] = await this.db
      .insert(aiUserMemory)
      .values(data)
      .onConflictDoUpdate({
        target: [aiUserMemory.tenantId, aiUserMemory.userId, aiUserMemory.key],
        set: {
          value: data.value,
          scope: data.scope,
          scopeId: data.scopeId,
          updatedAt: new Date(),
        },
      })
      .returning();
    return row!;
  }

  async deleteByKey(params: {
    tenantId: string;
    userId: string;
    key: string;
  }): Promise<void> {
    await this.db
      .delete(aiUserMemory)
      .where(
        and(
          eq(aiUserMemory.tenantId, params.tenantId),
          eq(aiUserMemory.userId, params.userId),
          eq(aiUserMemory.key, params.key),
        ),
      );
  }

  async deleteById(params: {
    tenantId: string;
    id: string;
  }): Promise<void> {
    await this.db
      .delete(aiUserMemory)
      .where(
        and(
          eq(aiUserMemory.tenantId, params.tenantId),
          eq(aiUserMemory.id, params.id),
        ),
      );
  }
}
