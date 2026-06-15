'use server';

import { revalidatePath } from 'next/cache';
import { getSession, getAccessToken } from '@/lib/auth';
import { createApiClient } from '@/lib/api-client';
import type { PaginatedResponse, Quote } from '@/types/api';

async function getApi() {
  const session = await getSession();
  if (!session.authenticated) return null;
  const token = await getAccessToken();
  if (!token) return null;
  const tenantId =
    session.identity?.organization_id ?? process.env.NEXT_PUBLIC_DEFAULT_TENANT_ID ?? undefined;
  return createApiClient({ token, tenantId });
}

export async function fetchQuotesAction(params: {
  page?: number;
  limit?: number;
  search?: string;
  jobId?: string;
  statusId?: string;
}): Promise<PaginatedResponse<Quote> | null> {
  const api = await getApi();
  if (!api) return null;

  return api.getQuotes({
    page: params.page ?? 1,
    limit: params.limit ?? 20,
    jobId: params.jobId,
    statusId: params.statusId,
  });
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
