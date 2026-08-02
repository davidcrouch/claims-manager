import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ClaimsApiClient } from '../server.js';
import { toolError, toolResult } from '../server.js';

export function registerContactsTools(server: McpServer, api: ClaimsApiClient): void {
  server.tool(
    'search_contacts',
    'Search contacts with optional pagination.',
    {
      query: z.string().optional().describe('Search text'),
      page: z.number().int().positive().optional().describe('Page number (default 1)'),
    },
    async ({ query, page }) => {
      try {
        const result = await api.request('/contacts', {
          query: { search: query, page: page ?? 1 },
        });
        return toolResult(result);
      } catch (err) {
        return toolError(err);
      }
    },
  );

  server.tool(
    'create_contact',
    'Create a new contact.',
    {
      firstName: z.string().describe('Contact first name'),
      lastName: z.string().optional().describe('Contact last name'),
      email: z.string().optional().describe('Contact email address'),
    },
    async ({ firstName, lastName, email }) => {
      try {
        const result = await api.request('/contacts', {
          method: 'POST',
          body: { firstName, lastName, email },
        });
        return toolResult(result);
      } catch (err) {
        return toolError(err);
      }
    },
  );
}
