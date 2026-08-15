import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ClaimsApiClient } from '../server.js';
import { proxyTool, pageLimit, dataBody } from './_proxy.js';
import { z } from 'zod';

const CAT = 'operations' as const;

export function registerInvoicesTools(server: McpServer, api: ClaimsApiClient): void {
  proxyTool(server, api, {
    category: CAT,
    name: 'list_invoices',
    description: 'List invoices with pagination and filters.',
    path: '/invoices',
    query: (args) => ({
      page: (args.page as number | undefined) ?? 1,
      limit: args.limit as number | undefined,
      purchaseOrderId: args.purchaseOrderId as string | undefined,
      jobId: args.jobId as string | undefined,
      status: args.status as string | undefined,
      statusId: args.statusId as string | undefined,
      sort: args.sort as string | undefined,
    }),
    input: {
      ...pageLimit,
      purchaseOrderId: z.string().optional().describe('Filter by purchase order UUID'),
      jobId: z.string().optional().describe('Filter by job UUID'),
      status: z.string().optional().describe('Filter by status'),
      statusId: z.string().optional().describe('Filter by status lookup UUID'),
      sort: z.string().optional().describe('Sort expression'),
    },
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'get_invoice',
    description: 'Get a single invoice by ID.',
    path: '/invoices/{id}',
    input: { id: z.string().describe('Invoice UUID') },
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'create_invoice',
    description: 'Create a new invoice. Pass API body fields as data.',
    method: 'POST',
    path: '/invoices',
    input: { data: dataBody },
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'update_invoice',
    description: 'Update an existing invoice. Pass API body fields as data.',
    method: 'POST',
    path: '/invoices/{id}',
    input: {
      id: z.string().describe('Invoice UUID'),
      data: dataBody,
    },
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'publish_invoice',
    description: 'Publish an invoice.',
    method: 'POST',
    path: '/invoices/{id}/publish',
    input: { id: z.string().describe('Invoice UUID') },
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'list_invoices_by_job',
    description: 'List invoices for a job.',
    path: '/invoices/job/{jobId}',
    input: { jobId: z.string().describe('Job UUID') },
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'list_invoices_by_po',
    description: 'List invoices for a purchase order.',
    path: '/invoices/purchase-order/{purchaseOrderId}',
    input: { purchaseOrderId: z.string().describe('Purchase order UUID') },
  });
}
