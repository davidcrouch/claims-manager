import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { createNativeMCPClient } from './mcp-client';
import {
  McpIntegrationRepository,
  type McpConnectionRow,
  type McpIntegrationRow,
} from '../../database/repositories/mcp-integration.repository';
import { TenantContext } from '../../tenant/tenant-context';
import type { AuthenticatedUser } from '../../auth/interfaces/authenticated-user.interface';
import {
  decryptJsonFromTransit,
  encryptJsonForTransit,
  storeCredentialSecret,
  loadCredentialSecret,
  deleteCredentialSecret,
} from './credential-transit';
import { McpToolManifestService } from './mcp-tool-manifest.service';
import { validateMcpUrl } from './mcp-ssrf-guard';
import type {
  AuthServerMetadata,
  CreateConnectionDto,
  CreateIntegrationDto,
  DiscoverServerDto,
  McpAuthConfig,
  McpAuthType,
  McpServerDiscoveryResult,
  McpToolGroupResponse,
  ProtectedResourceMetadata,
  TestConnectionDto,
  UpdateIntegrationDto,
} from './mcp-integration.types';
import {
  MCP_LIMITS,
  buildNamespacedToolId,
} from './mcp-integration.types';
import type { CachedTool } from './mcp-integration.types';

const logger = new Logger('McpIntegrationService');

/** Encrypted credential blob stored directly in credential_ref (prod can upgrade to Secret Manager). */
interface StoredApiKeyCredential {
  apiKey: string;
}

interface StoredOAuthCredential {
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
  tokenType: string;
  scope?: string;
}

@Injectable()
export class McpIntegrationService {
  constructor(
    private readonly repo: McpIntegrationRepository,
    private readonly tenantContext: TenantContext,
    private readonly manifestService: McpToolManifestService,
  ) {}

  // ── Integration CRUD ──

  async listIntegrations(userId: string): Promise<McpIntegrationRow[]> {
    const tenantId = this.tenantContext.getTenantId();
    return this.repo.findIntegrationsForUser({ tenantId, userId });
  }

  async getIntegration(
    integrationId: string,
    userId: string,
  ): Promise<McpIntegrationRow> {
    const integration = await this.repo.findIntegrationById(integrationId);
    if (!integration) {
      throw new NotFoundException(
        '[McpIntegrationService.getIntegration] integration not found',
      );
    }

    this.assertIntegrationVisible(integration, userId);
    return integration;
  }

  async createIntegration(
    user: AuthenticatedUser,
    dto: CreateIntegrationDto,
  ): Promise<McpIntegrationRow> {
    const tenantId = this.tenantContext.getTenantId();
    await validateMcpUrl(dto.url);

    const count = await this.repo.countIntegrationsByTenant(tenantId);
    if (count >= MCP_LIMITS.INTEGRATIONS_PER_ORG) {
      throw new BadRequestException(
        `[McpIntegrationService.createIntegration] maximum integrations per org reached (${MCP_LIMITS.INTEGRATIONS_PER_ORG})`,
      );
    }

    const visibility = dto.visibility ?? 'org';
    const authConfig = { ...(dto.authConfig ?? {}) } as Record<string, unknown>;

    if (dto.clientSecret) {
      authConfig.clientSecretEnc = encryptJsonForTransit({
        clientSecret: dto.clientSecret,
      });
      authConfig.clientSecretLast4 = `••••${dto.clientSecret.slice(-4)}`;
    }

    const created = await this.repo.createIntegration({
      tenantId,
      createdByUserId: user.sub,
      name: dto.name.trim(),
      description: dto.description?.trim(),
      url: dto.url.trim(),
      transportType: dto.transportType ?? 'http',
      supportedAuthTypes: dto.supportedAuthTypes,
      authConfig,
      visibility,
      status: 'active',
      trustedServer: false,
      sharedConnectionPolicy: dto.sharedConnectionPolicy ?? 'user_required',
    });

    logger.log(
      `[McpIntegrationService.createIntegration] created integration ${created.id}`,
    );
    return created;
  }

  async updateIntegration(
    integrationId: string,
    user: AuthenticatedUser,
    dto: UpdateIntegrationDto,
  ): Promise<McpIntegrationRow> {
    const existing = await this.getIntegration(integrationId, user.sub);
    this.assertCanManageIntegration(existing, user);

    if (dto.url) {
      await validateMcpUrl(dto.url);
    }

    const setClause: Partial<McpIntegrationRow> = {};
    if (dto.name !== undefined) setClause.name = dto.name.trim();
    if (dto.description !== undefined) {
      setClause.description = dto.description?.trim();
    }
    if (dto.url !== undefined) setClause.url = dto.url.trim();
    if (dto.transportType !== undefined) {
      setClause.transportType = dto.transportType;
    }
    if (dto.supportedAuthTypes !== undefined) {
      setClause.supportedAuthTypes = dto.supportedAuthTypes;
    }
    if (dto.authConfig !== undefined) {
      const incoming = { ...dto.authConfig } as Record<string, unknown>;
      const existingConfig = (existing.authConfig ?? {}) as Record<
        string,
        unknown
      >;
      if (existingConfig.clientSecretLast4 && !dto.clientSecret) {
        incoming.clientSecretLast4 = existingConfig.clientSecretLast4;
        incoming.clientSecretEnc = existingConfig.clientSecretEnc;
      }
      setClause.authConfig = incoming;
    }
    if (dto.status !== undefined) setClause.status = dto.status;
    if (dto.visibility !== undefined) setClause.visibility = dto.visibility;
    if (dto.sharedConnectionPolicy !== undefined) {
      setClause.sharedConnectionPolicy = dto.sharedConnectionPolicy;
    }

    let updated = await this.repo.updateIntegration(integrationId, setClause);
    if (!updated) {
      throw new NotFoundException(
        '[McpIntegrationService.updateIntegration] integration not found',
      );
    }

    if (dto.clientSecret) {
      const config = (updated.authConfig ?? {}) as Record<string, unknown>;
      updated =
        (await this.repo.updateIntegration(integrationId, {
          authConfig: {
            ...config,
            clientSecretEnc: encryptJsonForTransit({
              clientSecret: dto.clientSecret,
            }),
            clientSecretLast4: `••••${dto.clientSecret.slice(-4)}`,
          },
        })) ?? updated;
    }

    return updated;
  }

  async deleteIntegration(
    integrationId: string,
    user: AuthenticatedUser,
  ): Promise<boolean> {
    const existing = await this.getIntegration(integrationId, user.sub);
    this.assertCanManageIntegration(existing, user);
    return this.repo.deleteIntegration(integrationId);
  }

  // ── Connection CRUD ──

  async listConnections(userId: string): Promise<McpConnectionRow[]> {
    const tenantId = this.tenantContext.getTenantId();
    return this.repo.findConnectionsForUser({ tenantId, userId });
  }

  async createConnection(
    userId: string,
    dto: CreateConnectionDto,
  ): Promise<McpConnectionRow> {
    const tenantId = this.tenantContext.getTenantId();
    const integration = await this.getIntegration(dto.integrationId, userId);

    const supportedTypes = integration.supportedAuthTypes as McpAuthType[];
    if (!supportedTypes.includes(dto.authType)) {
      throw new BadRequestException(
        `[McpIntegrationService.createConnection] auth type "${dto.authType}" not supported`,
      );
    }

    if (dto.authType === 'bearer_passthrough' && !integration.trustedServer) {
      throw new BadRequestException(
        '[McpIntegrationService.createConnection] bearer_passthrough only allowed for trusted servers',
      );
    }

    const orgConnCount = await this.repo.countConnectionsByTenant(tenantId);
    if (orgConnCount >= MCP_LIMITS.CONNECTIONS_PER_ORG) {
      throw new BadRequestException(
        '[McpIntegrationService.createConnection] maximum connections per org reached',
      );
    }

    const visibility = dto.visibility ?? 'org';
    const connectionUserId = visibility === 'private' ? userId : null;

    if (connectionUserId) {
      const userConnCount = await this.repo.countConnectionsByUser({
        tenantId,
        userId,
      });
      if (userConnCount >= MCP_LIMITS.CONNECTIONS_PER_USER) {
        throw new BadRequestException(
          `[McpIntegrationService.createConnection] maximum connections per user reached (${MCP_LIMITS.CONNECTIONS_PER_USER})`,
        );
      }
    }

    const softDeleted = await this.repo.findSoftDeletedConnection({
      tenantId,
      integrationId: dto.integrationId,
      userId: connectionUserId,
    });

    const initialStatus =
      dto.authType === 'none' || dto.authType === 'bearer_passthrough'
        ? 'connected'
        : 'pending';

    if (dto.authType === 'api_key') {
      if (!dto.apiKey?.trim()) {
        throw new BadRequestException(
          '[McpIntegrationService.createConnection] apiKey is required for api_key auth',
        );
      }

      const connId = softDeleted?.id ?? randomUUID();
      const credentialRef = await storeCredentialSecret(
        connId,
        JSON.stringify({ apiKey: dto.apiKey } satisfies StoredApiKeyCredential),
      );

      if (softDeleted) {
        return this.repo.reactivateConnection(softDeleted.id, {
          authType: dto.authType,
          visibility,
          status: initialStatus,
          credentialRef,
        });
      }

      return this.repo.createConnection({
        id: connId,
        integrationId: dto.integrationId,
        tenantId,
        userId: connectionUserId,
        authType: dto.authType,
        visibility,
        credentialRef,
        status: initialStatus,
      });
    }

    if (softDeleted) {
      return this.repo.reactivateConnection(softDeleted.id, {
        authType: dto.authType,
        visibility,
        status: initialStatus,
        credentialRef: null,
      });
    }

    return this.repo.createConnection({
      integrationId: dto.integrationId,
      tenantId,
      userId: connectionUserId,
      authType: dto.authType,
      visibility,
      status: initialStatus,
    });
  }

  async testConnection(
    connectionId: string,
    userId: string,
    bearerToken?: string,
  ): Promise<{ ok: boolean; toolCount?: number; error?: string }> {
    const conn = await this.repo.findConnectionById(connectionId);
    if (!conn) {
      throw new NotFoundException(
        '[McpIntegrationService.testConnection] connection not found',
      );
    }

    const integration = await this.repo.findIntegrationById(conn.integrationId);
    if (!integration) {
      throw new NotFoundException(
        '[McpIntegrationService.testConnection] integration not found',
      );
    }

    try {
      const credential = await this.resolveCredential(
        conn,
        integration,
        bearerToken,
      );

      if (conn.authType === 'oauth' && !credential.token) {
        const errorMsg =
          'OAuth credentials missing or expired — disconnect and reconnect';
        await this.repo.updateConnection(connectionId, { status: 'error' });
        return { ok: false, error: errorMsg };
      }

      const manifest = await this.manifestService.discoverAndCache(
        conn,
        integration,
        credential,
      );

      await this.repo.updateConnection(connectionId, { status: 'connected' });
      return { ok: true, toolCount: manifest.toolCount };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      await this.repo.updateConnection(connectionId, { status: 'error' });
      return { ok: false, error: errorMsg };
    }
  }

  async disconnectConnection(
    connectionId: string,
    userId: string,
  ): Promise<void> {
    const conn = await this.repo.findConnectionById(connectionId);
    if (!conn) {
      throw new NotFoundException(
        '[McpIntegrationService.disconnectConnection] connection not found',
      );
    }

    if (conn.visibility === 'private' && conn.userId !== userId) {
      throw new ForbiddenException(
        '[McpIntegrationService.disconnectConnection] permission denied',
      );
    }

    if (conn.credentialRef) {
      await deleteCredentialSecret(conn.credentialRef);
    }

    await this.repo.softDeleteConnection(connectionId);
    logger.log(
      `[McpIntegrationService.disconnectConnection] soft-deleted connection ${connectionId}`,
    );
  }

  async listToolsForUser(userId: string): Promise<McpToolGroupResponse[]> {
    const connections = await this.listConnections(userId);
    const activeConnections = connections.filter(
      (c) => c.status === 'connected' && c.enabled,
    );

    const results: McpToolGroupResponse[] = [];

    for (const conn of activeConnections) {
      const integration = await this.repo.findIntegrationById(
        conn.integrationId,
      );
      if (!integration || integration.status !== 'active') continue;

      const manifest = await this.manifestService.getManifestForConnection(
        conn.id,
      );
      if (!manifest) continue;

      const tools = (manifest.manifest as CachedTool[]).map((tool) => ({
        namespacedId: buildNamespacedToolId(conn.id, tool.name),
        originalName: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema,
        ...(tool.category ? { category: tool.category } : {}),
      }));

      results.push({
        integrationId: integration.id,
        integrationName: integration.name,
        connectionId: conn.id,
        connectionVisibility: conn.visibility as 'org' | 'private',
        tools,
        lastDiscoveredAt: manifest.lastRefreshedAt.toISOString(),
        stale: this.manifestService.isStale(manifest),
      });
    }

    return results;
  }

  async resolveCredential(
    connection: McpConnectionRow,
    integration: McpIntegrationRow,
    bearerToken?: string,
  ): Promise<{ token?: string; apiKey?: string }> {
    switch (connection.authType) {
      case 'none':
        return {};

      case 'bearer_passthrough': {
        if (!integration.trustedServer) {
          logger.warn(
            `[McpIntegrationService.resolveCredential] skipping bearer passthrough for untrusted server ${integration.id}`,
          );
          return {};
        }
        return { token: bearerToken };
      }

      case 'api_key': {
        if (!connection.credentialRef) return {};
        try {
          const raw = await loadCredentialSecret(connection.credentialRef);
          const parsed = JSON.parse(raw) as StoredApiKeyCredential;
          return { apiKey: parsed.apiKey };
        } catch (err) {
          logger.warn(
            `[McpIntegrationService.resolveCredential] failed to load api key for ${connection.id}: ${String(err)}`,
          );
          return {};
        }
      }

      case 'oauth': {
        if (!connection.credentialRef) return {};
        try {
          const raw = await loadCredentialSecret(connection.credentialRef);
          const parsed = JSON.parse(raw) as StoredOAuthCredential;

          if (new Date(parsed.expiresAt) > new Date(Date.now() + 60_000)) {
            return { token: parsed.accessToken };
          }

          const refreshed = await this.refreshOAuthToken(
            connection,
            integration,
            parsed.refreshToken,
          );
          if ('error' in refreshed) return {};
          return { token: refreshed.token };
        } catch (err) {
          logger.warn(
            `[McpIntegrationService.resolveCredential] failed to load oauth creds for ${connection.id}: ${String(err)}`,
          );
          return {};
        }
      }

      default:
        return {};
    }
  }

  async testConnectionStateless(
    dto: TestConnectionDto,
  ): Promise<{ ok: boolean; toolCount?: number; error?: string }> {
    try {
      await validateMcpUrl(dto.url);

      const headers: Record<string, string> = {};
      if (dto.authType === 'api_key' && dto.apiKey) {
        const headerName = dto.headerName ?? 'Authorization';
        headers[headerName] = dto.headerPrefix
          ? `${dto.headerPrefix} ${dto.apiKey}`
          : dto.apiKey;
      } else if (dto.authType === 'bearer_passthrough' && dto.bearerToken) {
        headers['Authorization'] = `Bearer ${dto.bearerToken}`;
      }

      const mcpClient = await createNativeMCPClient({
        transportType: (dto.transportType ?? 'http') as 'http' | 'sse',
        url: dto.url,
        headers,
      });

      let toolCount = 0;
      try {
        const tools = await mcpClient.listTools();
        toolCount = tools.length;
      } finally {
        await mcpClient.close();
      }

      return { ok: true, toolCount };
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  async discoverServerAuth(
    dto: DiscoverServerDto,
  ): Promise<McpServerDiscoveryResult> {
    await validateMcpUrl(dto.url);

    const serverUrl = new URL(dto.url);
    const baseUrl = `${serverUrl.protocol}//${serverUrl.host}`;
    const pathComponent = serverUrl.pathname.replace(/\/+$/, '');

    let requiresAuth = false;
    let protectedResourceMetadata: ProtectedResourceMetadata | undefined;
    let authServerMetadata: AuthServerMetadata | undefined;
    let toolCount: number | undefined;

    protectedResourceMetadata = await this.fetchProtectedResourceMetadata(
      baseUrl,
      pathComponent,
    );

    if (protectedResourceMetadata?.authorization_servers?.length) {
      requiresAuth = true;
      for (const asUrl of protectedResourceMetadata.authorization_servers) {
        authServerMetadata = await this.fetchAuthServerMetadata(asUrl);
        if (authServerMetadata) break;
      }
    }

    try {
      const mcpClient = await createNativeMCPClient({
        transportType: 'http',
        url: dto.url,
      });
      try {
        const tools = await mcpClient.listTools();
        toolCount = tools.length;
        if (!requiresAuth) {
          requiresAuth = false;
        }
      } finally {
        await mcpClient.close();
      }
    } catch (err) {
      if (!requiresAuth) {
        const message = err instanceof Error ? err.message : String(err);
        throw new BadRequestException(
          `[McpIntegrationService.discoverServerAuth] could not reach MCP server — ${message}`,
        );
      }
    }

    const supportedAuthTypes = this.deriveAuthTypes(
      requiresAuth,
      authServerMetadata,
      toolCount,
    );
    const authConfig = this.deriveAuthConfig(authServerMetadata);

    return {
      requiresAuth,
      supportedAuthTypes,
      toolCount,
      protectedResourceMetadata,
      authServerMetadata,
      authConfig: Object.keys(authConfig).length > 0 ? authConfig : undefined,
    };
  }

  private async refreshOAuthToken(
    connection: McpConnectionRow,
    integration: McpIntegrationRow,
    refreshToken: string,
  ): Promise<{ token: string } | { error: string }> {
    const authConfig = (integration.authConfig as McpAuthConfig)?.oauth;
    if (!authConfig) {
      return { error: 'no OAuth config on integration' };
    }

    const clientSecret = this.loadClientSecret(integration);

    try {
      const body = new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        ...(authConfig.clientId ? { client_id: authConfig.clientId } : {}),
        ...(clientSecret ? { client_secret: clientSecret } : {}),
      });

      const response = await fetch(authConfig.tokenEndpointUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
      });

      if (!response.ok) {
        await this.repo.updateConnection(connection.id, { status: 'expired' });
        return { error: `Token refresh failed: ${response.status}` };
      }

      const tokens = (await response.json()) as {
        access_token: string;
        refresh_token?: string;
        expires_in: number;
        token_type: string;
        scope?: string;
      };

      const credentialRef = await storeCredentialSecret(
        connection.id,
        JSON.stringify({
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token ?? refreshToken,
          expiresAt: new Date(
            Date.now() + tokens.expires_in * 1000,
          ).toISOString(),
          tokenType: tokens.token_type,
          scope: tokens.scope,
        } satisfies StoredOAuthCredential),
      );

      await this.repo.updateConnection(connection.id, {
        credentialRef,
        status: 'connected',
      });

      return { token: tokens.access_token };
    } catch (err) {
      await this.repo.updateConnection(connection.id, { status: 'error' });
      return { error: String(err) };
    }
  }

  loadClientSecret(integration: McpIntegrationRow): string | undefined {
    const config = (integration.authConfig ?? {}) as Record<string, unknown>;
    const enc = config.clientSecretEnc;
    if (typeof enc !== 'string' || !enc) return undefined;
    try {
      const parsed = decryptJsonFromTransit(enc) as { clientSecret: string };
      return parsed.clientSecret;
    } catch {
      return undefined;
    }
  }

  private assertIntegrationVisible(
    integration: McpIntegrationRow,
    userId: string,
  ): void {
    const tenantId = this.tenantContext.getTenantId();
    if (integration.tenantId !== tenantId) {
      throw new NotFoundException(
        '[McpIntegrationService.getIntegration] integration not found',
      );
    }
    if (
      integration.visibility === 'private' &&
      integration.createdByUserId !== userId
    ) {
      throw new NotFoundException(
        '[McpIntegrationService.getIntegration] integration not found',
      );
    }
  }

  private assertCanManageIntegration(
    integration: McpIntegrationRow,
    user: AuthenticatedUser,
  ): void {
    if (
      integration.createdByUserId !== user.sub &&
      integration.visibility !== 'public'
    ) {
      throw new ForbiddenException(
        '[McpIntegrationService] requires ownership to manage integration',
      );
    }
  }

  private async fetchProtectedResourceMetadata(
    baseUrl: string,
    pathComponent: string,
  ): Promise<ProtectedResourceMetadata | undefined> {
    const candidates =
      pathComponent && pathComponent !== '/'
        ? [
            `${baseUrl}/.well-known/oauth-protected-resource${pathComponent}`,
            `${baseUrl}/.well-known/oauth-protected-resource`,
          ]
        : [`${baseUrl}/.well-known/oauth-protected-resource`];

    for (const url of candidates) {
      const result = await this.fetchJson<ProtectedResourceMetadata>(url);
      if (result) return result;
    }
    return undefined;
  }

  private async fetchAuthServerMetadata(
    issuerUrl: string,
  ): Promise<AuthServerMetadata | undefined> {
    const parsed = new URL(issuerUrl);
    const base = `${parsed.protocol}//${parsed.host}`;
    const path = parsed.pathname.replace(/\/+$/, '');

    const candidates =
      path && path !== '/'
        ? [
            `${base}/.well-known/oauth-authorization-server${path}`,
            `${base}/.well-known/openid-configuration${path}`,
            `${issuerUrl}/.well-known/openid-configuration`,
          ]
        : [
            `${base}/.well-known/oauth-authorization-server`,
            `${base}/.well-known/openid-configuration`,
          ];

    for (const url of candidates) {
      const result = await this.fetchJson<AuthServerMetadata>(url);
      if (result) {
        if (result.issuer && result.issuer !== issuerUrl) {
          logger.warn(
            `[McpIntegrationService.fetchAuthServerMetadata] issuer mismatch expected=${issuerUrl} actual=${result.issuer}`,
          );
          continue;
        }
        return result;
      }
    }
    return undefined;
  }

  private async fetchJson<T>(url: string): Promise<T | undefined> {
    try {
      const response = await fetch(url, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(MCP_LIMITS.CLIENT_CREATION_TIMEOUT_MS),
      });
      if (!response.ok) return undefined;
      return (await response.json()) as T;
    } catch {
      return undefined;
    }
  }

  private deriveAuthTypes(
    requiresAuth: boolean,
    asMetadata?: AuthServerMetadata,
    toolCount?: number,
  ): McpAuthType[] {
    if (!requiresAuth && toolCount !== undefined) return ['none'];

    const types: McpAuthType[] = [];

    if (asMetadata) {
      const grantTypes = this.resolveGrantTypes(asMetadata);
      if (
        grantTypes.includes('authorization_code') ||
        grantTypes.includes('client_credentials')
      ) {
        types.push('oauth');
      }
    }

    if (requiresAuth && types.length === 0) {
      types.push('api_key');
    }

    if (types.length === 0 && toolCount !== undefined) {
      return ['none'];
    }

    return [...new Set(types)];
  }

  private deriveAuthConfig(
    asMetadata?: AuthServerMetadata,
  ): Partial<McpAuthConfig> {
    if (!asMetadata) return {};

    const grantTypes = this.resolveGrantTypes(asMetadata);
    if (
      !grantTypes.includes('authorization_code') &&
      !grantTypes.includes('client_credentials')
    ) {
      return {};
    }

    return {
      oauth: {
        authorizationEndpointUrl: asMetadata.authorization_endpoint ?? '',
        tokenEndpointUrl: asMetadata.token_endpoint ?? '',
        revocationEndpointUrl: asMetadata.revocation_endpoint,
        registrationEndpointUrl: asMetadata.registration_endpoint,
        scopes: (asMetadata.scopes_supported ?? []).join(' '),
        redirectUrls: [],
        usePkce: (asMetadata.code_challenge_methods_supported ?? []).includes(
          'S256',
        ),
      },
    };
  }

  private resolveGrantTypes(asMetadata: AuthServerMetadata): string[] {
    if (asMetadata.grant_types_supported?.length) {
      return asMetadata.grant_types_supported;
    }

    const responseTypes = asMetadata.response_types_supported ?? [];
    if (responseTypes.some((rt) => rt.split(/\s+/).includes('code'))) {
      return ['authorization_code', 'implicit'];
    }

    return ['authorization_code', 'implicit'];
  }
}
