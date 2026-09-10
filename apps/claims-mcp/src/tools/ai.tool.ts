import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ClaimsApiClient } from '../server.js';
import { toolError, toolResult } from '../server.js';
import { categoryDesc } from '../categories.js';
import { proxyTool, pageLimit, dataBody } from './_proxy.js';

const CAT = 'ai' as const;

export function registerAiTools(server: McpServer, api: ClaimsApiClient): void {
  proxyTool(server, api, {
    category: CAT,
    name: 'list_ai_models',
    description: 'List supported AI models.',
    path: '/ai-chat/models',
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'list_ai_audit',
    description: 'List AI message audit records (admin).',
    path: '/ai-chat/audit',
    input: {
      ...pageLimit,
      userId: z.string().optional().describe('Filter by user UUID'),
      model: z.string().optional().describe('Filter by model'),
      status: z.string().optional().describe('Filter by status'),
      dateFrom: z.string().optional().describe('Filter from date (ISO)'),
      dateTo: z.string().optional().describe('Filter to date (ISO)'),
    },
    query: (args) => ({
      userId: args.userId as string | undefined,
      model: args.model as string | undefined,
      status: args.status as string | undefined,
      dateFrom: args.dateFrom as string | undefined,
      dateTo: args.dateTo as string | undefined,
      page: args.page as number | undefined,
      limit: args.limit as number | undefined,
    }),
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'submit_ai_feedback',
    description: 'Submit feedback for an AI message. Pass API body fields as data.',
    method: 'POST',
    path: '/ai-chat/feedback',
    input: { data: dataBody },
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'list_ai_feedback',
    description: 'List feedback for a conversation.',
    path: '/ai-chat/feedback/{conversationId}',
    input: { conversationId: z.string().describe('Conversation UUID') },
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'list_ai_memory',
    description: 'List all user AI memories.',
    path: '/ai-chat/memory',
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'upsert_ai_memory',
    description: 'Create or update a user memory. Pass key, value, and optional scope in data.',
    method: 'POST',
    path: '/ai-chat/memory',
    input: { data: dataBody },
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'delete_ai_memory',
    description: 'Delete a user memory by ID.',
    method: 'DELETE',
    path: '/ai-chat/memory/{id}',
    input: { id: z.string().describe('Memory UUID') },
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'list_ai_scheduled_tasks',
    description: 'List scheduled AI tasks for the current user.',
    path: '/ai-chat/scheduled-tasks',
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'create_ai_scheduled_task',
    description: 'Create a scheduled AI task. Pass API body fields as data.',
    method: 'POST',
    path: '/ai-chat/scheduled-tasks',
    input: { data: dataBody },
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'update_ai_scheduled_task',
    description: 'Update or toggle a scheduled AI task. Pass API body fields as data.',
    method: 'PATCH',
    path: '/ai-chat/scheduled-tasks/{id}',
    input: {
      id: z.string().describe('Scheduled task UUID'),
      data: dataBody,
    },
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'delete_ai_scheduled_task',
    description: 'Delete a scheduled AI task.',
    method: 'DELETE',
    path: '/ai-chat/scheduled-tasks/{id}',
    input: { id: z.string().describe('Scheduled task UUID') },
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'get_ai_settings',
    description: 'Get tenant AI settings.',
    path: '/ai-settings',
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'update_ai_settings',
    description: 'Create or update tenant AI settings. Pass API body fields as data.',
    method: 'PUT',
    path: '/ai-settings',
    input: { data: dataBody },
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'create_canvas',
    description: 'Create a canvas artifact. Pass API body fields as data.',
    method: 'POST',
    path: '/ai-chat/canvas',
    input: { data: dataBody },
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'get_canvas',
    description: 'Get a canvas artifact by ID.',
    path: '/ai-chat/canvas/{id}',
    input: { id: z.string().describe('Canvas artifact UUID') },
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'update_canvas',
    description: 'Update a canvas artifact (creates new version). Pass content in data.',
    method: 'PUT',
    path: '/ai-chat/canvas/{id}',
    input: {
      id: z.string().describe('Canvas artifact UUID'),
      data: dataBody,
    },
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'delete_canvas',
    description: 'Delete a canvas artifact.',
    method: 'DELETE',
    path: '/ai-chat/canvas/{id}',
    input: { id: z.string().describe('Canvas artifact UUID') },
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'list_canvas_by_conversation',
    description: 'List canvas artifacts for a conversation.',
    path: '/ai-chat/canvas/conversation/{conversationId}',
    input: { conversationId: z.string().describe('Conversation UUID') },
  });

  // ---- Feedback tracker ----
  // Notes and status changes go through the API so submitter emails still fire.

  const createFeedbackInput = {
    type: z
      .enum(['bug', 'feature_request', 'enhancement', 'question', 'comment'])
      .describe('Category of the feedback item'),
    title: z.string().describe('Short summary of the feedback'),
    description: z.string().describe('Detailed description from the user'),
    priority: z
      .enum(['low', 'medium', 'high', 'critical'])
      .optional()
      .describe('Priority level (defaults to medium)'),
    relatedEntityType: z
      .string()
      .optional()
      .describe('Entity type the feedback relates to, e.g. job, claim, quote'),
    relatedEntityId: z.string().optional().describe('UUID of the related entity'),
    conversationId: z
      .string()
      .optional()
      .describe('UUID of the chat conversation where the feedback was raised'),
    tags: z.array(z.string()).optional().describe('Free-form tags'),
    pageContext: z
      .object({
        pathname: z.string().optional(),
        section: z.string().optional(),
        entityType: z.string().optional(),
        entityId: z.string().optional(),
        jobId: z.string().optional(),
        pageLabel: z.string().optional(),
        adminArea: z.string().optional(),
        activeTab: z.string().optional(),
      })
      .optional()
      .describe(
        'Page context from the current user session — pass this from the conversation context',
      ),
  };

  const createFeedbackHandler = async (args: Record<string, unknown>) => {
    try {
      return toolResult(
        await api.request('/feedback', {
          method: 'POST',
          body: omitUndefined({
            type: args.type,
            title: args.title,
            description: args.description,
            priority: args.priority,
            relatedEntityType: args.relatedEntityType,
            relatedEntityId: args.relatedEntityId,
            conversationId: args.conversationId,
            tags: args.tags,
            pageContext: args.pageContext,
          }),
        }),
      );
    } catch (err) {
      return toolError(err);
    }
  };

  server.tool(
    'create_feedback',
    categoryDesc(
      CAT,
      'Create a feedback item (bug, feature request, enhancement, question, or comment). ' +
        'Emails the submitter. Always pass page context when available.',
    ),
    createFeedbackInput,
    createFeedbackHandler,
  );

  server.tool(
    'log_feedback',
    categoryDesc(
      CAT,
      'Alias of create_feedback. Log a bug report, feature request, enhancement, question, or comment.',
    ),
    createFeedbackInput,
    createFeedbackHandler,
  );

  proxyTool(server, api, {
    category: CAT,
    name: 'list_feedback',
    description: 'List feedback items (bugs, features, questions, etc.).',
    path: '/feedback',
    input: {
      ...pageLimit,
      type: z
        .string()
        .optional()
        .describe('Filter by type: bug, feature_request, enhancement, question, comment'),
      status: z
        .string()
        .optional()
        .describe('Filter by status: open, in_progress, resolved, closed'),
      priority: z
        .string()
        .optional()
        .describe('Filter by priority: low, medium, high, critical'),
      search: z.string().optional().describe('Search title and description'),
    },
    query: (args) => ({
      type: args.type as string | undefined,
      status: args.status as string | undefined,
      priority: args.priority as string | undefined,
      search: args.search as string | undefined,
      page: args.page as number | undefined,
      limit: args.limit as number | undefined,
    }),
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'get_feedback',
    description:
      'Get a single feedback item by ID, including its notes.',
    path: '/feedback/{id}',
    input: { id: z.string().describe('Feedback item UUID') },
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'update_feedback',
    description:
      'Update a feedback item. Changing status emails the submitter; status=resolved sends the verify-resolution email.',
    method: 'PATCH',
    path: '/feedback/{id}',
    input: {
      id: z.string().describe('Feedback item UUID'),
      status: z
        .enum(['open', 'in_progress', 'resolved', 'closed'])
        .optional()
        .describe('New status. Changing status emails the submitter.'),
      priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
      resolution: z.string().optional().describe('Resolution notes stored on the item'),
      title: z.string().optional(),
      description: z.string().optional(),
      tags: z.array(z.string()).optional(),
    },
    body: (args) =>
      omitUndefined({
        status: args.status,
        priority: args.priority,
        resolution: args.resolution,
        title: args.title,
        description: args.description,
        tags: args.tags,
      }),
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'delete_feedback',
    description:
      'Delete a feedback item and its notes. Does not email the submitter. Requires feedback.manage.',
    method: 'DELETE',
    path: '/feedback/{id}',
    input: { id: z.string().describe('Feedback item UUID') },
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'add_feedback_note',
    description:
      'Add a note to a feedback item. Emails the original submitter with the note body.',
    method: 'POST',
    path: '/feedback/{id}/notes',
    input: {
      id: z.string().describe('Feedback item UUID'),
      body: z.string().describe('Note text included in the email to the submitter'),
    },
    body: (args) => ({ body: args.body }),
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'update_feedback_note',
    description:
      'Update a note you created on a feedback item. Does not email the submitter.',
    method: 'PATCH',
    path: '/feedback/{id}/notes/{noteId}',
    input: {
      id: z.string().describe('Feedback item UUID'),
      noteId: z.string().describe('Note UUID'),
      body: z.string().describe('Replacement note text'),
    },
    body: (args) => ({ body: args.body }),
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'delete_feedback_note',
    description:
      'Delete a note you created on a feedback item. Does not email the submitter.',
    method: 'DELETE',
    path: '/feedback/{id}/notes/{noteId}',
    input: {
      id: z.string().describe('Feedback item UUID'),
      noteId: z.string().describe('Note UUID'),
    },
  });
}

function omitUndefined(value: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined),
  );
}
