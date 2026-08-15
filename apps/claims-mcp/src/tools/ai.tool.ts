import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ClaimsApiClient } from '../server.js';
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
}
