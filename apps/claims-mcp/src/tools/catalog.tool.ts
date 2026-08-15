import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ClaimsApiClient } from '../server.js';
import { proxyTool, pageLimit, dataBody } from './_proxy.js';

const CAT = 'filesystem' as const;

export function registerCatalogTools(server: McpServer, api: ClaimsApiClient): void {
  proxyTool(server, api, {
    category: CAT,
    name: 'list_catalogs',
    description: 'List catalogs, optionally filtered by type.',
    path: '/catalogs',
    input: {
      type: z.string().optional().describe('Filter by catalog type (crunchwork or internal)'),
    },
    query: (args) => ({ type: args.type as string | undefined }),
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'get_catalog',
    description: 'Get a catalog by ID.',
    path: '/catalogs/{id}',
    input: { id: z.string().describe('Catalog UUID') },
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'create_catalog',
    description: 'Create a new catalog. Pass API body fields as data.',
    method: 'POST',
    path: '/catalogs',
    input: { data: dataBody },
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'update_catalog',
    description: 'Update an existing catalog. Pass API body fields as data.',
    method: 'POST',
    path: '/catalogs/{id}',
    input: {
      id: z.string().describe('Catalog UUID'),
      data: dataBody,
    },
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'delete_catalog',
    description: 'Deactivate a catalog.',
    method: 'DELETE',
    path: '/catalogs/{id}',
    input: { id: z.string().describe('Catalog UUID') },
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'list_catalog_items',
    description: 'List catalog items with pagination and filters.',
    path: '/catalog/items',
    input: {
      ...pageLimit,
      catalogId: z.string().optional().describe('Filter by catalog UUID'),
      kind: z.enum(['primitive', 'assembly', 'scope']).optional().describe('Item kind'),
      typeId: z.string().optional().describe('Filter by type UUID'),
      categoryId: z.string().optional().describe('Filter by category UUID'),
      q: z.string().optional().describe('Search text'),
      sort: z.string().optional().describe('Sort expression'),
    },
    query: (args) => ({
      catalogId: args.catalogId as string | undefined,
      kind: args.kind as string | undefined,
      typeId: args.typeId as string | undefined,
      categoryId: args.categoryId as string | undefined,
      q: args.q as string | undefined,
      page: (args.page as number | undefined) ?? 1,
      limit: args.limit as number | undefined,
      sort: args.sort as string | undefined,
    }),
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'get_catalog_item',
    description: 'Get a catalog item by ID.',
    path: '/catalog/items/{id}',
    input: { id: z.string().describe('Catalog item UUID') },
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'list_catalog_item_components',
    description: 'List BOM components for an assembly catalog item.',
    path: '/catalog/items/{id}/components',
    input: { id: z.string().describe('Assembly catalog item UUID') },
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'create_catalog_item',
    description: 'Create a catalog item. Pass API body fields as data.',
    method: 'POST',
    path: '/catalog/items',
    input: { data: dataBody },
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'update_catalog_item',
    description: 'Update a catalog item. Pass API body fields as data.',
    method: 'POST',
    path: '/catalog/items/{id}',
    input: {
      id: z.string().describe('Catalog item UUID'),
      data: dataBody,
    },
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'delete_catalog_item',
    description: 'Soft-delete a catalog item.',
    method: 'DELETE',
    path: '/catalog/items/{id}',
    input: { id: z.string().describe('Catalog item UUID') },
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'refresh_catalog_item_cost',
    description: 'Recalculate cost for a catalog item.',
    method: 'POST',
    path: '/catalog/items/{id}/refresh-cost',
    input: { id: z.string().describe('Catalog item UUID') },
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'replace_catalog_item_components',
    description: 'Replace the full BOM for an assembly. Pass lines in data.',
    method: 'PUT',
    path: '/catalog/items/{id}/components',
    input: {
      id: z.string().describe('Assembly catalog item UUID'),
      data: dataBody,
    },
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'add_catalog_item_component',
    description: 'Add a BOM line to an assembly. Pass API body fields as data.',
    method: 'POST',
    path: '/catalog/items/{id}/components',
    input: {
      id: z.string().describe('Assembly catalog item UUID'),
      data: dataBody,
    },
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'update_catalog_item_component',
    description: 'Update a BOM line on an assembly. Pass API body fields as data.',
    method: 'POST',
    path: '/catalog/items/{assemblyId}/components/{lineId}',
    input: {
      assemblyId: z.string().describe('Assembly catalog item UUID'),
      lineId: z.string().describe('BOM line UUID'),
      data: dataBody,
    },
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'delete_catalog_item_component',
    description: 'Remove a BOM line from an assembly.',
    method: 'DELETE',
    path: '/catalog/items/{assemblyId}/components/{lineId}',
    input: {
      assemblyId: z.string().describe('Assembly catalog item UUID'),
      lineId: z.string().describe('BOM line UUID'),
    },
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'list_catalog_categories',
    description: 'List all catalog categories.',
    path: '/catalog/categories',
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'get_catalog_categories_tree',
    description: 'Get catalog categories as a tree.',
    path: '/catalog/categories/tree',
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'create_catalog_category',
    description: 'Create a catalog category. Pass API body fields as data.',
    method: 'POST',
    path: '/catalog/categories',
    input: { data: dataBody },
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'update_catalog_category',
    description: 'Update a catalog category. Pass API body fields as data.',
    method: 'POST',
    path: '/catalog/categories/{id}',
    input: {
      id: z.string().describe('Category UUID'),
      data: dataBody,
    },
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'delete_catalog_category',
    description: 'Deactivate a catalog category.',
    method: 'DELETE',
    path: '/catalog/categories/{id}',
    input: { id: z.string().describe('Category UUID') },
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'list_catalog_types',
    description: 'List catalog item types.',
    path: '/catalog/types',
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'create_catalog_type',
    description: 'Create a catalog item type. Pass API body fields as data.',
    method: 'POST',
    path: '/catalog/types',
    input: { data: dataBody },
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'update_catalog_type',
    description: 'Update a catalog item type. Pass API body fields as data.',
    method: 'POST',
    path: '/catalog/types/{id}',
    input: {
      id: z.string().describe('Type UUID'),
      data: dataBody,
    },
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'get_catalog_import_template',
    description: 'Download CSV import template for catalog items.',
    path: '/catalog/import/template',
    input: {
      catalogType: z.string().optional().describe('Catalog type for template variant'),
    },
    query: (args) => ({ catalogType: args.catalogType as string | undefined }),
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'preview_catalog_import',
    description: 'Preview a catalog CSV import without committing. Pass csv and optional catalogId in data.',
    method: 'POST',
    path: '/catalog/import/preview',
    input: { data: dataBody },
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'import_catalog_csv',
    description: 'Import catalog items from CSV. Pass csv and optional catalogId in data.',
    method: 'POST',
    path: '/catalog/import/csv',
    input: { data: dataBody },
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'list_catalog_unresolved_references',
    description: 'List unresolved catalog reference mappings.',
    path: '/catalog/unresolved-references',
  });
}
