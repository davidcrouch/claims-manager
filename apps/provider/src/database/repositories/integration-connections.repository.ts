import { Injectable, Inject } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB } from '../drizzle.module';
import { integrationConnections } from '../schema';

export type IntegrationConnectionRow = typeof integrationConnections.$inferSelect;

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
}
