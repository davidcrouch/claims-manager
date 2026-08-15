import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ClaimsApiClient } from '../server.js';
import { proxyTool, pageLimit, dataBody } from './_proxy.js';
import { z } from 'zod';

const CAT = 'operations' as const;

export function registerRfqsTools(server: McpServer, api: ClaimsApiClient): void {
  proxyTool(server, api, {
    category: CAT,
    name: 'list_rfqs',
    description: 'List RFQs with pagination and filters.',
    path: '/rfqs',
    query: (args) => ({
      page: (args.page as number | undefined) ?? 1,
      limit: args.limit as number | undefined,
      jobId: args.jobId as string | undefined,
      quoteId: args.quoteId as string | undefined,
      status: args.status as string | undefined,
      vendorId: args.vendorId as string | undefined,
      sort: args.sort as string | undefined,
    }),
    input: {
      ...pageLimit,
      jobId: z.string().optional().describe('Filter by job UUID'),
      quoteId: z.string().optional().describe('Filter by quote UUID'),
      status: z.string().optional().describe('Filter by status'),
      vendorId: z.string().optional().describe('Filter by vendor UUID'),
      sort: z.string().optional().describe('Sort expression'),
    },
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'get_rfq',
    description: 'Get a single RFQ by ID.',
    path: '/rfqs/{id}',
    input: { id: z.string().describe('RFQ UUID') },
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'create_rfq',
    description: 'Create a new RFQ. Pass API body fields as data.',
    method: 'POST',
    path: '/rfqs',
    input: { data: dataBody },
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'update_rfq',
    description: 'Update an existing RFQ. Pass API body fields as data.',
    method: 'POST',
    path: '/rfqs/{id}',
    input: {
      id: z.string().describe('RFQ UUID'),
      data: dataBody,
    },
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'list_rfqs_by_job',
    description: 'List RFQs for a job.',
    path: '/rfqs/job/{jobId}',
    input: { jobId: z.string().describe('Job UUID') },
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'list_rfqs_by_quote',
    description: 'List RFQs for a quote.',
    path: '/rfqs/quote/{quoteId}',
    input: { quoteId: z.string().describe('Quote UUID') },
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'get_rfq_line_items',
    description: 'Get line items for an RFQ.',
    path: '/rfqs/{id}/line-items',
    input: { id: z.string().describe('RFQ UUID') },
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'set_rfq_line_items',
    description: 'Replace RFQ scope line items. Pass selectedItemIds as data.',
    method: 'POST',
    path: '/rfqs/{id}/line-items',
    input: {
      id: z.string().describe('RFQ UUID'),
      data: dataBody,
    },
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'patch_rfq_line_notes',
    description: 'Update a line note on an RFQ group, combo, or item. Pass API body as data.',
    method: 'PATCH',
    path: '/rfqs/{id}/line-notes',
    input: {
      id: z.string().describe('RFQ UUID'),
      data: dataBody,
    },
  });
}
