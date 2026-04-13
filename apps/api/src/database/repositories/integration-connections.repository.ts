import { Injectable, Inject } from '@nestjs/common';
import { eq, and } from 'drizzle-orm';
import { DRIZZLE } from '../drizzle.module';
import type { DrizzleDB } from '../drizzle.module';
import { integrationConnections, integrationProviders } from '../schema';

export type IntegrationConnectionRow = typeof integrationConnections.$inferSelect;
export type IntegrationConnectionInsert = typeof integrationConnections.$inferInsert;

@Injectable()
export class IntegrationConnectionsRepository {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async findById(params: { id: string }): Promise<IntegrationConnectionRow | null> {
    const [row] = await this.db
      .select()
      .from(integrationConnections)
      .where(eq(integrationConnections.id, params.id))
      .limit(1);
    return row ?? null;
  }

  async findByTenantAndProvider(params: {
    tenantId: string;
    providerCode: string;
  }): Promise<IntegrationConnectionRow | null> {
    const [row] = await this.db
      .select({ connection: integrationConnections })
      .from(integrationConnections)
      .innerJoin(
        integrationProviders,
        eq(integrationConnections.providerId, integrationProviders.id),
      )
      .where(
        and(
          eq(integrationConnections.tenantId, params.tenantId),
          eq(integrationProviders.code, params.providerCode),
          eq(integrationConnections.isActive, true),
        ),
      )
      .limit(1);
    return row?.connection ?? null;
  }

  async findByTenantIdAndClient(params: {
    providerTenantId: string;
    clientIdentifier: string;
  }): Promise<IntegrationConnectionRow | null> {
    const [row] = await this.db
      .select()
      .from(integrationConnections)
      .where(
        and(
          eq(integrationConnections.providerTenantId, params.providerTenantId),
          eq(integrationConnections.clientIdentifier, params.clientIdentifier),
          eq(integrationConnections.isActive, true),
        ),
      )
      .limit(1);
    return row ?? null;
  }

  async findAll(params: { tenantId: string }): Promise<IntegrationConnectionRow[]> {
    return this.db
      .select()
      .from(integrationConnections)
      .where(eq(integrationConnections.tenantId, params.tenantId));
  }

  async create(params: {
    data: IntegrationConnectionInsert;
  }): Promise<IntegrationConnectionRow> {
    const [inserted] = await this.db
      .insert(integrationConnections)
      .values(params.data)
      .returning();
    return inserted!;
  }

  async findByProviderId(params: { providerId: string }): Promise<IntegrationConnectionRow[]> {
    return this.db
      .select()
      .from(integrationConnections)
      .where(eq(integrationConnections.providerId, params.providerId));
  }

  async update(params: {
    id: string;
    data: Partial<IntegrationConnectionInsert>;
  }): Promise<IntegrationConnectionRow | null> {
    const [updated] = await this.db
      .update(integrationConnections)
      .set({ ...params.data, updatedAt: new Date() })
      .where(eq(integrationConnections.id, params.id))
      .returning();
    return updated ?? null;
  }
}
