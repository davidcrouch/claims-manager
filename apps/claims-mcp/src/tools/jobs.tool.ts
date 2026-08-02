import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ClaimsApiClient } from '../server.js';
import { toolError, toolResult } from '../server.js';

export function registerJobsTools(server: McpServer, api: ClaimsApiClient): void {
  server.tool(
    'search_jobs',
    'Search jobs with optional claim filter and pagination.',
    {
      query: z.string().optional().describe('Search text'),
      claimId: z.string().optional().describe('Filter by claim UUID'),
      page: z.number().int().positive().optional().describe('Page number (default 1)'),
    },
    async ({ query, claimId, page }) => {
      try {
        const result = await api.request('/jobs', {
          query: { search: query, claimId, page: page ?? 1 },
        });
        return toolResult(result);
      } catch (err) {
        return toolError(err);
      }
    },
  );

  server.tool(
    'get_job',
    'Get a single job by ID.',
    {
      id: z.string().describe('Job UUID'),
    },
    async ({ id }) => {
      try {
        const result = await api.request(`/jobs/${id}`);
        return toolResult(result);
      } catch (err) {
        return toolError(err);
      }
    },
  );
}
