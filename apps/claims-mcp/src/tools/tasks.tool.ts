import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ClaimsApiClient } from '../server.js';
import { toolError, toolResult } from '../server.js';
import { categoryDesc } from '../categories.js';

const CAT = 'operations' as const;

export function registerTasksTools(server: McpServer, api: ClaimsApiClient): void {
  server.tool(
    'search_tasks',
    categoryDesc(CAT, 'List tasks with filters and pagination.'),
    {
      query: z
        .string()
        .optional()
        .describe('Optional client-side filter applied after fetch'),
      jobId: z.string().optional().describe('Filter by job UUID'),
      claimId: z.string().optional().describe('Filter by claim UUID'),
      page: z.number().int().positive().optional().describe('Page number (default 1)'),
      limit: z.number().int().positive().optional().describe('Page size'),
      status: z.string().optional().describe('Filter by status'),
      priority: z.string().optional().describe('Filter by priority'),
      entityType: z.string().optional().describe('Filter by related entity type'),
      entityId: z.string().optional().describe('Filter by related entity UUID'),
      assignedToUserId: z.string().optional().describe('Filter by assignee'),
      overdue: z.boolean().optional().describe('When true, only overdue tasks'),
      sort: z.string().optional().describe('Sort expression'),
    },
    async (args) => {
      try {
        const result = await api.request<Record<string, unknown>>('/tasks', {
          query: {
            jobId: args.jobId,
            claimId: args.claimId,
            page: args.page ?? 1,
            limit: args.limit,
            status: args.status,
            priority: args.priority,
            entityType: args.entityType,
            entityId: args.entityId,
            assignedToUserId: args.assignedToUserId,
            overdue: args.overdue === true ? 'true' : undefined,
            sort: args.sort,
          },
        });

        if (args.query?.trim()) {
          const needle = args.query.trim().toLowerCase();
          const items = Array.isArray(result.data)
            ? result.data.filter((item) =>
                JSON.stringify(item).toLowerCase().includes(needle),
              )
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
    'get_task',
    categoryDesc(CAT, 'Get a single task by ID.'),
    {
      id: z.string().describe('Task UUID'),
    },
    async ({ id }) => {
      try {
        return toolResult(await api.request(`/tasks/${id}`));
      } catch (err) {
        return toolError(err);
      }
    },
  );

  server.tool(
    'list_tasks_by_job',
    categoryDesc(CAT, 'List tasks for a job.'),
    {
      jobId: z.string().describe('Job UUID'),
    },
    async ({ jobId }) => {
      try {
        return toolResult(await api.request(`/tasks/job/${jobId}`));
      } catch (err) {
        return toolError(err);
      }
    },
  );

  server.tool(
    'list_tasks_by_claim',
    categoryDesc(CAT, 'List tasks for a claim.'),
    {
      claimId: z.string().describe('Claim UUID'),
    },
    async ({ claimId }) => {
      try {
        return toolResult(await api.request(`/tasks/claim/${claimId}`));
      } catch (err) {
        return toolError(err);
      }
    },
  );

  server.tool(
    'list_tasks_by_entity',
    categoryDesc(CAT, 'List tasks for an arbitrary related entity.'),
    {
      entityType: z.string().describe('Related entity type'),
      entityId: z.string().describe('Related entity UUID'),
    },
    async ({ entityType, entityId }) => {
      try {
        return toolResult(await api.request(`/tasks/entity/${entityType}/${entityId}`));
      } catch (err) {
        return toolError(err);
      }
    },
  );

  server.tool(
    'list_overdue_tasks',
    categoryDesc(CAT, 'List overdue tasks.'),
    {},
    async () => {
      try {
        return toolResult(await api.request('/tasks/overdue'));
      } catch (err) {
        return toolError(err);
      }
    },
  );

  server.tool(
    'create_task',
    categoryDesc(CAT, 'Create a new task. Pass API body fields as data.'),
    {
      data: z.record(z.unknown()).describe('Task create payload (API body)'),
    },
    async ({ data }) => {
      try {
        return toolResult(await api.request('/tasks', { method: 'POST', body: data }));
      } catch (err) {
        return toolError(err);
      }
    },
  );

  server.tool(
    'update_task',
    categoryDesc(CAT, 'Update an existing task. Pass API body fields as data.'),
    {
      id: z.string().describe('Task UUID'),
      data: z.record(z.unknown()).describe('Task update payload (API body)'),
    },
    async ({ id, data }) => {
      try {
        return toolResult(
          await api.request(`/tasks/${id}`, { method: 'POST', body: data }),
        );
      } catch (err) {
        return toolError(err);
      }
    },
  );

  server.tool(
    'close_all_tasks',
    categoryDesc(
      CAT,
      'Close all open tasks on a job. Sets status to Closed for every task with status Open.',
    ),
    {
      jobId: z.string().describe('Job UUID'),
    },
    async ({ jobId }) => {
      try {
        const result = await api.request<Record<string, unknown>>(
          `/tasks/job/${jobId}`,
        );
        const tasks = Array.isArray(result)
          ? result
          : Array.isArray((result as Record<string, unknown>).data)
            ? ((result as Record<string, unknown>).data as Record<string, unknown>[])
            : [];
        const openTasks = tasks.filter(
          (t: Record<string, unknown>) =>
            t.status === 'Open' || t.status === 'open',
        );
        const closed: string[] = [];
        const errors: string[] = [];
        for (const task of openTasks) {
          try {
            await api.request(`/tasks/${task.id}`, {
              method: 'POST',
              body: { status: 'Closed' },
            });
            closed.push(task.id as string);
          } catch (err) {
            errors.push(
              `${task.id}: ${err instanceof Error ? err.message : String(err)}`,
            );
          }
        }
        return toolResult({
          jobId,
          totalOpen: openTasks.length,
          closed: closed.length,
          errors,
        });
      } catch (err) {
        return toolError(err);
      }
    },
  );
}
