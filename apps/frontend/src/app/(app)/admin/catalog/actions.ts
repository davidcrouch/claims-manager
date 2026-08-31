'use server';

import { revalidatePath } from 'next/cache';
import { getSession, getAccessToken } from '@/lib/auth';
import { createApiClient } from '@/lib/api-client';
import { canUpdateCatalogFromEstimate } from '@/lib/permissions';

async function getApi() {
  const session = await getSession();
  if (!session.authenticated) return null;
  const token = await getAccessToken();
  if (!token) return null;
  const tenantId =
    session.identity?.organization_id ?? process.env.NEXT_PUBLIC_DEFAULT_TENANT_ID ?? undefined;
  return createApiClient({ token, tenantId });
}

// ── Catalogue CRUD ───────────────────────────────────────────

export async function fetchCatalogsAction(params?: { type?: string }) {
  const api = await getApi();
  if (!api) return [];
  try {
    return api.getCatalogs(params);
  } catch (err) {
    console.error('[catalog/actions.fetchCatalogsAction]', err);
    return [];
  }
}

export async function fetchCatalogAction(id: string) {
  const api = await getApi();
  if (!api) return null;
  try {
    return api.getCatalog(id);
  } catch (err) {
    console.error('[catalog/actions.fetchCatalogAction]', err);
    return null;
  }
}

export async function fetchCatalogItemAction(id: string) {
  const api = await getApi();
  if (!api) return null;
  try {
    return api.getCatalogItem(id);
  } catch (err) {
    console.error('[catalog/actions.fetchCatalogItemAction]', err);
    return null;
  }
}

export async function fetchCatalogFormSupportAction() {
  const api = await getApi();
  if (!api) {
    return { types: [], categories: [], unitTypes: [] as Array<{ id: string; name?: string; externalReference?: string }> };
  }
  try {
    const [types, categories, unitTypes] = await Promise.all([
      api.getCatalogTypes().catch(() => []),
      api.getCatalogCategoriesTree().catch(() => []),
      api.getLookupsByDomain('unit_type').catch(() => []),
    ]);
    return { types, categories, unitTypes };
  } catch (err) {
    console.error('[catalog/actions.fetchCatalogFormSupportAction]', err);
    return { types: [], categories: [], unitTypes: [] };
  }
}

export async function fetchCatalogItemForBomAction(itemId: string) {
  const api = await getApi();
  if (!api) return null;
  try {
    const [item, components] = await Promise.all([
      api.getCatalogItem(itemId),
      api.getCatalogItemComponents(itemId),
    ]);
    const candidates = await api.getCatalogItems({
      catalogId: item.catalogId ?? undefined,
      limit: 200,
    });
    return { item, components, candidates: candidates.data ?? [] };
  } catch (err) {
    console.error('[catalog/actions.fetchCatalogItemForBomAction]', err);
    return null;
  }
}

export async function createCatalogAction(body: {
  name: string;
  description?: string;
  type: string;
  isDefault?: boolean;
}): Promise<{ success: boolean; id?: string; error?: string }> {
  const api = await getApi();
  if (!api) return { success: false, error: 'Not authenticated' };

  try {
    const catalog = await api.createCatalog(body);
    revalidatePath('/admin/catalog');
    return { success: true, id: catalog.id };
  } catch (err) {
    console.error('[catalog/actions.createCatalogAction]', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to create catalogue',
    };
  }
}

export async function updateCatalogAction(
  id: string,
  body: Record<string, unknown>,
): Promise<{ success: boolean; error?: string }> {
  const api = await getApi();
  if (!api) return { success: false, error: 'Not authenticated' };

  try {
    await api.updateCatalog(id, body);
    revalidatePath('/admin/catalog');
    return { success: true };
  } catch (err) {
    console.error('[catalog/actions.updateCatalogAction]', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to update catalogue',
    };
  }
}

export async function deleteCatalogAction(
  id: string,
): Promise<{ success: boolean; error?: string }> {
  const PREFIX = 'catalog/actions.deleteCatalogAction';
  const api = await getApi();
  if (!api) return { success: false, error: 'Not authenticated' };

  try {
    await api.deleteCatalog(id);
    revalidatePath('/admin/catalog');
    return { success: true };
  } catch (err) {
    console.error(`[${PREFIX}]`, err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to delete catalogue',
    };
  }
}

// ── Catalogue items ──────────────────────────────────────────

export async function saveCatalogItemAction(
  body: Record<string, unknown>,
  id?: string,
): Promise<{ success: boolean; id?: string; error?: string }> {
  const api = await getApi();
  if (!api) return { success: false, error: 'Not authenticated' };

  try {
    const item = id
      ? await api.updateCatalogItem(id, body)
      : await api.createCatalogItem(body);
    revalidatePath('/admin/catalog');
    if (id) revalidatePath(`/admin/catalog/items/${id}`);
    return { success: true, id: item.id };
  } catch (err) {
    console.error('[catalog/actions.saveCatalogItemAction]', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to save item',
    };
  }
}

export async function previewCatalogImportAction(
  csv: string,
  catalogId?: string,
): Promise<{ success: boolean; preview?: unknown; error?: string }> {
  const api = await getApi();
  if (!api) return { success: false, error: 'Not authenticated' };

  try {
    const preview = await api.previewCatalogImport(csv, catalogId);
    return { success: true, preview };
  } catch (err) {
    console.error('[catalog/actions.previewCatalogImportAction]', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Preview failed',
    };
  }
}

export async function importCatalogCsvAction(
  csv: string,
  catalogId?: string,
): Promise<{ success: boolean; result?: unknown; error?: string }> {
  const api = await getApi();
  if (!api) return { success: false, error: 'Not authenticated' };

  try {
    const result = await api.importCatalogCsv(csv, catalogId);
    revalidatePath('/admin/catalog');
    if (catalogId) revalidatePath(`/admin/catalog/${catalogId}`);
    return { success: true, result };
  } catch (err) {
    console.error('[catalog/actions.importCatalogCsvAction]', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Import failed',
    };
  }
}

export async function exportCatalogCsvAction(
  catalogId: string,
  format?: 'internal' | 'crunchwork',
): Promise<{
  success: boolean;
  csv?: string;
  filename?: string;
  itemCount?: number;
  error?: string;
}> {
  const api = await getApi();
  if (!api) return { success: false, error: 'Not authenticated' };

  try {
    const result = await api.exportCatalogCsv(catalogId, format);
    return {
      success: true,
      csv: result.csv,
      filename: result.filename,
      itemCount: result.itemCount,
    };
  } catch (err) {
    console.error('[catalog/actions.exportCatalogCsvAction]', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Export failed',
    };
  }
}

export async function createCatalogCategoryAction(body: {
  code: string;
  name: string;
  parentCategoryId?: string;
}): Promise<{ success: boolean; error?: string }> {
  const api = await getApi();
  if (!api) return { success: false, error: 'Not authenticated' };

  try {
    await api.createCatalogCategory(body);
    revalidatePath('/admin/catalog');
    return { success: true };
  } catch (err) {
    console.error('[catalog/actions.createCatalogCategoryAction]', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to create category',
    };
  }
}

export async function updateCatalogCategoryAction(
  id: string,
  body: {
    code?: string;
    name?: string;
    parentCategoryId?: string | null;
    sortIndex?: number;
    isActive?: boolean;
  },
): Promise<{ success: boolean; error?: string }> {
  const api = await getApi();
  if (!api) return { success: false, error: 'Not authenticated' };

  try {
    await api.updateCatalogCategory(id, body);
    revalidatePath('/admin/catalog');
    return { success: true };
  } catch (err) {
    console.error('[catalog/actions.updateCatalogCategoryAction]', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to update category',
    };
  }
}

export async function deleteCatalogCategoryAction(
  id: string,
): Promise<{ success: boolean; error?: string }> {
  const api = await getApi();
  if (!api) return { success: false, error: 'Not authenticated' };

  try {
    await api.deleteCatalogCategory(id);
    revalidatePath('/admin/catalog');
    return { success: true };
  } catch (err) {
    console.error('[catalog/actions.deleteCatalogCategoryAction]', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to deactivate category',
    };
  }
}

export async function searchCatalogItemsAction(params: {
  catalogId?: string;
  q?: string;
  kind?: 'primitive' | 'assembly' | 'scope';
  limit?: number;
}) {
  const api = await getApi();
  if (!api) return [];
  try {
    const result = await api.getCatalogItems(params);
    return result.data;
  } catch (err) {
    console.error('[catalog/actions.searchCatalogItemsAction]', err);
    return [];
  }
}

export async function fetchCatalogCategoriesAction() {
  const api = await getApi();
  if (!api) return [];
  try {
    return api.getCatalogCategoriesTree();
  } catch (err) {
    console.error('[catalog/actions.fetchCatalogCategoriesAction]', err);
    return [];
  }
}

export async function fetchCatalogItemsAction(params: {
  catalogId?: string;
  q?: string;
  kind?: 'primitive' | 'assembly' | 'scope';
  categoryIds?: string[];
  page?: number;
  limit?: number;
  sort?: string;
}) {
  const api = await getApi();
  if (!api) return null;
  try {
    return api.getCatalogItems({
      catalogId: params.catalogId,
      q: params.q,
      kind: params.kind,
      categoryIds: params.categoryIds,
      page: params.page ?? 1,
      limit: params.limit ?? 50,
      sort: params.sort,
    });
  } catch (err) {
    console.error('[catalog/actions.fetchCatalogItemsAction]', err);
    return null;
  }
}

// ── Catalogue grouped view (Take Off-style) ─────────────────

export interface CatalogGroupedItem {
  id: string;
  name: string;
  component: string;
  description: string;
  kind: 'primitive' | 'assembly' | 'scope';
  type: string;
  category: string;
  subCategory: string | null;
  quantity: number;
  unitCost: number;
  buyCost: number;
  markupType: string;
  markupValue: number;
  tax: number;
  unitType: { id?: string; name?: string; externalReference?: string } | null;
  catalogItemId: string;
  code: string;
}

export interface CatalogGroupedAssembly {
  id: string;
  name: string;
  component: string;
  description: string;
  category: string;
  subCategory: string | null;
  quantity: number;
  catalogComboId: string;
  items: CatalogGroupedItem[];
}

export interface CatalogGroupedScope {
  id: string;
  name: string;
  component: string;
  description: string;
  category: string;
  subCategory: string | null;
  quantity: number;
  catalogScopeId: string;
  items: CatalogGroupedItem[];
  combos: CatalogGroupedAssembly[];
}

export interface CatalogGroupedCategory {
  id: string;
  groupLabel: { id: string; name: string };
  description: string;
  items: CatalogGroupedItem[];
  combos: CatalogGroupedAssembly[];
  scopes: CatalogGroupedScope[];
}

export async function getCatalogGroupedItemsAction(params: {
  catalogId: string;
  search?: string;
  categoryIds?: string[];
  page?: number;
  limit?: number;
}): Promise<{
  success: boolean;
  groups?: CatalogGroupedCategory[];
  total?: number;
  page?: number;
  limit?: number;
  groupSummaries?: Array<{ id: string; label: string; count: number }>;
  error?: string;
}> {
  const PREFIX = 'catalog/actions.getCatalogGroupedItemsAction';
  const catalogId = params.catalogId;
  const page = Math.max(1, params.page ?? 1);
  const limit = Math.min(params.limit ?? 100, 100);
  const api = await getApi();
  if (!api) return { success: false, error: 'Not authenticated' };

  try {
    const noCategories = Array.isArray(params.categoryIds) && params.categoryIds.length === 0;
    const [pageItems, categories, unitTypes, itemTypes, categoryCounts] = await Promise.all([
      noCategories
        ? Promise.resolve({ data: [], total: 0 })
        : api.getCatalogItems({
            catalogId,
            q: params.search || undefined,
            categoryIds: params.categoryIds,
            page,
            limit,
            sort: 'category_asc',
          }),
      api.getCatalogCategoriesTree(),
      api.getLookupsByDomain('unit_type'),
      api.getCatalogTypes(),
      api.getCatalogCategoryCounts(catalogId, { q: params.search || undefined }),
    ]);

    const allItems = pageItems;

    const unitTypeMap = new Map(
      unitTypes.map((u) => [u.id, { id: u.id, name: u.name, externalReference: u.externalReference }]),
    );

    const itemTypeMap = new Map(
      itemTypes.map((t) => [t.id, t.name]),
    );

    const categoryMap = new Map<string, { id: string; name: string; code: string }>();
    const walkCategories = (nodes: Array<{ id: string; name: string; code: string; children?: unknown[] }>) => {
      for (const node of nodes) {
        categoryMap.set(node.id, { id: node.id, name: node.name, code: node.code });
        if (Array.isArray(node.children)) walkCategories(node.children as typeof nodes);
      }
    };
    walkCategories(categories);

    const assemblies = allItems.data.filter((i) => i.kind === 'assembly');
    const scopes = allItems.data.filter((i) => i.kind === 'scope');
    const assemblyComponents = new Map<string, CatalogGroupedItem[]>();

    const componentResults = await Promise.all(
      [...assemblies, ...scopes].map(async (asm) => {
        try {
          const components = await api.getCatalogItemComponents(asm.id);
          return { assemblyId: asm.id, components };
        } catch {
          return { assemblyId: asm.id, components: [] };
        }
      }),
    );

    /** Items that appear under a scope/assembly BOM must not also list at category root. */
    const nestedComponentIds = new Set<string>();

    for (const { assemblyId, components } of componentResults) {
      assemblyComponents.set(
        assemblyId,
        components.map((c) => {
          if (c.componentId) nestedComponentIds.add(c.componentId);
          return {
            id: c.id,
            name: c.component?.name ?? '',
            component: '',
            description: c.component?.description ?? '',
            kind: (c.component?.kind ?? 'primitive') as 'primitive' | 'assembly' | 'scope',
            type: (c.component?.typeId ? itemTypeMap.get(c.component.typeId) : undefined) ?? '',
            category: '',
            subCategory: null,
            quantity: parseFloat(c.quantity) || 1,
            unitCost: parseFloat(c.resolvedUnitCost ?? c.component?.unitCost ?? '0') || 0,
            buyCost: 0,
            markupType: c.component?.markupType ?? 'percentage',
            markupValue: parseFloat(c.component?.markupValue ?? '0') || 0,
            tax: parseFloat(c.component?.taxRate ?? '0') || 0,
            unitType: c.component?.unitTypeLookupId
              ? unitTypeMap.get(c.component.unitTypeLookupId) ?? null
              : null,
            catalogItemId: c.componentId,
            code: c.component?.code ?? '',
          };
        }),
      );
    }

    const grouped = new Map<string, { items: typeof allItems.data; assemblies: typeof allItems.data; scopes: typeof allItems.data }>();
    const UNCATEGORIZED = '__uncategorized__';

    for (const item of allItems.data) {
      // BOM children render under their parent scope/assembly only
      if (nestedComponentIds.has(item.id)) continue;

      const catId = item.categoryId ?? UNCATEGORIZED;
      if (!grouped.has(catId)) grouped.set(catId, { items: [], assemblies: [], scopes: [] });
      const bucket = grouped.get(catId)!;
      if (item.kind === 'scope') {
        bucket.scopes.push(item);
      } else if (item.kind === 'assembly') {
        bucket.assemblies.push(item);
      } else {
        bucket.items.push(item);
      }
    }

    const groups: CatalogGroupedCategory[] = [];

    for (const [catId, bucket] of grouped) {
      const catInfo = catId === UNCATEGORIZED
        ? { id: UNCATEGORIZED, name: 'Uncategorized' }
        : categoryMap.get(catId) ?? { id: catId, name: 'Unknown Category' };

      const items: CatalogGroupedItem[] = bucket.items.map((item) => ({
        id: item.id,
        name: item.name,
        component: '',
        description: item.description ?? '',
        kind: item.kind,
        type: itemTypeMap.get(item.typeId) ?? '',
        category: catInfo.name,
        subCategory: null,
        quantity: 1,
        unitCost: parseFloat(item.unitCost ?? '0') || 0,
        buyCost: parseFloat(item.buyCost ?? '0') || 0,
        markupType: item.markupType ?? 'percentage',
        markupValue: parseFloat(item.markupValue ?? '0') || 0,
        tax: parseFloat(item.taxRate ?? '0') || 0,
        unitType: item.unitTypeLookupId
          ? unitTypeMap.get(item.unitTypeLookupId) ?? null
          : null,
        catalogItemId: item.id,
        code: item.code,
      }));

      const combos: CatalogGroupedAssembly[] = bucket.assemblies.map((asm) => ({
        id: asm.id,
        name: asm.name,
        component: '',
        description: asm.description ?? '',
        category: catInfo.name,
        subCategory: null,
        quantity: 1,
        catalogComboId: asm.id,
        items: assemblyComponents.get(asm.id) ?? [],
      }));

      const scopeEntries: CatalogGroupedScope[] = bucket.scopes.map((scopeItem) => {
        const scopeChildren = assemblyComponents.get(scopeItem.id) ?? [];
        const scopeChildItems = scopeChildren.filter((c) => c.kind === 'primitive');
        const scopeChildAssemblies = scopeChildren.filter((c) => c.kind === 'assembly');
        return {
          id: scopeItem.id,
          name: scopeItem.name,
          component: '',
          description: scopeItem.description ?? '',
          category: catInfo.name,
          subCategory: null,
          quantity: 1,
          catalogScopeId: scopeItem.id,
          items: scopeChildItems,
          combos: scopeChildAssemblies.map((asm) => ({
            id: asm.catalogItemId,
            name: asm.name,
            component: asm.component,
            description: asm.description,
            category: catInfo.name,
            subCategory: null,
            quantity: asm.quantity,
            catalogComboId: asm.catalogItemId,
            items: assemblyComponents.get(asm.catalogItemId) ?? [],
          })),
        };
      });

      groups.push({
        id: catInfo.id,
        groupLabel: { id: catInfo.id, name: catInfo.name },
        description: catInfo.name,
        items,
        combos,
        scopes: scopeEntries,
      });
    }

    const groupSummaries = categoryCounts.map((row) => {
      const id = row.categoryId ?? UNCATEGORIZED;
      const name =
        id === UNCATEGORIZED
          ? 'Uncategorized'
          : categoryMap.get(id)?.name ?? 'Unknown Category';
      return { id, label: name, count: row.count };
    });

    return {
      success: true,
      groups,
      total: pageItems.total,
      page,
      limit,
      groupSummaries,
    };
  } catch (err) {
    console.error(`[${PREFIX}]`, err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to load catalogue items',
    };
  }
}

export async function saveCatalogLineItemsAction(params: {
  items: Array<{
    id: string;
    name?: string;
    description?: string;
    unitType?: string;
    unitCost?: string;
    markupValue?: string;
    tax?: string;
  }>;
  bomUpdates?: Array<{
    assemblyId: string;
    lineId: string;
    componentId: string;
    quantity: string;
  }>;
}): Promise<{ success: boolean; updated?: number; error?: string }> {
  const PREFIX = 'catalog/actions.saveCatalogLineItemsAction';
  const api = await getApi();
  if (!api) return { success: false, error: 'Not authenticated' };

  try {
    const needsUnitLookup = params.items.some((i) => i.unitType !== undefined);
    let unitLookupMap = new Map<string, string>();
    if (needsUnitLookup) {
      const units = await api.getLookupsByDomain('unit_type');
      unitLookupMap = new Map(
        units.map((u) => [
          (u.externalReference ?? u.name ?? '').toUpperCase(),
          u.id,
        ]),
      );
    }

    let updated = 0;
    for (const item of params.items) {
      const body: Record<string, unknown> = {};
      if (item.name !== undefined) body.name = item.name;
      if (item.description !== undefined) body.description = item.description;
      if (item.unitCost !== undefined) body.unitCost = item.unitCost;
      if (item.markupValue !== undefined) body.markupValue = item.markupValue;
      if (item.tax !== undefined) body.taxRate = item.tax;
      if (item.unitType !== undefined) {
        const lookupId = item.unitType
          ? unitLookupMap.get(item.unitType.toUpperCase()) ?? null
          : null;
        if (lookupId) body.unitTypeLookupId = lookupId;
      }
      if (Object.keys(body).length > 0) {
        await api.updateCatalogItem(item.id, body);
        updated++;
      }
    }

    for (const bom of params.bomUpdates ?? []) {
      await api.updateCatalogComponent(bom.assemblyId, bom.lineId, {
        componentId: bom.componentId,
        quantity: bom.quantity,
      });
      updated++;
    }

    revalidatePath('/admin/catalog');
    return { success: true, updated };
  } catch (err) {
    console.error(`[${PREFIX}]`, err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to save catalogue items',
    };
  }
}

export async function updateCatalogFromEstimateAction(params: {
  items: Array<{
    id: string;
    name?: string;
    description?: string;
    unitType?: string;
    unitCost?: string;
    markupValue?: string;
    tax?: string;
  }>;
}): Promise<{ success: boolean; updated?: number; error?: string }> {
  const PREFIX = 'catalog/actions.updateCatalogFromEstimateAction';
  const session = await getSession();
  if (!session.authenticated) return { success: false, error: 'Not authenticated' };
  if (!canUpdateCatalogFromEstimate(session.identity?.permissions)) {
    console.warn(`${PREFIX} — missing catalogue-from-estimate permission`);
    return { success: false, error: 'You do not have permission to update catalogue items from an estimate' };
  }
  return saveCatalogLineItemsAction({ items: params.items });
}

export async function deleteCatalogItemAction(
  itemId: string,
): Promise<{ success: boolean; error?: string }> {
  const PREFIX = 'catalog/actions.deleteCatalogItemAction';
  const api = await getApi();
  if (!api) return { success: false, error: 'Not authenticated' };

  try {
    await api.deleteCatalogItem(itemId);
    revalidatePath('/admin/catalog');
    return { success: true };
  } catch (err) {
    console.error(`[${PREFIX}]`, err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to delete item',
    };
  }
}

export async function replaceCatalogBomAction(
  assemblyId: string,
  lines: Array<{
    componentId: string;
    quantity: string;
    wasteFactor?: string;
  }>,
): Promise<{ success: boolean; error?: string }> {
  const api = await getApi();
  if (!api) return { success: false, error: 'Not authenticated' };

  try {
    await api.replaceCatalogBom(assemblyId, lines);
    revalidatePath(`/admin/catalog/items/${assemblyId}`);
    return { success: true };
  } catch (err) {
    console.error('[catalog/actions.replaceCatalogBomAction]', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to update BOM',
    };
  }
}

export async function addCatalogItemToCatalogAction(params: {
  targetCatalogId: string;
  catalogItemId: string;
  parentId?: string;
  nestUnderId?: string;
}): Promise<{ success: boolean; error?: string }> {
  const PREFIX = 'catalog/actions.addCatalogItemToCatalogAction';
  const api = await getApi();
  if (!api) return { success: false, error: 'Not authenticated' };

  try {
    await api.copyCatalogItem(params.targetCatalogId, {
      catalogItemId: params.catalogItemId,
      parentId: params.parentId,
      nestUnderId: params.nestUnderId,
    });
    revalidatePath('/admin/catalog');
    revalidatePath(`/admin/catalog/${params.targetCatalogId}`);
    return { success: true };
  } catch (err) {
    console.error(`[${PREFIX}]`, err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to copy catalogue item',
    };
  }
}

export async function moveCatalogLineItemAction(params: {
  catalogId: string;
  itemId?: string;
  comboId?: string;
  targetGroupId: string;
  targetComboId?: string;
  insertAtIndex?: number;
}): Promise<{ success: boolean; error?: string }> {
  const PREFIX = 'catalog/actions.moveCatalogLineItemAction';
  const api = await getApi();
  if (!api) return { success: false, error: 'Not authenticated' };

  try {
    await api.moveCatalogLineItem(params.catalogId, {
      itemId: params.itemId,
      comboId: params.comboId,
      targetGroupId: params.targetGroupId,
      targetComboId: params.targetComboId,
      insertAtIndex: params.insertAtIndex,
    });
    revalidatePath(`/admin/catalog/${params.catalogId}`);
    return { success: true };
  } catch (err) {
    console.error(`[${PREFIX}]`, err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to move catalogue item',
    };
  }
}

export async function reorderCatalogLineItemsAction(params: {
  catalogId: string;
  groupId: string;
  parentComboId?: string;
  items?: Array<{ id: string; sortIndex: number }>;
  combos?: Array<{ id: string; sortIndex: number }>;
  scopes?: Array<{ id: string; sortIndex: number }>;
}): Promise<{ success: boolean; error?: string }> {
  const PREFIX = 'catalog/actions.reorderCatalogLineItemsAction';
  const api = await getApi();
  if (!api) return { success: false, error: 'Not authenticated' };

  try {
    await api.reorderCatalogLineItems(params.catalogId, {
      groupId: params.groupId,
      parentComboId: params.parentComboId,
      items: params.items,
      combos: params.combos,
      scopes: params.scopes,
    });
    return { success: true };
  } catch (err) {
    console.error(`[${PREFIX}]`, err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to reorder catalogue items',
    };
  }
}
