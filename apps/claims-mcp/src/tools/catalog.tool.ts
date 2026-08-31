import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ClaimsApiClient } from '../server.js';
import { toolError, toolResult } from '../server.js';
import { categoryDesc } from '../categories.js';
import { proxyTool, pageLimit, dataBody } from './_proxy.js';

const CAT = 'filesystem' as const;

const catalogItemFields = {
  catalogId: z.string().optional().describe('Catalogue UUID (required when creating)'),
  code: z.string().optional().describe('Item code'),
  name: z.string().optional().describe('Display name'),
  description: z.string().optional().describe('Description'),
  kind: z
    .enum(['primitive', 'assembly', 'scope'])
    .optional()
    .describe(
      'primitive = priced leaf; assembly = kit of primitives; scope = kit of assemblies and/or primitives',
    ),
  typeId: z.string().optional().describe('Catalog item type UUID'),
  categoryId: z.string().optional().describe('Category UUID'),
  unitTypeLookupId: z.string().optional().describe('Unit type lookup UUID (required for primitives)'),
  unitCost: z.string().optional().describe('Sell unit cost'),
  buyCost: z.string().optional().describe('Buy / cost price'),
  markupType: z.string().optional().describe('Markup type (percent, fixed, none)'),
  markupValue: z.string().optional().describe('Markup value (decimal rate for percent)'),
  taxRate: z.string().optional().describe('Tax rate as decimal (e.g. 0.10)'),
  pricingMode: z
    .enum(['computed', 'fixed', 'cost_plus'])
    .optional()
    .describe('Required for assembly/scope'),
  fixedUnitCost: z.string().optional().describe('Fixed unit cost when pricingMode=fixed'),
  externalReference: z.string().optional().describe('External reference id'),
  providerCodes: z
    .array(z.string())
    .optional()
    .describe('Provider tags for outbound publish filtering (e.g. internal, crunchwork)'),
};

const categoryFields = {
  code: z.string().optional().describe('Category code'),
  name: z.string().optional().describe('Category name'),
  parentCategoryId: z.string().optional().describe('Parent category UUID (omit for root)'),
  sortIndex: z.number().int().optional().describe('Sort order'),
};

const bomLineFields = {
  componentId: z.string().optional().describe('Component catalog item UUID'),
  quantity: z.string().optional().describe('Quantity per parent unit'),
  wasteFactor: z.string().optional().describe('Waste factor (default 1)'),
  sortIndex: z.number().int().optional().describe('Line sort order'),
  isOptional: z.boolean().optional().describe('Optional BOM line'),
  notes: z.string().optional().describe('Line notes'),
};

export function registerCatalogTools(server: McpServer, api: ClaimsApiClient): void {
  proxyTool(server, api, {
    category: CAT,
    name: 'list_catalogs',
    description: 'List catalogues, optionally filtered by type (crunchwork | internal).',
    path: '/catalogs',
    input: {
      type: z.string().optional().describe('Filter by catalog type (crunchwork or internal)'),
    },
    query: (args) => ({ type: args.type as string | undefined }),
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'get_catalog',
    description: 'Get a catalogue by ID (includes itemCount).',
    path: '/catalogs/{id}',
    input: { id: z.string().describe('Catalog UUID') },
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'create_catalog',
    description: 'Create a catalogue. data: { name, description?, type: crunchwork|internal }.',
    method: 'POST',
    path: '/catalogs',
    input: { data: dataBody },
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'update_catalog',
    description: 'Update a catalogue. data: { name?, description?, isActive? }.',
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
    description: 'Deactivate a catalogue (soft).',
    method: 'DELETE',
    path: '/catalogs/{id}',
    input: { id: z.string().describe('Catalog UUID') },
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'list_catalog_items',
    description:
      'List catalogue items (primitives, assemblies, scopes) with pagination and filters.',
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
    description:
      'Get a catalogue item by ID. Assemblies/scopes include BOM components when present.',
    path: '/catalog/items/{id}',
    input: { id: z.string().describe('Catalog item UUID') },
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'list_catalog_item_components',
    description:
      'List BOM lines for an assembly or scope. Assemblies may only contain primitives; scopes may contain assemblies and primitives.',
    path: '/catalog/items/{id}/components',
    input: { id: z.string().describe('Assembly or scope catalog item UUID') },
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'create_catalog_item',
    description:
      'Create a catalogue item. data must include catalogId, code, name, kind, typeId. Primitives need unitTypeLookupId; assemblies/scopes need pricingMode. Categories may hold any kind.',
    method: 'POST',
    path: '/catalog/items',
    input: { data: dataBody },
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'update_catalog_item',
    description:
      'Update a catalogue item (kind is immutable). Pass mutable fields in data.',
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
    description: 'Soft-delete a catalogue item.',
    method: 'DELETE',
    path: '/catalog/items/{id}',
    input: { id: z.string().describe('Catalog item UUID') },
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'refresh_catalog_item_cost',
    description: 'Recalculate cached cost for an assembly or scope from its BOM.',
    method: 'POST',
    path: '/catalog/items/{id}/refresh-cost',
    input: { id: z.string().describe('Assembly or scope catalog item UUID') },
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'replace_catalog_item_components',
    description:
      'Replace the full BOM. data: { lines: [{ componentId, quantity, wasteFactor?, sortIndex?, isOptional?, notes? }] }. Assembly→primitives only; scope→assemblies|primitives.',
    method: 'PUT',
    path: '/catalog/items/{id}/components',
    input: {
      id: z.string().describe('Assembly or scope catalog item UUID'),
      data: dataBody,
    },
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'add_catalog_item_component',
    description:
      'Add one BOM line. data: { componentId, quantity, wasteFactor?, sortIndex?, isOptional?, notes? }.',
    method: 'POST',
    path: '/catalog/items/{id}/components',
    input: {
      id: z.string().describe('Assembly or scope catalog item UUID'),
      data: dataBody,
    },
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'update_catalog_item_component',
    description: 'Update a BOM line quantity/waste/notes. Pass fields in data.',
    method: 'POST',
    path: '/catalog/items/{assemblyId}/components/{lineId}',
    input: {
      assemblyId: z.string().describe('Assembly or scope catalog item UUID'),
      lineId: z.string().describe('BOM line UUID'),
      data: dataBody,
    },
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'delete_catalog_item_component',
    description: 'Remove a BOM line from an assembly or scope.',
    method: 'DELETE',
    path: '/catalog/items/{assemblyId}/components/{lineId}',
    input: {
      assemblyId: z.string().describe('Assembly or scope catalog item UUID'),
      lineId: z.string().describe('BOM line UUID'),
    },
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'list_catalog_categories',
    description: 'List all catalogue categories (flat). Categories organise all item kinds.',
    path: '/catalog/categories',
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'get_catalog_categories_tree',
    description: 'Get catalogue categories as a nested tree.',
    path: '/catalog/categories/tree',
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'get_catalog_category',
    description: 'Get a single catalogue category by ID.',
    path: '/catalog/categories/{id}',
    input: { id: z.string().describe('Category UUID') },
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'create_catalog_category',
    description: 'Create a category. data: { code, name, parentCategoryId?, sortIndex? }.',
    method: 'POST',
    path: '/catalog/categories',
    input: { data: dataBody },
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'update_catalog_category',
    description: 'Update a category. data: { code?, name?, parentCategoryId?, sortIndex?, isActive? }.',
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
    description: 'Deactivate a category (blocked if it has child categories).',
    method: 'DELETE',
    path: '/catalog/categories/{id}',
    input: { id: z.string().describe('Category UUID') },
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'list_catalog_types',
    description: 'List catalogue item types (material, labour, etc.).',
    path: '/catalog/types',
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'get_catalog_type',
    description: 'Get a catalogue item type by ID.',
    path: '/catalog/types/{id}',
    input: { id: z.string().describe('Type UUID') },
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'create_catalog_type',
    description: 'Create a catalogue item type. data: { code, name, sortIndex? }.',
    method: 'POST',
    path: '/catalog/types',
    input: { data: dataBody },
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'update_catalog_type',
    description: 'Update a catalogue item type. data: { name?, sortIndex?, isActive? }.',
    method: 'POST',
    path: '/catalog/types/{id}',
    input: {
      id: z.string().describe('Type UUID'),
      data: dataBody,
    },
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'delete_catalog_type',
    description: 'Deactivate a catalogue item type (soft).',
    method: 'DELETE',
    path: '/catalog/types/{id}',
    input: { id: z.string().describe('Type UUID') },
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'get_catalog_import_template',
    description: 'Download CSV import template for catalogue items.',
    path: '/catalog/import/template',
    input: {
      catalogType: z.string().optional().describe('Catalog type for template variant'),
    },
    query: (args) => ({ catalogType: args.catalogType as string | undefined }),
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'preview_catalog_import',
    description: 'Preview a catalogue CSV import without committing. Pass csv and optional catalogId in data.',
    method: 'POST',
    path: '/catalog/import/preview',
    input: { data: dataBody },
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'import_catalog_csv',
    description: 'Import catalogue items from CSV. Pass csv and optional catalogId in data.',
    method: 'POST',
    path: '/catalog/import/csv',
    input: { data: dataBody },
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'export_catalog_csv',
    description:
      'Export a catalogue to CSV using the same column profile as import (internal or Crunchwork). Pass catalogId and optional format.',
    path: '/catalog/import/export',
    input: {
      catalogId: z.string().describe('Catalogue UUID to export'),
      format: z
        .enum(['internal', 'crunchwork'])
        .optional()
        .describe('CSV column profile; defaults to the catalogue type'),
    },
    query: (args) => ({
      catalogId: args.catalogId as string,
      format: args.format as string | undefined,
    }),
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'list_catalog_unresolved_references',
    description: 'List unresolved catalogue reference mappings from inbound sync.',
    path: '/catalog/unresolved-references',
  });

  // ── Canvas open / fill tools (native drawers) ──

  server.tool(
    'open_catalog',
    categoryDesc(CAT, 'Open the catalogue create/edit form drawer on the canvas.'),
    {
      catalogId: z.string().optional().describe('Existing catalogue UUID to edit; omit to create'),
      name: z.string().optional(),
      description: z.string().optional(),
      type: z.enum(['internal', 'crunchwork']).optional(),
    },
    async (args) => {
      try {
        let data: Record<string, unknown> | undefined;
        if (args.catalogId) {
          data = (await api.request(`/catalogs/${args.catalogId}`)) as Record<string, unknown>;
        }
        return toolResult({
          action: 'open_drawer',
          drawer: 'CatalogFormDrawer',
          catalogId: args.catalogId,
          name: args.name ?? data?.name,
          description: args.description ?? data?.description,
          type: args.type ?? data?.type,
          catalog: data,
        });
      } catch (err) {
        return toolError(err);
      }
    },
  );

  server.tool(
    'fill_catalog',
    categoryDesc(
      CAT,
      'Fill fields on the open catalogue form. Call after each user answer so the canvas updates live.',
    ),
    {
      name: z.string().optional().describe('Catalogue name'),
      description: z.string().optional().describe('Description'),
      type: z.enum(['internal', 'crunchwork']).optional().describe('Type (create only)'),
    },
    async (fields) =>
      toolResult({
        action: 'fill_drawer',
        drawer: 'CatalogFormDrawer',
        fields,
      }),
  );

  server.tool(
    'open_catalog_category',
    categoryDesc(CAT, 'Open the catalogue categories manager drawer on the canvas.'),
    {
      categoryId: z.string().optional().describe('Optional category to highlight/edit'),
      ...categoryFields,
    },
    async (args) => {
      try {
        const tree = await api.request('/catalog/categories/tree');
        let category: unknown;
        if (args.categoryId) {
          category = await api.request(`/catalog/categories/${args.categoryId}`);
        }
        return toolResult({
          action: 'open_drawer',
          drawer: 'CatalogCategoriesDrawer',
          categoryId: args.categoryId,
          code: args.code,
          name: args.name,
          parentCategoryId: args.parentCategoryId,
          sortIndex: args.sortIndex,
          category,
          categories: tree,
        });
      } catch (err) {
        return toolError(err);
      }
    },
  );

  server.tool(
    'fill_catalog_category',
    categoryDesc(CAT, 'Fill category fields on the open categories drawer (create/edit form).'),
    categoryFields,
    async (fields) =>
      toolResult({
        action: 'fill_drawer',
        drawer: 'CatalogCategoriesDrawer',
        fields,
      }),
  );

  server.tool(
    'open_catalog_item',
    categoryDesc(
      CAT,
      'Open the catalogue item form drawer (primitive, assembly, or scope). Prefer open before filling.',
    ),
    {
      itemId: z.string().optional().describe('Existing item UUID to edit; omit to create'),
      ...catalogItemFields,
    },
    async (args) => {
      try {
        let data: Record<string, unknown> | undefined;
        if (args.itemId) {
          data = (await api.request(`/catalog/items/${args.itemId}`)) as Record<
            string,
            unknown
          >;
        }
        return toolResult({
          action: 'open_drawer',
          drawer: 'CatalogItemFormDrawer',
          itemId: args.itemId,
          catalogId: args.catalogId ?? data?.catalogId,
          code: args.code ?? data?.code,
          name: args.name ?? data?.name,
          description: args.description ?? data?.description,
          kind: args.kind ?? data?.kind,
          typeId: args.typeId ?? data?.typeId,
          categoryId: args.categoryId ?? data?.categoryId,
          unitTypeLookupId: args.unitTypeLookupId ?? data?.unitTypeLookupId,
          unitCost: args.unitCost ?? data?.unitCost,
          buyCost: args.buyCost ?? data?.buyCost,
          markupType: args.markupType ?? data?.markupType,
          markupValue: args.markupValue ?? data?.markupValue,
          taxRate: args.taxRate ?? data?.taxRate,
          pricingMode: args.pricingMode ?? data?.pricingMode,
          fixedUnitCost: args.fixedUnitCost ?? data?.fixedUnitCost,
          externalReference: args.externalReference ?? data?.externalReference,
          providerCodes: args.providerCodes ?? data?.providerCodes,
          item: data,
        });
      } catch (err) {
        return toolError(err);
      }
    },
  );

  server.tool(
    'fill_catalog_item',
    categoryDesc(
      CAT,
      'Fill fields on the open catalogue item form. Pass only fields just provided. Hierarchy: categories hold any kind; assemblies contain primitives; scopes contain assemblies and primitives.',
    ),
    catalogItemFields,
    async (fields) =>
      toolResult({
        action: 'fill_drawer',
        drawer: 'CatalogItemFormDrawer',
        fields,
      }),
  );

  server.tool(
    'open_catalog_bom',
    categoryDesc(
      CAT,
      'Open the BOM editor drawer for an assembly or scope. Assemblies: primitives only. Scopes: assemblies and primitives.',
    ),
    {
      itemId: z.string().describe('Assembly or scope catalog item UUID'),
      ...bomLineFields,
    },
    async (args) => {
      try {
        const [item, components] = await Promise.all([
          api.request(`/catalog/items/${args.itemId}`),
          api.request(`/catalog/items/${args.itemId}/components`),
        ]);
        return toolResult({
          action: 'open_drawer',
          drawer: 'CatalogBomDrawer',
          itemId: args.itemId,
          assemblyId: args.itemId,
          item,
          components,
          componentId: args.componentId,
          quantity: args.quantity,
          wasteFactor: args.wasteFactor,
          sortIndex: args.sortIndex,
          isOptional: args.isOptional,
          notes: args.notes,
        });
      } catch (err) {
        return toolError(err);
      }
    },
  );

  server.tool(
    'fill_catalog_bom',
    categoryDesc(
      CAT,
      'Suggest a BOM line on the open BOM editor (componentId + quantity). Persist with replace_catalog_item_components or add_catalog_item_component after user confirms.',
    ),
    {
      itemId: z.string().optional().describe('Assembly or scope UUID'),
      ...bomLineFields,
    },
    async (fields) =>
      toolResult({
        action: 'fill_drawer',
        drawer: 'CatalogBomDrawer',
        fields,
      }),
  );
}
