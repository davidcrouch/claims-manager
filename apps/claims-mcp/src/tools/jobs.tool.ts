import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ClaimsApiClient } from '../server.js';
import { toolError, toolResult } from '../server.js';
import { categoryDesc } from '../categories.js';

const CAT = 'operations' as const;

export function registerJobsTools(server: McpServer, api: ClaimsApiClient): void {
  server.tool(
    'search_jobs',
    categoryDesc(CAT, 'Search/list jobs with pagination and filters.'),
    {
      query: z.string().optional().describe('Search text'),
      claimId: z.string().optional().describe('Filter by claim UUID'),
      page: z.number().int().positive().optional().describe('Page number (default 1)'),
      limit: z.number().int().positive().optional().describe('Page size (default 20)'),
      sort: z.string().optional().describe('Sort expression'),
      status: z.string().optional().describe('Filter by status'),
      jobType: z.string().optional().describe('Filter by job type'),
      assignedToUserId: z.string().optional().describe('Filter by assignee user UUID'),
    },
    async (args) => {
      try {
        return toolResult(
          await api.request('/jobs', {
            query: {
              search: args.query,
              claimId: args.claimId,
              page: args.page ?? 1,
              limit: args.limit,
              sort: args.sort,
              status: args.status,
              jobType: args.jobType,
              assignedToUserId: args.assignedToUserId,
            },
          }),
        );
      } catch (err) {
        return toolError(err);
      }
    },
  );

  server.tool(
    'get_job',
    categoryDesc(CAT, 'Get a single job by ID.'),
    {
      id: z.string().describe('Job UUID'),
    },
    async ({ id }) => {
      try {
        return toolResult(await api.request(`/jobs/${id}`));
      } catch (err) {
        return toolError(err);
      }
    },
  );

  server.tool(
    'create_job',
    categoryDesc(CAT, 'Create a new job. Pass API body fields as data.'),
    {
      data: z.record(z.unknown()).describe('Job create payload (API body)'),
      provider: z.string().optional().describe('Optional provider override query param'),
    },
    async ({ data, provider }) => {
      try {
        return toolResult(
          await api.request('/jobs', {
            method: 'POST',
            query: { provider },
            body: data,
          }),
        );
      } catch (err) {
        return toolError(err);
      }
    },
  );

  server.tool(
    'update_job',
    categoryDesc(CAT, 'Update an existing job. Pass API body fields as data.'),
    {
      id: z.string().describe('Job UUID'),
      data: z.record(z.unknown()).describe('Job update payload (API body)'),
      provider: z.string().optional().describe('Optional provider override query param'),
    },
    async ({ id, data, provider }) => {
      try {
        return toolResult(
          await api.request(`/jobs/${id}`, {
            method: 'POST',
            query: { provider },
            body: data,
          }),
        );
      } catch (err) {
        return toolError(err);
      }
    },
  );

  server.tool(
    'calculate_dates',
    categoryDesc(CAT, 'Calculate SLA-based workflow dates for a job (attendanceDueDate, submissionDueDate).'),
    {
      jobId: z.string().describe('Job UUID'),
      contactDate: z.string().optional().describe('ISO date when customer was contacted (for attendanceDueDate)'),
      attendanceDate: z.string().optional().describe('ISO date of site attendance (for submissionDueDate)'),
    },
    async (args) => {
      try {
        return toolResult(
          await api.request(`/jobs/${args.jobId}/calculate-dates`, {
            method: 'POST',
            body: {
              contactDate: args.contactDate,
              attendanceDate: args.attendanceDate,
            },
          }),
        );
      } catch (err) {
        return toolError(err);
      }
    },
  );

  server.tool(
    'add_job_contacts',
    categoryDesc(CAT, 'Add contacts to a job.'),
    {
      id: z.string().describe('Job UUID'),
      contacts: z
        .array(z.record(z.unknown()))
        .describe('Contact link objects to add'),
    },
    async ({ id, contacts }) => {
      try {
        return toolResult(
          await api.request(`/jobs/${id}/contacts`, {
            method: 'POST',
            body: { contacts },
          }),
        );
      } catch (err) {
        return toolError(err);
      }
    },
  );

  server.tool(
    'remove_job_contact',
    categoryDesc(CAT, 'Remove a contact from a job.'),
    {
      id: z.string().describe('Job UUID'),
      contactId: z.string().describe('Contact UUID to remove'),
    },
    async ({ id, contactId }) => {
      try {
        return toolResult(
          await api.request(`/jobs/${id}/contacts/${contactId}`, {
            method: 'DELETE',
          }),
        );
      } catch (err) {
        return toolError(err);
      }
    },
  );
}
