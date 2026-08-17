import { Injectable, Inject } from '@nestjs/common';
import { eq, and } from 'drizzle-orm';
import { DRIZZLE } from '../drizzle.module';
import type { DrizzleDB } from '../drizzle.module';
import { connectionIdentifiers, integrationConnections } from '../schema';
import type { IntegrationConnectionRow } from './integration-connections.repository';

export type ConnectionIdentifierRow = typeof connectionIdentifiers.$inferSelect;
export type ConnectionIdentifierInsert = typeof connectionIdentifiers.$inferInsert;

@Injectable()
export class ConnectionIdentifiersRepository {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  /**
   * Resolve a connection by any known external identifier value + client.
   * Joins through connection_identifiers to integration_connections.
   */
  async findConnectionByIdentifier(params: {
    identifierValue: string;
    clientIdentifier: string;
  }): Promise<IntegrationConnectionRow | null> {
    const rows = await this.db
      .select({ connection: integrationConnections })
      .from(connectionIdentifiers)
      .innerJoin(
        integrationConnections,
        eq(connectionIdentifiers.connectionId, integrationConnections.id),
      )
      .where(
        and(
          eq(connectionIdentifiers.identifierValue, params.identifierValue),
          eq(integrationConnections.clientIdentifier, params.clientIdentifier),
          eq(integrationConnections.isActive, true),
        ),
      )
      .limit(1);
    return rows[0]?.connection ?? null;
  }

  async findByConnectionId(params: {
    connectionId: string;
  }): Promise<ConnectionIdentifierRow[]> {
    return this.db
      .select()
      .from(connectionIdentifiers)
      .where(eq(connectionIdentifiers.connectionId, params.connectionId));
  }

  async create(params: {
    data: ConnectionIdentifierInsert;
  }): Promise<ConnectionIdentifierRow> {
    const [inserted] = await this.db
      .insert(connectionIdentifiers)
      .values(params.data)
      .returning();
    return inserted!;
  }

  async delete(params: { id: string }): Promise<boolean> {
    const [deleted] = await this.db
      .delete(connectionIdentifiers)
      .where(eq(connectionIdentifiers.id, params.id))
      .returning();
    return !!deleted;
  }

  async deleteByConnectionId(params: { connectionId: string }): Promise<number> {
    const deleted = await this.db
      .delete(connectionIdentifiers)
      .where(eq(connectionIdentifiers.connectionId, params.connectionId))
      .returning();
    return deleted.length;
  }
}
