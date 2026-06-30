'use server';

import { revalidatePath } from 'next/cache';
import { getSession, getAccessToken } from '@/lib/auth';
import { createApiClient } from '@/lib/api-client';

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

export async function createCatalogAction(body: {
  name: string;
  description?: string;
  type: string;
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
    return { success: true, result };
  } catch (err) {
    console.error('[catalog/actions.importCatalogCsvAction]', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Import failed',
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

export async function searchCatalogItemsAction(params: {
  catalogId?: string;
  q?: string;
  kind?: 'primitive' | 'assembly';
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

export async function fetchCatalogItemsAction(params: {
  catalogId?: string;
  q?: string;
  kind?: 'primitive' | 'assembly';
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
  kind: 'primitive' | 'assembly';
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

export interface CatalogGroupedCategory {
  id: string;
  groupLabel: { id: string; name: string };
  description: string;
  items: CatalogGroupedItem[];
  combos: CatalogGroupedAssembly[];
}

export async function getCatalogGroupedItemsAction(catalogId: string): Promise<{
  success: boolean;
  groups?: CatalogGroupedCategory[];
  error?: string;
}> {
  const PREFIX = 'catalog/actions.getCatalogGroupedItemsAction';
  const api = await getApi();
  if (!api) return { success: false, error: 'Not authenticated' };

  try {
    const [allItems, categories, unitTypes, itemTypes] = await Promise.all([
      api.getCatalogItems({ catalogId, limit: 5000 }),
      api.getCatalogCategoriesTree(),
      api.getLookupsByDomain('unit_type'),
      api.getCatalogTypes(),
    ]);

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
    const assemblyComponents = new Map<string, CatalogGroupedItem[]>();

    const componentResults = await Promise.all(
      assemblies.map(async (asm) => {
        try {
          const components = await api.getCatalogItemComponents(asm.id);
          return { assemblyId: asm.id, components };
        } catch {
          return { assemblyId: asm.id, components: [] };
        }
      }),
    );

    for (const { assemblyId, components } of componentResults) {
      assemblyComponents.set(
        assemblyId,
        components.map((c) => ({
          id: c.id,
          name: c.component?.name ?? '',
          component: c.component?.code ?? '',
          description: c.component?.description ?? '',
          kind: (c.component?.kind ?? 'primitive') as 'primitive' | 'assembly',
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
        })),
      );
    }

    const grouped = new Map<string, { items: typeof allItems.data; assemblies: typeof allItems.data }>();
    const UNCATEGORIZED = '__uncategorized__';

    for (const item of allItems.data) {
      const catId = item.categoryId ?? UNCATEGORIZED;
      if (!grouped.has(catId)) grouped.set(catId, { items: [], assemblies: [] });
      const bucket = grouped.get(catId)!;
      if (item.kind === 'assembly') {
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
        component: item.code,
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
        component: asm.code,
        description: asm.description ?? '',
        category: catInfo.name,
        subCategory: null,
        quantity: 1,
        catalogComboId: asm.id,
        items: assemblyComponents.get(asm.id) ?? [],
      }));

      groups.push({
        id: catInfo.id,
        groupLabel: { id: catInfo.id, name: catInfo.name },
        description: catInfo.name,
        items,
        combos,
      });
    }

    return { success: true, groups };
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
