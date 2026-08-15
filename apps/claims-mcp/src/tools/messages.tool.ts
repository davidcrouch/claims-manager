import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ClaimsApiClient } from '../server.js';
import { proxyTool, pageLimit, dataBody } from './_proxy.js';
import { z } from 'zod';

const CAT = 'ai' as const;

export function registerMessagesTools(server: McpServer, api: ClaimsApiClient): void {
  proxyTool(server, api, {
    category: CAT,
    name: 'list_messages',
    description: 'List messages with pagination and optional job filters.',
    path: '/messages',
    input: {
      ...pageLimit,
      jobId: z.string().optional().describe('Filter by job UUID'),
      fromJobId: z.string().optional().describe('Filter by sender job UUID'),
      toJobId: z.string().optional().describe('Filter by recipient job UUID'),
    },
    query: (args) => ({
      page: args.page as number | undefined,
      limit: args.limit as number | undefined,
      jobId: args.jobId as string | undefined,
      fromJobId: args.fromJobId as string | undefined,
      toJobId: args.toJobId as string | undefined,
    }),
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'get_message',
    description: 'Get a single message by ID.',
    path: '/messages/{id}',
    input: {
      id: z.string().describe('Message UUID'),
    },
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'create_message',
    description: 'Send/create a new message.',
    method: 'POST',
    path: '/messages',
    input: {
      data: dataBody,
    },
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'acknowledge_message',
    description: 'Acknowledge receipt of a message.',
    method: 'POST',
    path: '/messages/{id}/acknowledge',
    input: {
      id: z.string().describe('Message UUID'),
    },
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'list_conversations',
    description: 'List AI conversations for the current user.',
    path: '/conversations',
    input: {
      search: z.string().optional().describe('Search conversations by title'),
    },
    query: (args) => ({
      search: args.search as string | undefined,
    }),
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'get_conversation',
    description: 'Get a single conversation with messages.',
    path: '/conversations/{id}',
    input: {
      id: z.string().describe('Conversation UUID'),
    },
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'get_shared_conversation',
    description: 'Get a shared conversation by public share token (no auth required on API).',
    path: '/conversations/shared/{token}',
    input: {
      token: z.string().describe('Share token from a conversation share link'),
    },
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'create_conversation',
    description: 'Create a new AI conversation.',
    method: 'POST',
    path: '/conversations',
    input: {
      data: dataBody,
    },
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'update_conversation',
    description: 'Update a conversation (title, messages, pin, related entity).',
    method: 'PATCH',
    path: '/conversations/{id}',
    input: {
      id: z.string().describe('Conversation UUID'),
      data: dataBody,
    },
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'share_conversation',
    description: 'Create a shareable link for a conversation.',
    method: 'POST',
    path: '/conversations/{id}/share',
    input: {
      id: z.string().describe('Conversation UUID'),
      data: dataBody,
    },
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'delete_conversation',
    description: 'Delete a conversation.',
    method: 'DELETE',
    path: '/conversations/{id}',
    input: {
      id: z.string().describe('Conversation UUID'),
    },
  });
}
