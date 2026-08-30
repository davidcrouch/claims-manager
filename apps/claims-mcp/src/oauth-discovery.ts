/**
 * Unauthenticated OAuth 2.1 / MCP discovery (RFC 9728, RFC 8414, RFC 8615).
 *
 * claims-mcp is a resource server. Clients learn the authorization server from
 * Protected Resource Metadata (`authorization_servers`), then query that issuer
 * for OAuth AS / OIDC metadata.
 */

import type { Request, Response } from 'express';
import type { ClaimsMcpConfig } from './config.js';
import { isCategoryId, type CategoryId } from './categories.js';

export const MCP_OAUTH_SCOPE = 'mcp:tools';

export type WellKnownKind = 'prm' | 'as' | 'oidc' | 'mcp';

export interface ParsedWellKnown {
  kind: WellKnownKind;
  /** Canonical MCP mount path, e.g. `/mcp` or `/operations/mcp`. */
  resourcePath: string;
}

const KIND_BY_SUFFIX: Record<string, WellKnownKind> = {
  'oauth-protected-resource': 'prm',
  'oauth-authorization-server': 'as',
  'openid-configuration': 'oidc',
  mcp: 'mcp',
};

const MCP_CARD_FILES = new Set([
  'server-card.json',
  'server-cards.json',
  'mcp.json',
]);

export function isWellKnownPath(pathname: string): boolean {
  return pathname === '/.well-known' || pathname.includes('/.well-known/');
}

export function parseWellKnown(pathname: string): ParsedWellKnown | null {
  const path = normalizePath(pathname);
  if (!path.includes('/.well-known/')) return null;

  const inserted = path.match(
    /^\/\.well-known\/(oauth-protected-resource|oauth-authorization-server|openid-configuration|mcp)(\/.*)?$/,
  );
  if (inserted) {
    return {
      kind: KIND_BY_SUFFIX[inserted[1]]!,
      resourcePath: resourcePathFromRest(inserted[2]),
    };
  }

  const appended = path.match(
    /^(.*)\/\.well-known\/(oauth-protected-resource|oauth-authorization-server|openid-configuration|mcp)$/,
  );
  if (appended) {
    return {
      kind: KIND_BY_SUFFIX[appended[2]]!,
      resourcePath: resourcePathFromRest(appended[1]),
    };
  }

  return null;
}

export function publicOrigin(req: Request, config: ClaimsMcpConfig): string {
  if (config.CLAIMS_MCP_PUBLIC_URL) {
    return stripTrailingSlash(config.CLAIMS_MCP_PUBLIC_URL);
  }

  const proto = firstHeader(req, 'x-forwarded-proto') ?? req.protocol;
  let host =
    firstHeader(req, 'x-forwarded-host') ??
    req.get('host') ??
    `localhost:${config.CLAIMS_MCP_PORT}`;
  if (host.startsWith('0.0.0.0')) {
    host = host.replace('0.0.0.0', 'localhost');
  }
  return `${proto}://${host}`;
}

export function authIssuerUrl(config: ClaimsMcpConfig): string {
  return stripTrailingSlash(config.AUTH_ISSUER_URL);
}

export function protectedResourceMetadata(
  resource: string,
  issuer: string,
  scopes: string[],
): Record<string, unknown> {
  return {
    resource,
    authorization_servers: [issuer],
    bearer_methods_supported: ['header'],
    scopes_supported: scopes,
    resource_name: 'claims-mcp',
  };
}

export function mcpDiscoveryDocument(opts: {
  origin: string;
  resourcePath: string;
  issuer: string;
  config: ClaimsMcpConfig;
  scopes: string[];
  categories: Array<{ id: CategoryId; tools: number }>;
  aggregateTools: number;
}): Record<string, unknown> {
  const resource = `${opts.origin}${opts.resourcePath}`;
  const prmUrl = `${opts.origin}/.well-known/oauth-protected-resource${opts.resourcePath}`;
  const categoryId = categoryFromResourcePath(opts.resourcePath);

  return {
    protocolVersion: '2025-11-25',
    serverInfo: {
      name: opts.config.MCP_SERVER_NAME,
      version: opts.config.MCP_SERVER_VERSION,
      title: categoryId
        ? `Claims Manager (${categoryId})`
        : 'Claims Manager MCP',
    },
    transport: {
      type: 'streamable-http',
      endpoint: resource,
    },
    capabilities: {
      tools: { listChanged: false },
      resources: {},
      prompts: {},
    },
    authentication: {
      type: 'oauth2',
      authorization_servers: [opts.issuer],
      resource_metadata: prmUrl,
      scopes_supported: opts.scopes,
    },
    endpoints: {
      mcp: resource,
      protected_resource_metadata: prmUrl,
      authorization_server_metadata: `${opts.issuer}/.well-known/oauth-authorization-server`,
      openid_configuration: `${opts.issuer}/.well-known/openid-configuration`,
    },
    tools: {
      count: categoryId
        ? (opts.categories.find((c) => c.id === categoryId)?.tools ?? 0)
        : opts.aggregateTools,
    },
    categories: opts.categories.map((c) => ({
      id: c.id,
      endpoint: `${opts.origin}/${c.id}/mcp`,
      tools: c.tools,
    })),
  };
}

export function wwwAuthenticate(resourceMetadataUrl: string, scope: string): string {
  return `Bearer FAKESECRET_g3h4i5j6k7l8m9n0o1p2="${resourceMetadataUrl}", scope="${scope}"`;
}

export interface DiscoveryCatalog {
  categories: Array<{ id: CategoryId; tools: number }>;
  aggregateTools: number;
}

export function handleDiscoveryRequest(
  req: Request,
  res: Response,
  config: ClaimsMcpConfig,
  catalog: DiscoveryCatalog,
): ParsedWellKnown | null {
  if (req.method !== 'GET' && req.method !== 'HEAD') return null;

  const parsed = parseWellKnown(req.path);
  if (!parsed) return null;

  const origin = publicOrigin(req, config);
  const issuer = authIssuerUrl(config);
  const scopes = config.MCP_OAUTH_SCOPES;
  const resource = `${origin}${parsed.resourcePath}`;

  res.set('Cache-Control', 'public, max-age=300');
  res.set('Content-Type', 'application/json; charset=utf-8');

  if (parsed.kind === 'as') {
    res.redirect(307, `${issuer}/.well-known/oauth-authorization-server`);
    return parsed;
  }

  if (parsed.kind === 'oidc') {
    res.redirect(307, `${issuer}/.well-known/openid-configuration`);
    return parsed;
  }

  if (parsed.kind === 'prm') {
    res.status(200).json(protectedResourceMetadata(resource, issuer, scopes));
    return parsed;
  }

  res.status(200).json(
    mcpDiscoveryDocument({
      origin,
      resourcePath: parsed.resourcePath,
      issuer,
      config,
      scopes,
      categories: catalog.categories,
      aggregateTools: catalog.aggregateTools,
    }),
  );
  return parsed;
}

function normalizePath(pathname: string): string {
  const trimmed = pathname.replace(/\/+$/, '');
  return trimmed.length > 0 ? trimmed : '/';
}

function resourcePathFromRest(rest: string | undefined): string {
  const raw = (rest ?? '').replace(/\/+$/, '');
  if (!raw || raw === '/') return '/mcp';

  const last = raw.split('/').filter(Boolean).pop() ?? '';
  if (MCP_CARD_FILES.has(last)) return '/mcp';

  return raw.startsWith('/') ? raw : `/${raw}`;
}

function categoryFromResourcePath(resourcePath: string): CategoryId | undefined {
  const match = resourcePath.match(/^\/([^/]+)\/mcp$/);
  if (match && isCategoryId(match[1])) return match[1];
  return undefined;
}

function firstHeader(req: Request, name: string): string | undefined {
  const value = req.get(name);
  if (!value) return undefined;
  return value.split(',')[0]?.trim() || undefined;
}

function stripTrailingSlash(url: string): string {
  return url.replace(/\/+$/, '');
}
