import { Injectable, Inject } from '@nestjs/common';
import { and, eq, gt, isNull, lt, or, sql } from 'drizzle-orm';
import { DRIZZLE } from '../drizzle.module';
import type { DrizzleDB } from '../drizzle.module';
import {
  mcpConnection,
  mcpIntegration,
  mcpOauthState,
  mcpToolManifest,
} from '../schema';

export type McpIntegrationRow = typeof mcpIntegration.$inferSelect;
export type McpIntegrationInsert = typeof mcpIntegration.$inferInsert;
export type McpConnectionRow = typeof mcpConnection.$inferSelect;
export type McpConnectionInsert = typeof mcpConnection.$inferInsert;
export type McpToolManifestRow = typeof mcpToolManifest.$inferSelect;
export type McpToolManifestInsert = typeof mcpToolManifest.$inferInsert;
export type McpOauthStateRow = typeof mcpOauthState.$inferSelect;
export type McpOauthStateInsert = typeof mcpOauthState.$inferInsert;

@Injectable()
export class McpIntegrationRepository {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  // ── Integrations ──

  async countIntegrationsByTenant(tenantId: string): Promise<number> {
    const [row] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(mcpIntegration)
      .where(eq(mcpIntegration.tenantId, tenantId));
    return row?.count ?? 0;
  }

  async findIntegrationsForUser(params: {
    tenantId: string;
    userId: string;
  }): Promise<McpIntegrationRow[]> {
    return this.db
      .select()
      .from(mcpIntegration)
      .where(
        and(
          eq(mcpIntegration.tenantId, params.tenantId),
          or(
            eq(mcpIntegration.visibility, 'public'),
            eq(mcpIntegration.visibility, 'org'),
            and(
              eq(mcpIntegration.visibility, 'private'),
              eq(mcpIntegration.createdByUserId, params.userId),
            ),
          ),
        ),
      );
  }

  async findIntegrationById(id: string): Promise<McpIntegrationRow | null> {
    const [row] = await this.db
      .select()
      .from(mcpIntegration)
      .where(eq(mcpIntegration.id, id))
      .limit(1);
    return row ?? null;
  }

  async createIntegration(
    data: McpIntegrationInsert,
  ): Promise<McpIntegrationRow> {
    const [inserted] = await this.db
      .insert(mcpIntegration)
      .values(data)
      .returning();
    return inserted!;
  }

  async updateIntegration(
    id: string,
    data: Partial<McpIntegrationInsert>,
  ): Promise<McpIntegrationRow | null> {
    const [updated] = await this.db
      .update(mcpIntegration)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(mcpIntegration.id, id))
      .returning();
    return updated ?? null;
  }

  async deleteIntegration(id: string): Promise<boolean> {
    const deleted = await this.db
      .delete(mcpIntegration)
      .where(eq(mcpIntegration.id, id))
      .returning({ id: mcpIntegration.id });
    return deleted.length > 0;
  }

  // ── Connections ──

  async countConnectionsByTenant(tenantId: string): Promise<number> {
    const [row] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(mcpConnection)
      .where(
        and(eq(mcpConnection.tenantId, tenantId), isNull(mcpConnection.deletedAt)),
      );
    return row?.count ?? 0;
  }

  async countConnectionsByUser(params: {
    tenantId: string;
    userId: string;
  }): Promise<number> {
    const [row] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(mcpConnection)
      .where(
        and(
          eq(mcpConnection.tenantId, params.tenantId),
          eq(mcpConnection.userId, params.userId),
          isNull(mcpConnection.deletedAt),
        ),
      );
    return row?.count ?? 0;
  }

  async findConnectionsForUser(params: {
    tenantId: string;
    userId: string;
  }): Promise<McpConnectionRow[]> {
    return this.db
      .select()
      .from(mcpConnection)
      .where(
        and(
          eq(mcpConnection.tenantId, params.tenantId),
          isNull(mcpConnection.deletedAt),
          or(
            eq(mcpConnection.visibility, 'org'),
            and(
              eq(mcpConnection.visibility, 'private'),
              eq(mcpConnection.userId, params.userId),
            ),
          ),
        ),
      );
  }

  async findConnectionById(id: string): Promise<McpConnectionRow | null> {
    const [row] = await this.db
      .select()
      .from(mcpConnection)
      .where(and(eq(mcpConnection.id, id), isNull(mcpConnection.deletedAt)))
      .limit(1);
    return row ?? null;
  }

  async findSoftDeletedConnection(params: {
    tenantId: string;
    integrationId: string;
    userId: string | null;
  }): Promise<McpConnectionRow | null> {
    const userCondition = params.userId
      ? eq(mcpConnection.userId, params.userId)
      : isNull(mcpConnection.userId);

    const [row] = await this.db
      .select()
      .from(mcpConnection)
      .where(
        and(
          eq(mcpConnection.tenantId, params.tenantId),
          eq(mcpConnection.integrationId, params.integrationId),
          userCondition,
          sql`${mcpConnection.deletedAt} IS NOT NULL`,
        ),
      )
      .limit(1);
    return row ?? null;
  }

  async findLiveConnection(params: {
    tenantId: string;
    integrationId: string;
    userId: string | null;
  }): Promise<McpConnectionRow | null> {
    const userCondition = params.userId
      ? eq(mcpConnection.userId, params.userId)
      : isNull(mcpConnection.userId);

    const [row] = await this.db
      .select()
      .from(mcpConnection)
      .where(
        and(
          eq(mcpConnection.tenantId, params.tenantId),
          eq(mcpConnection.integrationId, params.integrationId),
          userCondition,
          isNull(mcpConnection.deletedAt),
        ),
      )
      .limit(1);
    return row ?? null;
  }

  async createConnection(
    data: McpConnectionInsert,
  ): Promise<McpConnectionRow> {
    const [inserted] = await this.db
      .insert(mcpConnection)
      .values(data)
      .returning();
    return inserted!;
  }

  async reactivateConnection(
    id: string,
    data: Partial<McpConnectionInsert>,
  ): Promise<McpConnectionRow> {
    const [updated] = await this.db
      .update(mcpConnection)
      .set({
        ...data,
        deletedAt: null,
        updatedAt: new Date(),
      })
      .where(eq(mcpConnection.id, id))
      .returning();
    return updated!;
  }

  async updateConnection(
    id: string,
    data: Partial<McpConnectionInsert>,
  ): Promise<McpConnectionRow | null> {
    const [updated] = await this.db
      .update(mcpConnection)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(mcpConnection.id, id))
      .returning();
    return updated ?? null;
  }

  async softDeleteConnection(id: string): Promise<void> {
    await this.db
      .update(mcpConnection)
      .set({
        status: 'revoked',
        deletedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(mcpConnection.id, id));
  }

  // ── Tool manifests ──

  async findManifestByConnectionId(
    connectionId: string,
  ): Promise<McpToolManifestRow | null> {
    const [row] = await this.db
      .select()
      .from(mcpToolManifest)
      .where(eq(mcpToolManifest.connectionId, connectionId))
      .limit(1);
    return row ?? null;
  }

  async upsertManifest(params: {
    connectionId: string;
    schemaHash: string;
    toolCount: number;
    manifest: unknown;
    refreshNow?: boolean;
  }): Promise<McpToolManifestRow> {
    const now = new Date();
    const existing = await this.findManifestByConnectionId(params.connectionId);

    if (existing) {
      const [updated] = await this.db
        .update(mcpToolManifest)
        .set({
          schemaHash: params.schemaHash,
          toolCount: params.toolCount,
          manifest: params.manifest,
          lastRefreshedAt: now,
          updatedAt: now,
        })
        .where(eq(mcpToolManifest.connectionId, params.connectionId))
        .returning();
      return updated!;
    }

    const [created] = await this.db
      .insert(mcpToolManifest)
      .values({
        connectionId: params.connectionId,
        schemaHash: params.schemaHash,
        toolCount: params.toolCount,
        manifest: params.manifest,
        lastRefreshedAt: now,
      })
      .returning();
    return created!;
  }

  async touchManifest(connectionId: string): Promise<McpToolManifestRow | null> {
    const now = new Date();
    const [updated] = await this.db
      .update(mcpToolManifest)
      .set({ lastRefreshedAt: now, updatedAt: now })
      .where(eq(mcpToolManifest.connectionId, connectionId))
      .returning();
    return updated ?? null;
  }

  // ── OAuth states ──

  async createOauthState(
    data: McpOauthStateInsert,
  ): Promise<McpOauthStateRow> {
    const [inserted] = await this.db
      .insert(mcpOauthState)
      .values(data)
      .returning();
    return inserted!;
  }

  async findValidOauthStateByState(
    state: string,
  ): Promise<McpOauthStateRow | null> {
    const [row] = await this.db
      .select()
      .from(mcpOauthState)
      .where(
        and(
          eq(mcpOauthState.state, state),
          gt(mcpOauthState.expiresAt, new Date()),
        ),
      )
      .limit(1);
    return row ?? null;
  }

  async deleteOauthState(id: string): Promise<void> {
    await this.db.delete(mcpOauthState).where(eq(mcpOauthState.id, id));
  }

  async deleteExpiredOauthStates(): Promise<number> {
    const deleted = await this.db
      .delete(mcpOauthState)
      .where(lt(mcpOauthState.expiresAt, new Date()))
      .returning({ id: mcpOauthState.id });
    return deleted.length;
  }
}
