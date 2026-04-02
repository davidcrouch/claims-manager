import { Injectable, Inject } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DRIZZLE } from '../drizzle.module';
import type { DrizzleDB } from '../drizzle.module';
import { tenants } from '../schema';

export type TenantRow = typeof tenants.$inferSelect;
export type TenantInsert = typeof tenants.$inferInsert;

@Injectable()
export class TenantsRepository {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async findById(params: { id: string }): Promise<TenantRow | null> {
    const [row] = await this.db
      .select()
      .from(tenants)
      .where(eq(tenants.id, params.id))
      .limit(1);
    return row ?? null;
  }

  async findBySlug(params: { slug: string }): Promise<TenantRow | null> {
    const [row] = await this.db
      .select()
      .from(tenants)
      .where(eq(tenants.slug, params.slug))
      .limit(1);
    return row ?? null;
  }

  async findAll(): Promise<TenantRow[]> {
    return this.db.select().from(tenants);
  }

  async create(params: { data: TenantInsert }): Promise<TenantRow> {
    const [inserted] = await this.db.insert(tenants).values(params.data).returning();
    return inserted!;
  }

  async update(params: { id: string; data: Partial<TenantInsert> }): Promise<TenantRow | null> {
    const [updated] = await this.db
      .update(tenants)
      .set({ ...params.data, updatedAt: new Date() })
      .where(eq(tenants.id, params.id))
      .returning();
    return updated ?? null;
  }
}
