import { Injectable, Inject } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DRIZZLE } from '../drizzle.module';
import type { DrizzleDB } from '../drizzle.module';
import { integrationProviders } from '../schema';

export type IntegrationProviderRow = typeof integrationProviders.$inferSelect;
export type IntegrationProviderInsert = typeof integrationProviders.$inferInsert;

@Injectable()
export class IntegrationProvidersRepository {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async findByCode(params: { code: string }): Promise<IntegrationProviderRow | null> {
    const [row] = await this.db
      .select()
      .from(integrationProviders)
      .where(eq(integrationProviders.code, params.code))
      .limit(1);
    return row ?? null;
  }

  async findAll(): Promise<IntegrationProviderRow[]> {
    return this.db.select().from(integrationProviders);
  }

  async create(params: { data: IntegrationProviderInsert }): Promise<IntegrationProviderRow> {
    const [inserted] = await this.db
      .insert(integrationProviders)
      .values(params.data)
      .returning();
    return inserted!;
  }
}
