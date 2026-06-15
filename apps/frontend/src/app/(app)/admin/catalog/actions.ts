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
): Promise<{ success: boolean; preview?: unknown; error?: string }> {
  const api = await getApi();
  if (!api) return { success: false, error: 'Not authenticated' };

  try {
    const preview = await api.previewCatalogImport(csv);
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
): Promise<{ success: boolean; result?: unknown; error?: string }> {
  const api = await getApi();
  if (!api) return { success: false, error: 'Not authenticated' };

  try {
    const result = await api.importCatalogCsv(csv);
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
  q?: string;
  kind?: 'primitive' | 'assembly';
  page?: number;
  limit?: number;
}) {
  const api = await getApi();
  if (!api) return null;
  try {
    return api.getCatalogItems({
      q: params.q,
      kind: params.kind,
      page: params.page ?? 1,
      limit: params.limit ?? 50,
    });
  } catch (err) {
    console.error('[catalog/actions.fetchCatalogItemsAction]', err);
    return null;
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
