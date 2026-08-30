import { config as dotenvConfig } from 'dotenv';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenvConfig({ path: resolve(__dirname, '../.env') });

import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { loadConfig, type ClaimsMcpConfig } from './config.js';
import {
  createClaimsMcpServer,
  implementedCategories,
  type RequestContext,
} from './server.js';
import { catalogFromServer } from './tool-catalog.js';
import {
  MCP_CATEGORIES,
  isCategoryId,
  parseCategoryList,
  type CategoryId,
} from './categories.js';
import {
  authIssuerUrl,
  handleDiscoveryRequest,
  isWellKnownPath,
  MCP_OAUTH_SCOPE,
  publicOrigin,
  wwwAuthenticate,
} from './oauth-discovery.js';

const LOG_PREFIX = 'claims-mcp.main';
const AUTH_TOKEN_KEY = '__claims_mcp_token';
const AUTH_TENANT_KEY = '__claims_mcp_tenant';

function log(
  level: 'info' | 'warn' | 'error',
  method: string,
  message: string,
  meta?: Record<string, unknown>,
) {
  const payload = meta ? `${message} ${JSON.stringify(meta)}` : message;
  console[level](`[${LOG_PREFIX}.${method}] ${payload}`);
}

function createAuthMiddleware(config: ClaimsMcpConfig) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (req.method === 'OPTIONS') {
      return next();
    }
    if (req.path === '/healthz' && req.method === 'GET') {
      return next();
    }
    if (isWellKnownPath(req.path)) {
      return next();
    }

    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      const origin = publicOrigin(req, config);
      const metadataUrl = `${origin}/.well-known/oauth-protected-resource${
        req.path.endsWith('/mcp') ? req.path : '/mcp'
      }`;
      log('warn', 'createAuthMiddleware', 'missing bearer token', { path: req.path });
      res.set(
        'WWW-Authenticate',
        wwwAuthenticate(metadataUrl, MCP_OAUTH_SCOPE),
      );
      res.status(401).json({ error: 'unauthorized', message: 'Bearer token required' });
      return;
    }

    (req as unknown as Record<string, unknown>)[AUTH_TOKEN_KEY] = authHeader.slice(7);
    const tenantId = req.headers['x-tenant-id'];
    if (typeof tenantId === 'string' && tenantId.trim()) {
      (req as unknown as Record<string, unknown>)[AUTH_TENANT_KEY] = tenantId.trim();
    }

    next();
  };
}

function readContext(req: Request): RequestContext {
  return {
    token: (req as unknown as Record<string, unknown>)[AUTH_TOKEN_KEY] as string,
    tenantId: (req as unknown as Record<string, unknown>)[AUTH_TENANT_KEY] as string | undefined,
  };
}

function buildMcpHandler(
  getContext: () => RequestContext,
  transports: Map<string, StreamableHTTPServerTransport>,
  categories?: CategoryId[],
) {
  const config = loadConfig();

  return async (req: Request, res: Response) => {
    const sessionId = req.headers['mcp-session-id'] as string | undefined;

    if (req.method === 'GET') {
      if (!sessionId) {
        res.status(400).json({
          jsonrpc: '2.0',
          error: { code: -32000, message: 'Missing Mcp-Session-Id header' },
          id: null,
        });
        return;
      }

      const transport = transports.get(sessionId);
      if (!transport) {
        res.status(404).json({
          jsonrpc: '2.0',
          error: { code: -32000, message: 'Unknown session' },
          id: null,
        });
        return;
      }

      await transport.handleRequest(req, res, req.body);
      return;
    }

    if (req.method === 'POST') {
      if (!sessionId || !transports.has(sessionId)) {
        const server = createClaimsMcpServer(config, getContext, { categories });
        const transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => crypto.randomUUID(),
          enableJsonResponse: true,
          onsessioninitialized: (sid) => {
            transports.set(sid, transport);
            log('info', 'buildMcpHandler', 'session created', {
              sessionId: sid,
              categories: categories?.join(',') ?? 'all',
            });
          },
        });
        transport.onclose = () => {
          const sid = transport.sessionId;
          if (sid) transports.delete(sid);
        };
        await server.connect(transport);
        await transport.handleRequest(req, res, req.body);
      } else {
        await transports.get(sessionId)!.handleRequest(req, res, req.body);
      }
      return;
    }

    if (req.method === 'DELETE') {
      const transport = transports.get(sessionId ?? '');
      if (transport) {
        await transport.handleRequest(req, res, req.body);
        transports.delete(sessionId!);
      } else {
        res.status(400).json({ error: 'No active session' });
      }
      return;
    }

    res.status(405).json({ error: 'Method not allowed' });
  };
}

async function startHttp(): Promise<void> {
  const config = loadConfig();
  const app = express();
  app.use(express.json());

  app.use((req, res, next) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.set(
      'Access-Control-Allow-Headers',
      'Content-Type, Authorization, Mcp-Session-Id, MCP-Protocol-Version, x-tenant-id',
    );
    res.set('Access-Control-Expose-Headers', 'Mcp-Session-Id, WWW-Authenticate');
    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }
    next();
  });

  const catalogCtx = () => ({ token: 'catalog', tenantId: undefined });
  const implemented = implementedCategories();
  const categoryCatalogs = MCP_CATEGORIES.map((id) => {
    const server = createClaimsMcpServer(config, catalogCtx, { categories: [id] });
    const tools = catalogFromServer(server);
    return { id, tools: tools.length, toolNames: tools.map((t) => t.name) };
  });
  const aggregateServer = createClaimsMcpServer(config, catalogCtx);
  const aggregateTools = catalogFromServer(aggregateServer);
  const discoveryCatalog = {
    categories: categoryCatalogs.map(({ id, tools }) => ({ id, tools })),
    aggregateTools: aggregateTools.length,
  };

  app.use((req, res, next) => {
    const handled = handleDiscoveryRequest(req, res, config, discoveryCatalog);
    if (handled) {
      log('info', 'handleDiscoveryRequest', 'served discovery document', {
        path: req.path,
        kind: handled.kind,
        resourcePath: handled.resourcePath,
      });
      return;
    }
    next();
  });

  app.use(createAuthMiddleware(config));

  /** Separate transport maps per mount so session IDs never collide across categories. */
  const transportsByMount = new Map<string, Map<string, StreamableHTTPServerTransport>>();

  function transportsFor(mountKey: string): Map<string, StreamableHTTPServerTransport> {
    let map = transportsByMount.get(mountKey);
    if (!map) {
      map = new Map();
      transportsByMount.set(mountKey, map);
    }
    return map;
  }

  app.get('/healthz', (_req, res) => {
    res.json({
      status: 'ok',
      server: config.MCP_SERVER_NAME,
      version: config.MCP_SERVER_VERSION,
      tools: aggregateTools.length,
      implementedCategories: implemented,
      categories: categoryCatalogs,
    });
  });

  app.all('/mcp', (req, res) => {
    const handler = buildMcpHandler(() => readContext(req), transportsFor('aggregate'));
    void handler(req, res);
  });

  app.all('/:category/mcp', (req, res) => {
    const category = req.params.category;
    if (!isCategoryId(category)) {
      res.status(404).json({
        error: 'unknown_category',
        message: `Unknown MCP category "${category}"`,
        categories: [...MCP_CATEGORIES],
      });
      return;
    }

    const handler = buildMcpHandler(
      () => readContext(req),
      transportsFor(category),
      [category],
    );
    void handler(req, res);
  });

  app.listen(config.CLAIMS_MCP_PORT, config.CLAIMS_MCP_HOST, () => {
    log('info', 'startHttp', 'server started', {
      host: config.CLAIMS_MCP_HOST,
      port: config.CLAIMS_MCP_PORT,
      apiUrl: config.CLAIMS_API_URL,
      authIssuer: authIssuerUrl(config),
      mounts: ['/mcp', ...MCP_CATEGORIES.map((c) => `/${c}/mcp`)],
      tools: aggregateTools.length,
    });
  });
}

async function startStdio(): Promise<void> {
  const config = loadConfig();
  const token = process.env.CLAIMS_API_TOKEN;
  if (!token) {
    log('warn', 'startStdio', 'CLAIMS_API_TOKEN not set — API calls will fail');
  }

  const categories = parseCategoryList(process.env.CLAIMS_MCP_CATEGORIES);
  const server = createClaimsMcpServer(
    config,
    () => ({
      token: token ?? '',
      tenantId: process.env.CLAIMS_API_TENANT_ID,
    }),
    { categories },
  );
  const transport = new StdioServerTransport();
  await server.connect(transport);
  log('info', 'startStdio', 'stdio transport ready', {
    categories: categories?.join(',') ?? 'all',
  });
}

async function main(): Promise<void> {
  if (process.argv.includes('--stdio')) {
    await startStdio();
  } else {
    await startHttp();
  }
}

main().catch((err) => {
  log('error', 'main', 'fatal startup error', {
    error: err instanceof Error ? err.message : String(err),
  });
  process.exit(1);
});
