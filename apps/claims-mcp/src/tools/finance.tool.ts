import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ClaimsApiClient } from '../server.js';
import { proxyTool } from './_proxy.js';

const CAT = 'operations' as const;

export function registerFinanceTools(server: McpServer, api: ClaimsApiClient): void {
  proxyTool(server, api, {
    category: CAT,
    name: 'get_finance_ar',
    description: 'Get accounts receivable summary.',
    path: '/finance/ar',
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'get_finance_ap',
    description: 'Get accounts payable summary.',
    path: '/finance/ap',
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'get_finance_summary',
    description: 'Get combined finance summary (AR, AP, totals).',
    path: '/finance/summary',
  });
}
