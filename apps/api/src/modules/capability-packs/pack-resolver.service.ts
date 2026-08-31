import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { and, eq, isNull } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB } from '../../database/drizzle.module';
import {
  mcpConnection,
  mcpIntegration,
  mcpToolManifest,
} from '../../database/schema';
import { McpIntegrationRepository } from '../../database/repositories/mcp-integration.repository';
import {
  buildNamespacedToolId,
  type CachedTool,
} from '../mcp-integration/mcp-integration.types';
import { McpToolManifestService } from '../mcp-integration/mcp-tool-manifest.service';
import {
  claimsMcpIntegrationUrl,
  knownClaimsMcpIntegrationByName,
} from './known-claims-mcp';
import { matchToolNames, unmatchedExactToolNames } from './pack-tool-matcher';

const LOG = 'PackResolverService';

@Injectable()
export class PackResolverService {
  private readonly logger = new Logger(LOG);

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly manifestService: McpToolManifestService,
    private readonly mcpRepo: McpIntegrationRepository,
  ) {}

  /**
   * Ensure each named MCP integration exists for the tenant (creating first-party
   * Claims * mounts when missing), then return org-shared connection ids.
   */
  async resolveIntegrationConnections(params: {
    tenantId: string;
    integrationNames: string[];
  }): Promise<Map<string, { integrationId: string; connectionId: string }>> {
    const map = new Map<string, { integrationId: string; connectionId: string }>();
    for (const name of params.integrationNames) {
      const ensured = await this.ensureIntegration({
        tenantId: params.tenantId,
        name,
      });
      map.set(name, ensured);
    }
    return map;
  }

  private async ensureIntegration(params: {
    tenantId: string;
    name: string;
  }): Promise<{ integrationId: string; connectionId: string }> {
    const known = knownClaimsMcpIntegrationByName(params.name);
    const url = claimsMcpIntegrationUrl(params.name);

    let [integration] = await this.db
      .select()
      .from(mcpIntegration)
      .where(
        and(
          eq(mcpIntegration.tenantId, params.tenantId),
          eq(mcpIntegration.name, params.name),
        ),
      )
      .limit(1);

    if (!integration) {
      if (!known || !url) {
        throw new BadRequestException(
          `MCP integration "${params.name}" is not installed and is not a known Claims MCP mount. Create it under MCP Servers first, or reference Claims Operations / Documents / Filesystem / AI / Organisation / Tools.`,
        );
      }
      const [created] = await this.db
        .insert(mcpIntegration)
        .values({
          tenantId: params.tenantId,
          name: known.name,
          description: known.description,
          url,
          transportType: 'http',
          supportedAuthTypes: ['bearer_passthrough'],
          authConfig: {},
          visibility: 'org',
          status: 'active',
          trustedServer: true,
          sharedConnectionPolicy: 'org_shared',
        })
        .returning();
      integration = created;
      this.logger.log(
        `[${LOG}.ensureIntegration] created "${params.name}" → ${url} id=${integration.id}`,
      );
    } else if (known && url && integration.url !== url) {
      await this.db
        .update(mcpIntegration)
        .set({
          url,
          description: known.description,
          status: 'active',
          trustedServer: true,
          supportedAuthTypes: ['bearer_passthrough'],
          updatedAt: new Date(),
        })
        .where(eq(mcpIntegration.id, integration.id));
      this.logger.log(
        `[${LOG}.ensureIntegration] updated "${params.name}" url → ${url}`,
      );
    }

    let [conn] = await this.db
      .select()
      .from(mcpConnection)
      .where(
        and(
          eq(mcpConnection.tenantId, params.tenantId),
          eq(mcpConnection.integrationId, integration.id),
          isNull(mcpConnection.deletedAt),
          isNull(mcpConnection.userId),
        ),
      )
      .limit(1);

    if (!conn) {
      if (!known) {
        throw new NotFoundException(
          `No org-shared MCP connection for integration "${params.name}".`,
        );
      }
      const [createdConn] = await this.db
        .insert(mcpConnection)
        .values({
          integrationId: integration.id,
          tenantId: params.tenantId,
          userId: null,
          authType: 'bearer_passthrough',
          status: 'connected',
          visibility: 'org',
          enabled: true,
        })
        .returning();
      conn = createdConn;
      this.logger.log(
        `[${LOG}.ensureIntegration] created org connection for "${params.name}" id=${conn.id}`,
      );
    }

    return { integrationId: integration.id, connectionId: conn.id };
  }

  async ensureManifests(
    connectionIds: string[],
    opts?: { force?: boolean },
  ): Promise<void> {
    for (const connectionId of connectionIds) {
      const [existing] = await this.db
        .select()
        .from(mcpToolManifest)
        .where(eq(mcpToolManifest.connectionId, connectionId))
        .limit(1);
      const hasCache =
        !!existing?.manifest &&
        Array.isArray(existing.manifest) &&
        existing.manifest.length > 0;
      if (hasCache && !opts?.force) {
        continue;
      }
      try {
        const conn = await this.mcpRepo.findConnectionById(connectionId);
        if (!conn) continue;
        const integration = await this.mcpRepo.findIntegrationById(conn.integrationId);
        if (!integration) continue;
        await this.manifestService.discoverAndCache(conn, integration);
      } catch (err) {
        this.logger.warn(
          `[${LOG}.ensureManifests] refresh failed for ${connectionId}: ${String(err)}`,
        );
      }
    }
  }

  async resolveEnabledToolRefs(params: {
    connectionIds: string[];
    toolPatterns: string[];
  }): Promise<string[]> {
    if (!params.toolPatterns.length) return [];

    const out = new Set<string>();
    for (const connectionId of params.connectionIds) {
      const [row] = await this.db
        .select()
        .from(mcpToolManifest)
        .where(eq(mcpToolManifest.connectionId, connectionId))
        .limit(1);
      const tools = (row?.manifest as CachedTool[] | null) ?? [];
      const toolNames = tools.map((t) => t.name);
      const matched = matchToolNames({
        toolNames,
        patterns: params.toolPatterns,
      });
      for (const name of matched) {
        out.add(buildNamespacedToolId(connectionId, name));
      }
      const unmatched = unmatchedExactToolNames({
        toolNames,
        patterns: params.toolPatterns,
      });
      if (unmatched.length > 0) {
        this.logger.warn(
          `[${LOG}.resolveEnabledToolRefs] cached manifest missing tools for ${connectionId}: ${unmatched.join(', ')} — binding them anyway`,
        );
        for (const name of unmatched) {
          out.add(buildNamespacedToolId(connectionId, name));
        }
      }
    }
    return [...out];
  }
}
