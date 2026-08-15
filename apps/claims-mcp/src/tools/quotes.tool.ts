import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ClaimsApiClient } from '../server.js';
import { proxyTool, pageLimit, dataBody } from './_proxy.js';
import { z } from 'zod';

const CAT = 'operations' as const;

export function registerQuotesTools(server: McpServer, api: ClaimsApiClient): void {
  proxyTool(server, api, {
    category: CAT,
    name: 'list_quotes',
    description: 'List quotes with pagination and filters.',
    path: '/quotes',
    query: (args) => ({
      page: (args.page as number | undefined) ?? 1,
      limit: args.limit as number | undefined,
      jobId: args.jobId as string | undefined,
      status: args.status as string | undefined,
      statusId: args.statusId as string | undefined,
      quoteType: args.quoteType as string | undefined,
      sort: args.sort as string | undefined,
    }),
    input: {
      ...pageLimit,
      jobId: z.string().optional().describe('Filter by job UUID'),
      status: z.string().optional().describe('Filter by status'),
      statusId: z.string().optional().describe('Filter by status lookup UUID'),
      quoteType: z.string().optional().describe('Filter by quote type'),
      sort: z.string().optional().describe('Sort expression'),
    },
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'get_quote',
    description: 'Get a single quote by ID.',
    path: '/quotes/{id}',
    input: { id: z.string().describe('Quote UUID') },
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'create_quote',
    description: 'Create a new quote. Pass API body fields as data.',
    method: 'POST',
    path: '/quotes',
    input: { data: dataBody },
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'update_quote',
    description: 'Update an existing quote. Pass API body fields as data.',
    method: 'POST',
    path: '/quotes/{id}',
    input: {
      id: z.string().describe('Quote UUID'),
      data: dataBody,
    },
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'delete_quote',
    description: 'Delete a quote. Destructive.',
    method: 'DELETE',
    path: '/quotes/{id}',
    input: { id: z.string().describe('Quote UUID') },
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'publish_quote',
    description: 'Publish a quote.',
    method: 'POST',
    path: '/quotes/{id}/publish',
    input: { id: z.string().describe('Quote UUID') },
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'approve_quote',
    description: 'Approve a quote.',
    method: 'POST',
    path: '/quotes/{id}/approve',
    input: { id: z.string().describe('Quote UUID') },
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'list_quotes_by_job',
    description: 'List quotes for a job.',
    path: '/quotes/job/{jobId}',
    input: { jobId: z.string().describe('Job UUID') },
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'get_quote_line_items',
    description: 'Get line items for a quote.',
    path: '/quotes/{id}/line-items',
    input: { id: z.string().describe('Quote UUID') },
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'patch_quote_line_items',
    description: 'Patch quote line items (items and combos). Pass API body as data.',
    method: 'PATCH',
    path: '/quotes/{id}/line-items',
    input: {
      id: z.string().describe('Quote UUID'),
      data: dataBody,
    },
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'get_quote_groups',
    description: 'List groups for a quote.',
    path: '/quotes/{id}/groups',
    input: { id: z.string().describe('Quote UUID') },
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'create_quote_group',
    description: 'Create or ensure a quote group. Pass API body as data.',
    method: 'POST',
    path: '/quotes/{id}/groups',
    input: {
      id: z.string().describe('Quote UUID'),
      data: dataBody,
    },
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'capture_quote',
    description: 'Capture an estimate into a quote. Pass capture payload as data.',
    method: 'POST',
    path: '/quotes/capture',
    input: { data: dataBody },
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'incorporate_proposal_pricing',
    description: 'Incorporate proposal pricing into a quote. Pass proposalId and itemMappings as data.',
    method: 'POST',
    path: '/quotes/{id}/incorporate-proposal-pricing',
    input: {
      id: z.string().describe('Quote UUID'),
      data: dataBody,
    },
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'get_quote_catalog_mismatches',
    description: 'Get catalog mismatches for a quote (read-only scan).',
    path: '/quotes/{id}/catalog-mismatches',
    input: { id: z.string().describe('Quote UUID') },
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'scan_quote_catalog_mismatches',
    description: 'Scan and apply catalog mismatch fixes for a quote.',
    method: 'POST',
    path: '/quotes/{id}/catalog-mismatches/scan',
    input: { id: z.string().describe('Quote UUID') },
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'add_catalog_item_to_quote_group',
    description: 'Add a catalog item to a quote group. Pass API body as data.',
    method: 'POST',
    path: '/quotes/{quoteId}/groups/{groupId}/catalog-items',
    input: {
      quoteId: z.string().describe('Quote UUID'),
      groupId: z.string().describe('Quote group UUID'),
      data: dataBody,
    },
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'add_catalog_assembly_to_quote_group',
    description: 'Add a catalog assembly to a quote group. Pass API body as data.',
    method: 'POST',
    path: '/quotes/{quoteId}/groups/{groupId}/catalog-assemblies',
    input: {
      quoteId: z.string().describe('Quote UUID'),
      groupId: z.string().describe('Quote group UUID'),
      data: dataBody,
    },
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'delete_quote_item',
    description: 'Delete a line item from a quote.',
    method: 'DELETE',
    path: '/quotes/{quoteId}/items/{itemId}',
    input: {
      quoteId: z.string().describe('Quote UUID'),
      itemId: z.string().describe('Quote item UUID'),
      removeFromCatalogAssembly: z
        .boolean()
        .optional()
        .describe('When true, also remove from parent catalog assembly'),
    },
    query: (args) => ({
      removeFromCatalogAssembly:
        args.removeFromCatalogAssembly === true ? 'true' : undefined,
    }),
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'delete_quote_combo',
    description: 'Delete a combo from a quote.',
    method: 'DELETE',
    path: '/quotes/{quoteId}/combos/{comboId}',
    input: {
      quoteId: z.string().describe('Quote UUID'),
      comboId: z.string().describe('Quote combo UUID'),
    },
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'reorder_quote_groups',
    description: 'Reorder quote groups. Pass groupIds array as data.',
    method: 'PATCH',
    path: '/quotes/{id}/groups/reorder',
    input: {
      id: z.string().describe('Quote UUID'),
      data: dataBody,
    },
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'patch_quote_group',
    description: 'Update a quote group. Pass API body as data.',
    method: 'PATCH',
    path: '/quotes/{quoteId}/groups/{groupId}',
    input: {
      quoteId: z.string().describe('Quote UUID'),
      groupId: z.string().describe('Quote group UUID'),
      data: dataBody,
    },
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'delete_quote_group',
    description: 'Delete a quote group.',
    method: 'DELETE',
    path: '/quotes/{quoteId}/groups/{groupId}',
    input: {
      quoteId: z.string().describe('Quote UUID'),
      groupId: z.string().describe('Quote group UUID'),
    },
  });
}
