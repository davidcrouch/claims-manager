import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ClaimsApiClient } from '../server.js';
import { toolError, toolResult } from '../server.js';

export function registerLookupsTools(server: McpServer, api: ClaimsApiClient): void {
  server.tool(
    'get_lookup_values',
    'Get lookup values for a domain (e.g. claim status, task priority).',
    {
      domain: z.string().describe('Lookup domain name'),
    },
    async ({ domain }) => {
      try {
        const result = await api.request('/lookups', {
          query: { domain },
        });
        return toolResult(result);
      } catch (err) {
        return toolError(err);
      }
    },
  );
}
