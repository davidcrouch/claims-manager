'use server';

import { revalidatePath } from 'next/cache';
import { getSession, getAccessToken } from '@/lib/auth';
import { createApiClient, ApiError } from '@/lib/api-client';
import type { PaginatedResponse, Quote, Attachment } from '@/types/api';

async function getApi() {
  const session = await getSession();
  if (!session.authenticated) return null;
  const token = await getAccessToken();
  if (!token) return null;
  const tenantId =
    session.identity?.organization_id ?? process.env.NEXT_PUBLIC_DEFAULT_TENANT_ID ?? undefined;
  return createApiClient({ token, tenantId });
}

export async function fetchQuoteAction(quoteId: string): Promise<Quote | null> {
  const api = await getApi();
  if (!api) return null;
  return api.getQuote(quoteId);
}

export async function fetchQuotesAction(params: {
  page?: number;
  limit?: number;
  search?: string;
  jobId?: string;
  statusId?: string;
  sort?: string;
}): Promise<PaginatedResponse<Quote> | null> {
  const api = await getApi();
  if (!api) return null;

  return api.getQuotes({
    page: params.page ?? 1,
    limit: params.limit ?? 20,
    jobId: params.jobId,
    statusId: params.statusId,
    sort: params.sort,
  });
}

export async function deleteQuoteAction(quoteId: string): Promise<{
  success: boolean;
  softDeleted?: boolean;
  error?: string;
}> {
  const api = await getApi();
  if (!api) return { success: false, error: 'Not authenticated' };

  try {
    const result = await api.deleteQuote(quoteId);
    revalidatePath('/quotes');
    return { success: true, softDeleted: result.softDeleted };
  } catch (err) {
    console.error('[quotes/actions.deleteQuoteAction]', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to delete estimate',
    };
  }
}

export async function getQuoteCatalogMismatchesAction(quoteId: string): Promise<{
  success: boolean;
  mismatches?: Array<{
    quoteItemId: string;
    catalogCode: string | null;
    property: string;
    snapshotValue: string;
    catalogValue: string;
  }>;
  error?: string;
}> {
  const api = await getApi();
  if (!api) return { success: false, error: 'Not authenticated' };

  try {
    const result = await api.getQuoteCatalogMismatches(quoteId);
    return { success: true, mismatches: result.mismatches };
  } catch (err) {
    console.error('[quotes/actions.getQuoteCatalogMismatchesAction]', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to load mismatches',
    };
  }
}

export async function scanQuoteCatalogMismatchesAction(quoteId: string): Promise<{
  success: boolean;
  mismatches?: unknown[];
  updatedCount?: number;
  error?: string;
}> {
  const api = await getApi();
  if (!api) return { success: false, error: 'Not authenticated' };

  try {
    const result = await api.scanQuoteCatalogMismatches(quoteId);
    revalidatePath(`/quotes/${quoteId}`);
    return {
      success: true,
      mismatches: result.mismatches,
      updatedCount: result.updatedCount,
    };
  } catch (err) {
    console.error('[quotes/actions.scanQuoteCatalogMismatchesAction]', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Scan failed',
    };
  }
}

export async function getQuoteLineItemsAction(quoteId: string): Promise<{
  success: boolean;
  groups?: Array<Record<string, unknown>>;
  error?: string;
}> {
  const api = await getApi();
  if (!api) return { success: false, error: 'Not authenticated' };

  try {
    const groups = await api.getQuoteLineItems(quoteId);
    return { success: true, groups };
  } catch (err) {
    console.error('[quotes/actions.getQuoteLineItemsAction]', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to load line items',
    };
  }
}

async function resolveQuoteGroupId(
  api: ReturnType<typeof createApiClient>,
  quoteId: string,
  groupId?: string,
) {
  if (groupId) return groupId;
  const groups = await api.getQuoteGroups(quoteId);
  if (groups.length > 0) return groups[0].id;
  const group = await api.ensureQuoteGroup(quoteId);
  return group.id;
}

export async function addCatalogItemToQuoteAction(params: {
  quoteId: string;
  catalogItemId: string;
  quantity: string;
  groupId?: string;
}): Promise<{ success: boolean; error?: string }> {
  const api = await getApi();
  if (!api) return { success: false, error: 'Not authenticated' };

  try {
    const groupId = await resolveQuoteGroupId(api, params.quoteId, params.groupId);
    await api.addCatalogItemToQuote({
      quoteId: params.quoteId,
      groupId,
      catalogItemId: params.catalogItemId,
      quantity: params.quantity,
    });
    revalidatePath(`/quotes/${params.quoteId}`);
    return { success: true };
  } catch (err) {
    console.error('[quotes/actions.addCatalogItemToQuoteAction]', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to add item',
    };
  }
}

export async function addCatalogAssemblyToQuoteAction(params: {
  quoteId: string;
  catalogAssemblyId: string;
  quantity: string;
  groupId?: string;
}): Promise<{ success: boolean; error?: string }> {
  const api = await getApi();
  if (!api) return { success: false, error: 'Not authenticated' };

  try {
    const groupId = await resolveQuoteGroupId(api, params.quoteId, params.groupId);
    await api.addCatalogAssemblyToQuote({
      quoteId: params.quoteId,
      groupId,
      catalogAssemblyId: params.catalogAssemblyId,
      quantity: params.quantity,
    });
    revalidatePath(`/quotes/${params.quoteId}`);
    return { success: true };
  } catch (err) {
    console.error('[quotes/actions.addCatalogAssemblyToQuoteAction]', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to add assembly',
    };
  }
}

export async function createQuoteGroupAction(params: {
  quoteId: string;
  groupLabelLookupId?: string;
  description?: string;
}): Promise<{ success: boolean; group?: { id: string; description: string | null }; error?: string }> {
  const api = await getApi();
  if (!api) return { success: false, error: 'Not authenticated' };

  try {
    const group = await api.createQuoteGroup(params.quoteId, {
      groupLabelLookupId: params.groupLabelLookupId,
      description: params.description,
    });
    revalidatePath(`/quotes/${params.quoteId}`);
    return { success: true, group };
  } catch (err) {
    console.error('[quotes/actions.createQuoteGroupAction]', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to create group',
    };
  }
}

export async function updateQuoteGroupAction(params: {
  quoteId: string;
  groupId: string;
  groupLabelLookupId?: string;
  description?: string;
  dimensions?: Record<string, unknown>;
}): Promise<{ success: boolean; error?: string }> {
  const api = await getApi();
  if (!api) return { success: false, error: 'Not authenticated' };

  try {
    await api.updateQuoteGroup(params.quoteId, params.groupId, {
      groupLabelLookupId: params.groupLabelLookupId,
      description: params.description,
      dimensions: params.dimensions,
    });
    revalidatePath(`/quotes/${params.quoteId}`);
    return { success: true };
  } catch (err) {
    console.error('[quotes/actions.updateQuoteGroupAction]', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to update group',
    };
  }
}

export async function deleteQuoteGroupAction(params: {
  quoteId: string;
  groupId: string;
}): Promise<{ success: boolean; error?: string }> {
  const api = await getApi();
  if (!api) return { success: false, error: 'Not authenticated' };

  try {
    await api.deleteQuoteGroup(params.quoteId, params.groupId);
    revalidatePath(`/quotes/${params.quoteId}`);
    return { success: true };
  } catch (err) {
    console.error('[quotes/actions.deleteQuoteGroupAction]', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to delete group',
    };
  }
}

export async function reorderQuoteGroupsAction(params: {
  quoteId: string;
  groupIds: string[];
}): Promise<{ success: boolean; error?: string }> {
  const api = await getApi();
  if (!api) return { success: false, error: 'Not authenticated' };

  try {
    await api.reorderQuoteGroups(params.quoteId, params.groupIds);
    revalidatePath(`/quotes/${params.quoteId}`);
    return { success: true };
  } catch (err) {
    console.error('[quotes/actions.reorderQuoteGroupsAction]', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to reorder groups',
    };
  }
}

export async function deleteQuoteItemAction(params: {
  quoteId: string;
  itemId: string;
  removeFromCatalogAssembly?: boolean;
}): Promise<{ success: boolean; removedFromCatalog?: boolean; error?: string }> {
  const api = await getApi();
  if (!api) return { success: false, error: 'Not authenticated' };

  try {
    const result = await api.deleteQuoteItem(params.quoteId, params.itemId, {
      removeFromCatalogAssembly: params.removeFromCatalogAssembly,
    });
    revalidatePath(`/quotes/${params.quoteId}`);
    return { success: true, removedFromCatalog: result.removedFromCatalog };
  } catch (err) {
    console.error('[quotes/actions.deleteQuoteItemAction]', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to delete item',
    };
  }
}

export async function deleteQuoteComboAction(params: {
  quoteId: string;
  comboId: string;
}): Promise<{ success: boolean; error?: string }> {
  const api = await getApi();
  if (!api) return { success: false, error: 'Not authenticated' };

  try {
    await api.deleteQuoteCombo(params.quoteId, params.comboId);
    revalidatePath(`/quotes/${params.quoteId}`);
    return { success: true };
  } catch (err) {
    console.error('[quotes/actions.deleteQuoteComboAction]', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to delete assembly',
    };
  }
}

export async function saveQuoteLineItemsAction(params: {
  quoteId: string;
  items: Array<{ id: string; name?: string; component?: string; description?: string; quantity?: string; unitCost?: string; markupValue?: string; tax?: string; unitType?: string }>;
  combos: Array<{ id: string; name?: string; component?: string; description?: string; quantity?: string }>;
}): Promise<{ success: boolean; updated?: number; error?: string }> {
  const api = await getApi();
  if (!api) return { success: false, error: 'Not authenticated' };

  try {
    const result = await api.updateQuoteLineItems(params.quoteId, {
      items: params.items,
      combos: params.combos,
    });
    revalidatePath(`/quotes/${params.quoteId}`);
    return { success: true, updated: result.updated };
  } catch (err) {
    console.error('[quotes/actions.saveQuoteLineItemsAction]', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to save line items',
    };
  }
}

export async function fetchGroupLabelLookupsAction(): Promise<{
  success: boolean;
  options?: Array<{ id: string; name?: string; externalReference?: string }>;
  error?: string;
}> {
  const api = await getApi();
  if (!api) return { success: false, error: 'Not authenticated' };

  try {
    const options = await api.getLookupsByDomain('group_label');
    return { success: true, options: options as Array<{ id: string; name?: string; externalReference?: string }> };
  } catch (err) {
    console.error('[quotes/actions.fetchGroupLabelLookupsAction]', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to load group labels',
    };
  }
}

export interface PhaseGatedResult<T> {
  data: T[];
  phaseUnavailable: boolean;
  error?: string;
}

function isNotImplemented(err: unknown): boolean {
  if (err instanceof ApiError) {
    return err.status === 404 || err.status === 501;
  }
  return false;
}

export async function fetchQuoteAttachmentsAction(
  quoteId: string,
): Promise<PhaseGatedResult<Attachment>> {
  const api = await getApi();
  if (!api) return { data: [], phaseUnavailable: false, error: 'Not authenticated' };
  try {
    const data = await api.getQuoteAttachments(quoteId);
    return { data: data ?? [], phaseUnavailable: false };
  } catch (err) {
    if (isNotImplemented(err)) {
      return { data: [], phaseUnavailable: true };
    }
    console.error('[quotes/actions.fetchQuoteAttachmentsAction]', err);
    return {
      data: [],
      phaseUnavailable: false,
      error: err instanceof Error ? err.message : 'Failed to load attachments',
    };
  }
}
