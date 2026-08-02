import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ClaimsApiClient } from '../server.js';
import { toolError, toolResult } from '../server.js';

export function registerTasksTools(server: McpServer, api: ClaimsApiClient): void {
  server.tool(
    'search_tasks',
    'List tasks with optional job or claim filters and pagination.',
    {
      query: z.string().optional().describe('Optional client-side filter hint (not sent to API yet)'),
      jobId: z.string().optional().describe('Filter by job UUID'),
      claimId: z.string().optional().describe('Filter by claim UUID'),
      page: z.number().int().positive().optional().describe('Page number (default 1)'),
    },
    async ({ query, jobId, claimId, page }) => {
      try {
        const result = await api.request<Record<string, unknown>>('/tasks', {
          query: { jobId, claimId, page: page ?? 1 },
        });

        if (query?.trim()) {
          const needle = query.trim().toLowerCase();
          const items = Array.isArray(result.data)
            ? result.data.filter((item) => JSON.stringify(item).toLowerCase().includes(needle))
            : result;
          return toolResult({ ...result, data: items });
        }

        return toolResult(result);
      } catch (err) {
        return toolError(err);
      }
    },
  );

  server.tool(
    'create_task',
    'Create a new task linked to a job or claim.',
    {
      name: z.string().describe('Task name'),
      jobId: z.string().optional().describe('Related job UUID'),
      claimId: z.string().optional().describe('Related claim UUID'),
      description: z.string().optional().describe('Task description'),
    },
    async ({ name, jobId, claimId, description }) => {
      try {
        const result = await api.request('/tasks', {
          method: 'POST',
          body: {
            name,
            jobId,
            claimId,
            description,
            relatedEntityType: jobId ? 'Job' : claimId ? 'Claim' : 'Job',
            relatedEntityId: jobId ?? claimId,
          },
        });
        return toolResult(result);
      } catch (err) {
        return toolError(err);
      }
    },
  );
}
