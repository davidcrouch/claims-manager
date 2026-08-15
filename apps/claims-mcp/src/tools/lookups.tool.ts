import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ClaimsApiClient } from '../server.js';
import { toolError, toolResult } from '../server.js';
import { categoryDesc } from '../categories.js';

const CAT = 'operations' as const;

export function registerLookupsTools(server: McpServer, api: ClaimsApiClient): void {
  server.tool(
    'get_lookup_values',
    categoryDesc(
      CAT,
      'Get lookup values for a domain (e.g. claim status, task priority).',
    ),
    {
      domain: z.string().describe('Lookup domain name'),
      providerCode: z.string().optional().describe('Optional provider code filter'),
    },
    async ({ domain, providerCode }) => {
      try {
        return toolResult(
          await api.request('/lookups', {
            query: { domain, providerCode },
          }),
        );
      } catch (err) {
        return toolError(err);
      }
    },
  );

  server.tool(
    'get_lookup',
    categoryDesc(CAT, 'Get a single lookup value by ID.'),
    {
      id: z.string().describe('Lookup UUID'),
    },
    async ({ id }) => {
      try {
        return toolResult(await api.request(`/lookups/${id}`));
      } catch (err) {
        return toolError(err);
      }
    },
  );

  server.tool(
    'ensure_lookup',
    categoryDesc(
      CAT,
      'Ensure a lookup value exists for a domain by name (create if missing).',
    ),
    {
      domain: z.string().describe('Lookup domain name'),
      name: z.string().describe('Lookup display name'),
    },
    async ({ domain, name }) => {
      try {
        return toolResult(
          await api.request('/lookups/ensure', {
            method: 'POST',
            body: { domain, name },
          }),
        );
      } catch (err) {
        return toolError(err);
      }
    },
  );
}
