import { Injectable, Inject } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB } from '../drizzle.module';
import { agent } from '../schema';

export type AgentRow = typeof agent.$inferSelect;
export type AgentInsert = typeof agent.$inferInsert;

@Injectable()
export class AgentRepository {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async findByTenant(tenantId: string): Promise<AgentRow[]> {
    return this.db
      .select()
      .from(agent)
      .where(eq(agent.tenantId, tenantId));
  }

  async findById(id: string, tenantId: string): Promise<AgentRow | null> {
    const [row] = await this.db
      .select()
      .from(agent)
      .where(and(eq(agent.id, id), eq(agent.tenantId, tenantId)))
      .limit(1);
    return row ?? null;
  }

  async findDefaultByTenant(tenantId: string): Promise<AgentRow | null> {
    const [row] = await this.db
      .select()
      .from(agent)
      .where(and(eq(agent.tenantId, tenantId), eq(agent.isDefault, true)))
      .limit(1);
    return row ?? null;
  }

  async findFirstChatEnabled(tenantId: string): Promise<AgentRow | null> {
    const [row] = await this.db
      .select()
      .from(agent)
      .where(and(eq(agent.tenantId, tenantId), eq(agent.chatEnabled, true)))
      .limit(1);
    return row ?? null;
  }

  async countByTenant(tenantId: string): Promise<number> {
    const rows = await this.db
      .select({ id: agent.id })
      .from(agent)
      .where(eq(agent.tenantId, tenantId));
    return rows.length;
  }

  async findBySlug(tenantId: string, slug: string): Promise<AgentRow | null> {
    const [row] = await this.db
      .select()
      .from(agent)
      .where(and(eq(agent.tenantId, tenantId), eq(agent.slug, slug)))
      .limit(1);
    return row ?? null;
  }

  async create(data: AgentInsert): Promise<AgentRow> {
    const [inserted] = await this.db.insert(agent).values(data).returning();
    return inserted!;
  }

  async update(
    id: string,
    tenantId: string,
    data: Partial<AgentInsert>,
  ): Promise<AgentRow | null> {
    const [updated] = await this.db
      .update(agent)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(agent.id, id), eq(agent.tenantId, tenantId)))
      .returning();
    return updated ?? null;
  }

  async delete(id: string, tenantId: string): Promise<boolean> {
    const deleted = await this.db
      .delete(agent)
      .where(and(eq(agent.id, id), eq(agent.tenantId, tenantId)))
      .returning({ id: agent.id });
    return deleted.length > 0;
  }
}
