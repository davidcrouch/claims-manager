import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ClaimsApiClient } from '../server.js';
import { proxyTool, pageLimit } from './_proxy.js';

const CAT = 'organisation' as const;

export function registerNotificationsTools(server: McpServer, api: ClaimsApiClient): void {
  proxyTool(server, api, {
    category: CAT,
    name: 'list_notifications',
    description: 'List notifications with pagination and filters.',
    path: '/notifications',
    input: {
      ...pageLimit,
      entityType: z.string().optional().describe('Filter by entity type'),
      isRead: z.boolean().optional().describe('Filter by read status'),
    },
    query: (args) => ({
      entityType: args.entityType as string | undefined,
      isRead: args.isRead === true ? 'true' : args.isRead === false ? 'false' : undefined,
      page: (args.page as number | undefined) ?? 1,
      limit: args.limit as number | undefined,
    }),
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'get_unread_count',
    description: 'Get total unread notification count.',
    path: '/notifications/unread-count',
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'get_unread_entity_ids',
    description: 'Get entity IDs with unread notifications for an entity type.',
    path: '/notifications/unread-entity-ids',
    input: {
      entityType: z.string().describe('Entity type to check'),
    },
    query: (args) => ({ entityType: args.entityType as string }),
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'mark_notification_read',
    description: 'Mark a single notification as read.',
    method: 'PATCH',
    path: '/notifications/{id}/read',
    input: { id: z.string().describe('Notification UUID') },
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'mark_entity_notifications_read',
    description: 'Mark all notifications for an entity as read.',
    method: 'PATCH',
    path: '/notifications/entity/{entityType}/{entityId}/read',
    input: {
      entityType: z.string().describe('Entity type'),
      entityId: z.string().describe('Entity UUID'),
    },
  });
}
