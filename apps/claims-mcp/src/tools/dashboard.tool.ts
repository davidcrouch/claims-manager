import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ClaimsApiClient } from '../server.js';
import { proxyTool } from './_proxy.js';

const CAT = 'operations' as const;

export function registerDashboardTools(server: McpServer, api: ClaimsApiClient): void {
  proxyTool(server, api, {
    category: CAT,
    name: 'get_dashboard_inbox',
    description: 'Get dashboard inbox summary for the current user.',
    path: '/dashboard/inbox',
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'get_dashboard_stats',
    description: 'Get dashboard statistics.',
    path: '/dashboard/stats',
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'get_dashboard_recent_activity',
    description: 'Get recent activity feed for the dashboard.',
    path: '/dashboard/recent-activity',
    input: {
      limit: z.number().int().positive().optional().describe('Max items to return'),
    },
    query: (args) => ({
      limit: args.limit as number | undefined,
    }),
  });
}
