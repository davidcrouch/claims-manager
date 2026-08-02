import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { createNativeMCPClient } from './mcp-client';
import {
  McpIntegrationRepository,
  type McpConnectionRow,
  type McpIntegrationRow,
  type McpToolManifestRow,
} from '../../database/repositories/mcp-integration.repository';
import type { ApiKeyAuthConfig, CachedTool, McpAuthConfig } from './mcp-integration.types';
import { MCP_LIMITS, parseCategoryFromDescription } from './mcp-integration.types';
import { validateResolvedIp } from './mcp-ssrf-guard';

const logger = new Logger('McpToolManifestService');

export interface ResolvedMcpCredential {
  token?: string;
  apiKey?: string;
}

@Injectable()
export class McpToolManifestService {
  constructor(private readonly repo: McpIntegrationRepository) {}

  async getManifestForConnection(
    connectionId: string,
  ): Promise<McpToolManifestRow | null> {
    return this.repo.findManifestByConnectionId(connectionId);
  }

  async discoverAndCache(
    connection: McpConnectionRow,
    integration: McpIntegrationRow,
    credential?: ResolvedMcpCredential,
  ): Promise<McpToolManifestRow> {
    const headers = this.buildAuthHeaders(connection, integration, credential);

    await validateResolvedIp(new URL(integration.url).hostname);

    const mcpClient = await createNativeMCPClient({
      transportType: integration.transportType as 'http' | 'sse',
      url: integration.url,
      headers,
    });

    let toolDefs: Array<{
      name: string;
      description?: string;
      inputSchema?: Record<string, unknown>;
    }> = [];

    try {
      toolDefs = await mcpClient.listTools();
    } finally {
      await mcpClient.close();
    }

    const manifest: CachedTool[] = toolDefs
      .slice(0, MCP_LIMITS.TOOLS_PER_SERVER)
      .map((tool) => {
        const rawDescription = tool.description ?? '';
        const { category, cleanDescription } =
          parseCategoryFromDescription(rawDescription);
        return {
          name: tool.name,
          description: cleanDescription,
          inputSchema: tool.inputSchema ?? {},
          ...(category ? { category } : {}),
        };
      });

    const schemaHash = createHash('sha256')
      .update(JSON.stringify(manifest))
      .digest('hex');

    const existing = await this.getManifestForConnection(connection.id);

    if (existing?.schemaHash === schemaHash) {
      const touched = await this.repo.touchManifest(connection.id);
      if (touched) return touched;
    }

    const saved = await this.repo.upsertManifest({
      connectionId: connection.id,
      schemaHash,
      toolCount: manifest.length,
      manifest,
    });

    logger.log(
      `[McpToolManifestService.discoverAndCache] cached ${manifest.length} tools for connection ${connection.id}`,
    );

    return saved;
  }

  isStale(manifest: McpToolManifestRow): boolean {
    const ageMs = Date.now() - new Date(manifest.lastRefreshedAt).getTime();
    return ageMs > MCP_LIMITS.MANIFEST_CACHE_TTL_MS;
  }

  private buildAuthHeaders(
    connection: McpConnectionRow,
    integration: McpIntegrationRow,
    credential?: ResolvedMcpCredential,
  ): Record<string, string> {
    const headers: Record<string, string> = {};

    if (connection.authType === 'api_key' && credential?.apiKey) {
      const authConfig = (integration.authConfig as McpAuthConfig)?.api_key as
        | ApiKeyAuthConfig
        | undefined;
      const headerName = authConfig?.headerName ?? 'Authorization';
      const prefix = authConfig?.headerPrefix;
      headers[headerName] = prefix
        ? `${prefix} ${credential.apiKey}`
        : credential.apiKey;
    } else if (
      (connection.authType === 'bearer_passthrough' ||
        connection.authType === 'oauth') &&
      credential?.token
    ) {
      headers['Authorization'] = `Bearer ${credential.token}`;
    }

    return headers;
  }
}
