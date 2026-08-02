import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ClaimsMcpConfig } from './config.js';
import { registerClaimsTools } from './tools/claims.tool.js';
import { registerJobsTools } from './tools/jobs.tool.js';
import { registerTasksTools } from './tools/tasks.tool.js';
import { registerContactsTools } from './tools/contacts.tool.js';
import { registerLookupsTools } from './tools/lookups.tool.js';

export interface RequestContext {
  token: string;
  tenantId?: string;
}

export class ClaimsApiClient {
  constructor(
    private readonly config: ClaimsMcpConfig,
    private readonly getContext: () => RequestContext,
  ) {}

  async request<T>(
    path: string,
    options?: {
      method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
      query?: Record<string, string | number | undefined>;
      body?: unknown;
    },
  ): Promise<T> {
    const { token, tenantId } = this.getContext();
    const url = new URL(`${this.config.CLAIMS_API_URL}/api/v1${path}`);

    if (options?.query) {
      for (const [key, value] of Object.entries(options.query)) {
        if (value !== undefined && value !== '') {
          url.searchParams.set(key, String(value));
        }
      }
    }

    const headers: Record<string, string> = {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    };

    if (options?.body !== undefined) {
      headers['Content-Type'] = 'application/json';
    }

    if (tenantId) {
      headers['x-tenant-id'] = tenantId;
    }

    const response = await fetch(url, {
      method: options?.method ?? 'GET',
      headers,
      body: options?.body !== undefined ? JSON.stringify(options.body) : undefined,
    });

    const text = await response.text();
    const payload = text ? JSON.parse(text) : {};

    if (!response.ok) {
      const message =
        typeof payload === 'object' &&
        payload !== null &&
        'message' in payload &&
        typeof payload.message === 'string'
          ? payload.message
          : `Claims API request failed (${response.status})`;
      throw new Error(message);
    }

    return payload as T;
  }
}

export function toolResult(data: unknown) {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }],
  };
}

export function toolError(err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  return {
    content: [{ type: 'text' as const, text: message }],
    isError: true as const,
  };
}

export function createClaimsMcpServer(
  config: ClaimsMcpConfig,
  getContext: () => RequestContext,
): McpServer {
  const server = new McpServer({
    name: config.MCP_SERVER_NAME,
    version: config.MCP_SERVER_VERSION,
  });

  const api = new ClaimsApiClient(config, getContext);
  registerClaimsTools(server, api);
  registerJobsTools(server, api);
  registerTasksTools(server, api);
  registerContactsTools(server, api);
  registerLookupsTools(server, api);

  return server;
}
