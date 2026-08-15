import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ClaimsApiClient } from '../server.js';
import { toolError, toolResult } from '../server.js';
import { categoryDesc } from '../categories.js';

const CAT = 'operations' as const;

export function registerClaimsTools(server: McpServer, api: ClaimsApiClient): void {
  server.tool(
    'search_claims',
    categoryDesc(CAT, 'Search/list claims with pagination and filters.'),
    {
      query: z.string().optional().describe('Search text for claim number, insured name, etc.'),
      page: z.number().int().positive().optional().describe('Page number (default 1)'),
      limit: z.number().int().positive().optional().describe('Page size (default 20)'),
      sort: z.string().optional().describe('Sort expression'),
      status: z.string().optional().describe('Filter by status'),
      account: z.string().optional().describe('Filter by account'),
    },
    async ({ query, page, limit, sort, status, account }) => {
      try {
        return toolResult(
          await api.request('/claims', {
            query: {
              search: query,
              page: page ?? 1,
              limit,
              sort,
              status,
              account,
            },
          }),
        );
      } catch (err) {
        return toolError(err);
      }
    },
  );

  server.tool(
    'get_claim',
    categoryDesc(CAT, 'Get a single claim by ID.'),
    {
      id: z.string().describe('Claim UUID'),
    },
    async ({ id }) => {
      try {
        return toolResult(await api.request(`/claims/${id}`));
      } catch (err) {
        return toolError(err);
      }
    },
  );

  server.tool(
    'create_claim',
    categoryDesc(CAT, 'Create a new claim. Pass API body fields as data.'),
    {
      data: z.record(z.unknown()).describe('Claim create payload (API body)'),
    },
    async ({ data }) => {
      try {
        return toolResult(await api.request('/claims', { method: 'POST', body: data }));
      } catch (err) {
        return toolError(err);
      }
    },
  );

  server.tool(
    'update_claim',
    categoryDesc(CAT, 'Update an existing claim. Pass API body fields as data.'),
    {
      id: z.string().describe('Claim UUID'),
      data: z.record(z.unknown()).describe('Claim update payload (API body)'),
    },
    async ({ id, data }) => {
      try {
        return toolResult(
          await api.request(`/claims/${id}`, { method: 'POST', body: data }),
        );
      } catch (err) {
        return toolError(err);
      }
    },
  );
}
