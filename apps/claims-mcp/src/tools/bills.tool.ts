import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ClaimsApiClient } from '../server.js';
import { proxyTool, pageLimit, dataBody } from './_proxy.js';
import { z } from 'zod';

const CAT = 'operations' as const;

export function registerBillsTools(server: McpServer, api: ClaimsApiClient): void {
  proxyTool(server, api, {
    category: CAT,
    name: 'list_bills',
    description: 'List bills with pagination and filters.',
    path: '/bills',
    query: (args) => ({
      page: (args.page as number | undefined) ?? 1,
      limit: args.limit as number | undefined,
      jobId: args.jobId as string | undefined,
      purchaseOrderId: args.purchaseOrderId as string | undefined,
      status: args.status as string | undefined,
      vendorId: args.vendorId as string | undefined,
      sort: args.sort as string | undefined,
    }),
    input: {
      ...pageLimit,
      jobId: z.string().optional().describe('Filter by job UUID'),
      purchaseOrderId: z.string().optional().describe('Filter by purchase order UUID'),
      status: z.string().optional().describe('Filter by status'),
      vendorId: z.string().optional().describe('Filter by vendor UUID'),
      sort: z.string().optional().describe('Sort expression'),
    },
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'get_bill',
    description: 'Get a single bill by ID.',
    path: '/bills/{id}',
    input: { id: z.string().describe('Bill UUID') },
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'create_bill',
    description: 'Create a new bill. Pass API body fields as data.',
    method: 'POST',
    path: '/bills',
    input: { data: dataBody },
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'update_bill',
    description: 'Update an existing bill. Pass API body fields as data.',
    method: 'POST',
    path: '/bills/{id}',
    input: {
      id: z.string().describe('Bill UUID'),
      data: dataBody,
    },
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'list_bills_by_job',
    description: 'List bills for a job.',
    path: '/bills/job/{jobId}',
    input: { jobId: z.string().describe('Job UUID') },
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'list_bills_by_po',
    description: 'List bills for a purchase order.',
    path: '/bills/purchase-order/{purchaseOrderId}',
    input: { purchaseOrderId: z.string().describe('Purchase order UUID') },
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'list_bills_by_vendor',
    description: 'List bills for a vendor.',
    path: '/bills/vendor/{vendorId}',
    input: { vendorId: z.string().describe('Vendor UUID') },
  });
}
