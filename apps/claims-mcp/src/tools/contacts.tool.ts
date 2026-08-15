import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ClaimsApiClient } from '../server.js';
import { toolError, toolResult } from '../server.js';
import { categoryDesc } from '../categories.js';

const CAT = 'operations' as const;

export function registerContactsTools(server: McpServer, api: ClaimsApiClient): void {
  server.tool(
    'search_contacts',
    categoryDesc(CAT, 'Search/list contacts with pagination and filters.'),
    {
      query: z.string().optional().describe('Search text'),
      page: z.number().int().positive().optional().describe('Page number (default 1)'),
      limit: z.number().int().positive().optional().describe('Page size'),
      sort: z.string().optional().describe('Sort expression'),
      jobId: z.string().optional().describe('Filter by job UUID'),
    },
    async ({ query, page, limit, sort, jobId }) => {
      try {
        return toolResult(
          await api.request('/contacts', {
            query: { search: query, page: page ?? 1, limit, sort, jobId },
          }),
        );
      } catch (err) {
        return toolError(err);
      }
    },
  );

  server.tool(
    'get_contact',
    categoryDesc(CAT, 'Get a single contact by ID.'),
    {
      id: z.string().describe('Contact UUID'),
    },
    async ({ id }) => {
      try {
        return toolResult(await api.request(`/contacts/${id}`));
      } catch (err) {
        return toolError(err);
      }
    },
  );

  server.tool(
    'create_contact',
    categoryDesc(CAT, 'Create a new contact.'),
    {
      firstName: z.string().optional().describe('Contact first name'),
      lastName: z.string().optional().describe('Contact last name'),
      email: z.string().optional().describe('Contact email address'),
      mobilePhone: z.string().optional(),
      homePhone: z.string().optional(),
      workPhone: z.string().optional(),
      notes: z.string().optional(),
      typeLookupId: z.string().optional().describe('Contact type lookup UUID'),
    },
    async (body) => {
      try {
        return toolResult(await api.request('/contacts', { method: 'POST', body }));
      } catch (err) {
        return toolError(err);
      }
    },
  );

  server.tool(
    'list_contacts_by_job',
    categoryDesc(CAT, 'List contacts linked to a job.'),
    {
      jobId: z.string().describe('Job UUID'),
    },
    async ({ jobId }) => {
      try {
        return toolResult(await api.request(`/contacts/job/${jobId}`));
      } catch (err) {
        return toolError(err);
      }
    },
  );

  server.tool(
    'list_contact_jobs',
    categoryDesc(CAT, 'List jobs related to a contact.'),
    {
      id: z.string().describe('Contact UUID'),
    },
    async ({ id }) => {
      try {
        return toolResult(await api.request(`/contacts/${id}/jobs`));
      } catch (err) {
        return toolError(err);
      }
    },
  );

  server.tool(
    'search_users',
    categoryDesc(CAT, 'Search tenant users (for assignee/contact pickers).'),
    {
      search: z.string().optional().describe('Search text'),
      limit: z.number().int().positive().optional().describe('Max results'),
    },
    async ({ search, limit }) => {
      try {
        return toolResult(
          await api.request('/contacts/search-users', {
            query: { search, limit },
          }),
        );
      } catch (err) {
        return toolError(err);
      }
    },
  );
}
