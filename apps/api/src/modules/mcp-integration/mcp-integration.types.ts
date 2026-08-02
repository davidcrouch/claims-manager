export type McpIntegrationVisibility = 'public' | 'org' | 'private';
export type McpIntegrationStatus =
  | 'draft'
  | 'active'
  | 'disabled'
  | 'deprecated'
  | 'error';
export type McpConnectionStatus =
  | 'pending'
  | 'connected'
  | 'reauth_required'
  | 'expired'
  | 'revoked'
  | 'error';
export type McpAuthType = 'none' | 'api_key' | 'bearer_passthrough' | 'oauth';
export type McpSharedConnectionPolicy = 'org_shared' | 'user_required';
export type McpTransportType = 'http' | 'sse';

export interface ApiKeyAuthConfig {
  headerName: string;
  headerPrefix?: string;
}

export interface OAuthAuthConfig {
  authorizationEndpointUrl: string;
  tokenEndpointUrl: string;
  revocationEndpointUrl?: string;
  registrationEndpointUrl?: string;
  clientId?: string;
  scopes: string;
  redirectUrls?: string[];
  usePkce: boolean;
}

export interface McpAuthConfig {
  api_key?: ApiKeyAuthConfig;
  oauth?: OAuthAuthConfig;
}

export interface CachedTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  category?: string;
}

export interface McpToolGroupResponse {
  integrationId: string;
  integrationName: string;
  connectionId: string;
  connectionVisibility: 'org' | 'private';
  tools: Array<{
    namespacedId: string;
    originalName: string;
    description: string;
    inputSchema?: Record<string, unknown>;
    category?: string;
  }>;
  lastDiscoveredAt: string;
  stale: boolean;
}

export interface CreateIntegrationDto {
  name: string;
  description?: string;
  url: string;
  transportType?: McpTransportType;
  supportedAuthTypes: McpAuthType[];
  authConfig?: McpAuthConfig;
  visibility?: McpIntegrationVisibility;
  sharedConnectionPolicy?: McpSharedConnectionPolicy;
  clientSecret?: string;
}

export interface UpdateIntegrationDto {
  name?: string;
  description?: string;
  url?: string;
  transportType?: McpTransportType;
  supportedAuthTypes?: McpAuthType[];
  authConfig?: McpAuthConfig;
  status?: McpIntegrationStatus;
  visibility?: McpIntegrationVisibility;
  sharedConnectionPolicy?: McpSharedConnectionPolicy;
  clientSecret?: string;
}

export interface CreateConnectionDto {
  integrationId: string;
  authType: McpAuthType;
  visibility?: 'org' | 'private';
  apiKey?: string;
}

export interface TestConnectionDto {
  url: string;
  transportType?: McpTransportType;
  authType?: McpAuthType;
  apiKey?: string;
  headerName?: string;
  headerPrefix?: string;
  bearerToken?: string;
}

export interface InitiateOAuthDto {
  integrationId: string;
  redirectUri: string;
}

export interface DiscoverServerDto {
  url: string;
}

export interface ProtectedResourceMetadata {
  resource?: string;
  authorization_servers?: string[];
  scopes_supported?: string[];
  bearer_methods_supported?: string[];
  [key: string]: unknown;
}

export interface AuthServerMetadata {
  issuer: string;
  authorization_endpoint?: string;
  token_endpoint?: string;
  revocation_endpoint?: string;
  registration_endpoint?: string;
  scopes_supported?: string[];
  response_types_supported?: string[];
  grant_types_supported?: string[];
  code_challenge_methods_supported?: string[];
  token_endpoint_auth_methods_supported?: string[];
  [key: string]: unknown;
}

export interface McpServerDiscoveryResult {
  requiresAuth: boolean;
  supportedAuthTypes: McpAuthType[];
  toolCount?: number;
  protectedResourceMetadata?: ProtectedResourceMetadata;
  authServerMetadata?: AuthServerMetadata;
  authConfig?: Partial<McpAuthConfig>;
}

export interface OAuthTokenPayload {
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
  tokenType: string;
  scope?: string;
}

export const MCP_LIMITS = {
  INTEGRATIONS_PER_ORG: 10,
  CONNECTIONS_PER_ORG: 20,
  CONNECTIONS_PER_USER: 5,
  TOOLS_PER_SERVER: 200,
  TOOLS_PER_CHAT_SESSION: 100,
  CLIENT_CREATION_TIMEOUT_MS: 10_000,
  TOOL_DISCOVERY_TIMEOUT_MS: 15_000,
  TOTAL_MCP_BUDGET_MS: 30_000,
  SINGLE_TOOL_CALL_TIMEOUT_MS: 30_000,
  MAX_TOOL_RESULT_BYTES: 1_048_576,
  MAX_CONCURRENT_TOOL_CALLS: 5,
  OAUTH_STATE_TTL_MS: 10 * 60 * 1000,
  MANIFEST_CACHE_TTL_MS: 60 * 60 * 1000,
} as const;

const CATEGORY_REGEX = /^\[Category:\s*(.+?)\]\s*/;

export function parseCategoryFromDescription(description: string): {
  category: string | null;
  cleanDescription: string;
} {
  const match = description.match(CATEGORY_REGEX);
  if (!match) return { category: null, cleanDescription: description };
  return {
    category: match[1],
    cleanDescription: description.slice(match[0].length),
  };
}

export function buildNamespacedToolId(
  connectionId: string,
  toolName: string,
): string {
  const safeConnId = connectionId.replace(/-/g, '_');
  const safeTool = toolName.replace(/[^a-zA-Z0-9_.\-:]/g, '_');
  const full = `mcp_${safeConnId}__${safeTool}`;
  return full.length > 128 ? full.slice(0, 128) : full;
}

export function parseNamespacedToolId(
  namespacedId: string,
): [string | null, string] {
  const withoutPrefix = namespacedId.startsWith('mcp_')
    ? namespacedId.slice(4)
    : namespacedId;
  const separatorIdx = withoutPrefix.indexOf('__');
  if (separatorIdx === -1) return [null, namespacedId];
  const connId = withoutPrefix.slice(0, separatorIdx).replace(/_/g, '-');
  return [connId, withoutPrefix.slice(separatorIdx + 2)];
}
