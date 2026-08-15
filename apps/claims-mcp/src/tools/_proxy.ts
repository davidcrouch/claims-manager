/**
 * Shared helpers for thin Nest→MCP proxy tools.
 */
import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ClaimsApiClient } from '../server.js';
import { toolError, toolResult } from '../server.js';
import { categoryDesc, type CategoryId } from '../categories.js';

export const pageLimit = {
  page: z.number().int().positive().optional().describe('Page number'),
  limit: z.number().int().positive().optional().describe('Page size'),
};

export const dataBody = z.record(z.unknown()).describe('Opaque API request body');

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

type InputShape = Record<string, z.ZodTypeAny>;

/**
 * Register a tool that proxies to Claims API.
 * Path template uses `{param}` placeholders from the tool args.
 */
export function proxyTool(
  server: McpServer,
  api: ClaimsApiClient,
  opts: {
    category: CategoryId;
    name: string;
    description: string;
    method?: Method;
    path: string;
    input?: InputShape;
    /** Build query from args (remaining path params still substituted). */
    query?: (args: Record<string, unknown>) => Record<string, string | number | undefined>;
    /** Build body from args; default uses `data` if present. */
    body?: (args: Record<string, unknown>) => unknown;
  },
): void {
  const input = opts.input ?? {};
  server.tool(
    opts.name,
    categoryDesc(opts.category, opts.description),
    input,
    async (args) => {
      try {
        const raw = args as Record<string, unknown>;
        let path = opts.path;
        for (const [key, value] of Object.entries(raw)) {
          if (typeof value === 'string' || typeof value === 'number') {
            path = path.replace(`{${key}}`, encodeURIComponent(String(value)));
          }
        }
        const method = opts.method ?? 'GET';
        const query = opts.query?.(raw);
        let body: unknown;
        if (opts.body) {
          body = opts.body(raw);
        } else if (method !== 'GET' && method !== 'DELETE' && 'data' in raw) {
          body = raw.data;
        } else if (method === 'POST' || method === 'PUT' || method === 'PATCH') {
          body = {};
        }
        return toolResult(
          await api.request(path, {
            method,
            query,
            body: method === 'GET' || method === 'DELETE' ? undefined : body,
          }),
        );
      } catch (err) {
        return toolError(err);
      }
    },
  );
}
