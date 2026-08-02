import { config as dotenvConfig } from 'dotenv';
dotenvConfig();

import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import express from 'express';
import crypto from 'node:crypto';
import type { Request, Response } from 'express';

import { loadConfig } from './config.js';
import { createTokenMiddleware, getTokenFromRequest } from './auth/token-extract.js';
import { requestContext } from './auth/token-extract.js';
import { createServer } from './server.js';
import { catalogFromServer } from './tool-catalog.js';

async function main(): Promise<void> {
  const config = loadConfig();
  const startedAt = new Date();

  const app = express();
  app.use(express.json());

  app.use((req, _res, next) => {
    console.log(`[main.requestLogger] ${req.method} ${req.path} auth=${!!req.headers.authorization}`);
    next();
  });

  app.use(createTokenMiddleware());

  const transports = new Map<string, StreamableHTTPServerTransport>();

  app.use((_req, res, next) => {
    res.set('Access-Control-Expose-Headers', 'Mcp-Session-Id');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, Mcp-Session-Id');
    next();
  });

  const catalog = catalogFromServer(createServer(config));

  app.get('/healthz', (_req, res) => {
    res.json({
      status: 'ok',
      server: config.MCP_SERVER_NAME,
      version: config.MCP_SERVER_VERSION,
      tools: catalog.length,
      toolNames: catalog.map((t) => t.name),
      uptime: Math.floor((Date.now() - startedAt.getTime()) / 1000),
    });
  });

  const mcpHandler = async (req: Request, res: Response) => {
    const token = getTokenFromRequest(req);
    if (!token) {
      res.status(401).json({ error: 'unauthorized', message: 'Bearer token required' });
      return;
    }

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
      await requestContext.run({ accessToken: token }, async () => {
        await transport.handleRequest(req, res, req.body);
      });
      return;
    }

    if (req.method === 'POST') {
      if (!sessionId || !transports.has(sessionId)) {
        const sessionServer = createServer(config);
        const transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => crypto.randomUUID(),
          enableJsonResponse: true,
          onsessioninitialized: (sid) => {
            transports.set(sid, transport);
            console.log(`[main.mcpHandler] new MCP session created: ${sid}`);
          },
        });
        transport.onclose = () => {
          const sid = transport.sessionId;
          if (sid) {
            transports.delete(sid);
            console.log(`[main.mcpHandler] MCP session closed: ${sid}`);
          }
        };
        await sessionServer.connect(transport);
        await requestContext.run({ accessToken: token }, async () => {
          await transport.handleRequest(req, res, req.body);
        });
      } else {
        const transport = transports.get(sessionId)!;
        await requestContext.run({ accessToken: token }, async () => {
          await transport.handleRequest(req, res, req.body);
        });
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

  app.post('/mcp', mcpHandler);
  app.get('/mcp', mcpHandler);
  app.delete('/mcp', mcpHandler);

  app.listen(config.MS_GRAPH_MCP_PORT, config.MCP_HOST, () => {
    console.log(`[main.startup] ms-graph-mcp listening on ${config.MCP_HOST}:${config.MS_GRAPH_MCP_PORT}`);
    console.log(`[main.startup] tools registered: ${catalog.length} (${catalog.map((t) => t.name).join(', ')})`);
    console.log(`[main.startup] Graph API base: ${config.GRAPH_API_BASE_URL}`);
  });

  process.on('SIGTERM', () => {
    console.log('[main.shutdown] SIGTERM received — shutting down');
    process.exit(0);
  });
  process.on('SIGINT', () => {
    console.log('[main.shutdown] SIGINT received — shutting down');
    process.exit(0);
  });
}

main().catch((err) => {
  console.error('[main.startup] fatal error', err instanceof Error ? err.message : err);
  process.exit(1);
});
