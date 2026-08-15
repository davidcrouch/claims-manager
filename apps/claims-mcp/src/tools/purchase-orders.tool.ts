import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ClaimsApiClient } from '../server.js';
import { proxyTool, pageLimit, dataBody } from './_proxy.js';
import { z } from 'zod';

const CAT = 'operations' as const;

export function registerPurchaseOrdersTools(server: McpServer, api: ClaimsApiClient): void {
  proxyTool(server, api, {
    category: CAT,
    name: 'list_purchase_orders',
    description: 'List purchase orders with pagination and filters.',
    path: '/purchase-orders',
    query: (args) => ({
      page: (args.page as number | undefined) ?? 1,
      limit: args.limit as number | undefined,
      jobId: args.jobId as string | undefined,
      status: args.status as string | undefined,
      vendorId: args.vendorId as string | undefined,
      ownershipStatus: args.ownershipStatus as string | undefined,
      captureMethod: args.captureMethod as string | undefined,
      sort: args.sort as string | undefined,
    }),
    input: {
      ...pageLimit,
      jobId: z.string().optional().describe('Filter by job UUID'),
      status: z.string().optional().describe('Filter by status'),
      vendorId: z.string().optional().describe('Filter by vendor UUID'),
      ownershipStatus: z.string().optional().describe('Filter by ownership status'),
      captureMethod: z.string().optional().describe('Filter by capture method'),
      sort: z.string().optional().describe('Sort expression'),
    },
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'get_purchase_order',
    description: 'Get a single purchase order by ID.',
    path: '/purchase-orders/{id}',
    input: { id: z.string().describe('Purchase order UUID') },
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'create_purchase_order',
    description: 'Create a new purchase order. Pass API body fields as data.',
    method: 'POST',
    path: '/purchase-orders',
    input: { data: dataBody },
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'update_purchase_order',
    description: 'Update an existing purchase order. Pass API body fields as data.',
    method: 'POST',
    path: '/purchase-orders/{id}',
    input: {
      id: z.string().describe('Purchase order UUID'),
      data: dataBody,
    },
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'list_purchase_orders_by_job',
    description: 'List purchase orders for a job.',
    path: '/purchase-orders/job/{jobId}',
    input: { jobId: z.string().describe('Job UUID') },
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'get_purchase_order_line_items',
    description: 'Get line items for a purchase order.',
    path: '/purchase-orders/{id}/line-items',
    input: { id: z.string().describe('Purchase order UUID') },
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'capture_purchase_order',
    description: 'Capture a purchase order from external data. Pass capture payload as data.',
    method: 'POST',
    path: '/purchase-orders/capture',
    input: { data: dataBody },
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'add_catalog_item_to_po_group',
    description: 'Add a catalog item to a purchase order group. Pass API body as data.',
    method: 'POST',
    path: '/purchase-orders/{poId}/groups/{groupId}/catalog-items',
    input: {
      poId: z.string().describe('Purchase order UUID'),
      groupId: z.string().describe('Purchase order group UUID'),
      data: dataBody,
    },
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'add_catalog_assembly_to_po_group',
    description: 'Add a catalog assembly to a purchase order group. Pass API body as data.',
    method: 'POST',
    path: '/purchase-orders/{poId}/groups/{groupId}/catalog-assemblies',
    input: {
      poId: z.string().describe('Purchase order UUID'),
      groupId: z.string().describe('Purchase order group UUID'),
      data: dataBody,
    },
  });
}
