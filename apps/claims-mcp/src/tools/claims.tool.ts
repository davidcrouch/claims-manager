import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ClaimsApiClient } from '../server.js';
import { toolError, toolResult } from '../server.js';

export function registerClaimsTools(server: McpServer, api: ClaimsApiClient): void {
  server.tool(
    'search_claims',
    'Search claims by query text with optional pagination.',
    {
      query: z.string().describe('Search text for claim number, insured name, etc.'),
      page: z.number().int().positive().optional().describe('Page number (default 1)'),
    },
    async ({ query, page }) => {
      try {
        const result = await api.request('/claims', {
          query: { search: query, page: page ?? 1 },
        });
        return toolResult(result);
      } catch (err) {
        return toolError(err);
      }
    },
  );

  server.tool(
    'get_claim',
    'Get a single claim by ID.',
    {
      id: z.string().describe('Claim UUID'),
    },
    async ({ id }) => {
      try {
        const result = await api.request(`/claims/${id}`);
        return toolResult(result);
      } catch (err) {
        return toolError(err);
      }
    },
  );
}
