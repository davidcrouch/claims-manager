import { Injectable, Inject } from '@nestjs/common';
import { eq, and } from 'drizzle-orm';
import { DRIZZLE } from '../drizzle.module';
import type { DrizzleDB } from '../drizzle.module';
import { users } from '../schema';

export type UserRow = typeof users.$inferSelect;
export type UserInsert = typeof users.$inferInsert;

@Injectable()
export class UsersRepository {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async findById(params: { id: string }): Promise<UserRow | null> {
    const [row] = await this.db
      .select()
      .from(users)
      .where(eq(users.id, params.id))
      .limit(1);
    return row ?? null;
  }

  async findByKindeUserId(params: { kindeUserId: string }): Promise<UserRow | null> {
    const [row] = await this.db
      .select()
      .from(users)
      .where(eq(users.kindeUserId, params.kindeUserId))
      .limit(1);
    return row ?? null;
  }

  async findByTenant(params: { tenantId: string }): Promise<UserRow[]> {
    return this.db
      .select()
      .from(users)
      .where(eq(users.tenantId, params.tenantId));
  }

  async create(params: { data: UserInsert }): Promise<UserRow> {
    const [inserted] = await this.db.insert(users).values(params.data).returning();
    return inserted!;
  }

  async update(params: { id: string; data: Partial<UserInsert> }): Promise<UserRow | null> {
    const [updated] = await this.db
      .update(users)
      .set({ ...params.data, updatedAt: new Date() })
      .where(eq(users.id, params.id))
      .returning();
    return updated ?? null;
  }
}
