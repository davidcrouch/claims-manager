import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ClaimsApiClient } from '../server.js';
import { proxyTool, pageLimit, dataBody } from './_proxy.js';
import { z } from 'zod';

const CAT = 'operations' as const;

export function registerWorkOrdersTools(server: McpServer, api: ClaimsApiClient): void {
  proxyTool(server, api, {
    category: CAT,
    name: 'list_work_orders',
    description: 'List work orders with pagination and filters.',
    path: '/work-orders',
    query: (args) => ({
      page: (args.page as number | undefined) ?? 1,
      limit: args.limit as number | undefined,
      jobId: args.jobId as string | undefined,
      purchaseOrderId: args.purchaseOrderId as string | undefined,
      status: args.status as string | undefined,
      workOrderType: args.workOrderType as string | undefined,
      sort: args.sort as string | undefined,
    }),
    input: {
      ...pageLimit,
      jobId: z.string().optional().describe('Filter by job UUID'),
      purchaseOrderId: z.string().optional().describe('Filter by purchase order UUID'),
      status: z.string().optional().describe('Filter by status'),
      workOrderType: z.string().optional().describe('Filter by work order type'),
      sort: z.string().optional().describe('Sort expression'),
    },
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'get_work_order',
    description: 'Get a single work order by ID.',
    path: '/work-orders/{id}',
    input: { id: z.string().describe('Work order UUID') },
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'create_work_order',
    description: 'Create a new work order. Pass API body fields as data.',
    method: 'POST',
    path: '/work-orders',
    input: { data: dataBody },
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'update_work_order',
    description: 'Update an existing work order. Pass API body fields as data.',
    method: 'POST',
    path: '/work-orders/{id}',
    input: {
      id: z.string().describe('Work order UUID'),
      data: dataBody,
    },
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'list_work_orders_by_job',
    description: 'List work orders for a job.',
    path: '/work-orders/job/{jobId}',
    input: { jobId: z.string().describe('Job UUID') },
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'list_work_orders_by_po',
    description: 'List work orders for a purchase order.',
    path: '/work-orders/purchase-order/{purchaseOrderId}',
    input: { purchaseOrderId: z.string().describe('Purchase order UUID') },
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'get_work_order_line_items',
    description: 'Get line items for a work order.',
    path: '/work-orders/{id}/line-items',
    input: { id: z.string().describe('Work order UUID') },
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'add_catalog_item_to_wo_group',
    description: 'Add a catalog item to a work order group. Pass API body as data.',
    method: 'POST',
    path: '/work-orders/{woId}/groups/{groupId}/catalog-items',
    input: {
      woId: z.string().describe('Work order UUID'),
      groupId: z.string().describe('Work order group UUID'),
      data: dataBody,
    },
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'add_catalog_assembly_to_wo_group',
    description: 'Add a catalog assembly to a work order group. Pass API body as data.',
    method: 'POST',
    path: '/work-orders/{woId}/groups/{groupId}/catalog-assemblies',
    input: {
      woId: z.string().describe('Work order UUID'),
      groupId: z.string().describe('Work order group UUID'),
      data: dataBody,
    },
  });
}
