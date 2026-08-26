'use server';

import { revalidatePath } from 'next/cache';
import { getSession, getAccessToken } from '@/lib/auth';
import { createApiClient, ApiError } from '@/lib/api-client';
import type { PaginatedResponse, Quote, Attachment, QuotePartyPayload, LineItemsPageQuery } from '@/types/api';

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
  jobIds?: string[];
  status?: string;
  statusId?: string;
  quoteType?: string;
  assignedToUserIds?: string;
  sort?: string;
}): Promise<PaginatedResponse<Quote> | null> {
  const api = await getApi();
  if (!api) return null;

  return api.getQuotes({
    page: params.page ?? 1,
    limit: params.limit ?? 20,
    jobId: params.jobId,
    jobIds: params.jobIds,
    status: params.status,
    statusId: params.statusId,
    quoteType: params.quoteType,
    assignedToUserIds: params.assignedToUserIds,
    search: params.search,
    sort: params.sort,
  });
}

export async function fetchQuoteFilterAssigneesAction(): Promise<
  { id: string; name: string }[]
> {
  const api = await getApi();
  if (!api) return [];
  try {
    return await api.getQuoteFilterAssignees();
  } catch (err) {
    console.error('[quotes/actions.fetchQuoteFilterAssigneesAction]', err);
    return [];
  }
}

export async function fetchQuoteFilterJobsAction(): Promise<
  { id: string; label: string }[]
> {
  const api = await getApi();
  if (!api) return [];
  try {
    return await api.getQuoteFilterJobs();
  } catch (err) {
    console.error('[quotes/actions.fetchQuoteFilterJobsAction]', err);
    return [];
  }
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

export async function getQuoteLineItemsAction(
  quoteId: string,
  query?: LineItemsPageQuery,
): Promise<{
  success: boolean;
  groups?: Array<Record<string, unknown>>;
  total?: number;
  page?: number;
  limit?: number;
  groupSummaries?: Array<{ id: string; label: string }>;
  error?: string;
}> {
  const PREFIX = 'quotes/actions.getQuoteLineItemsAction';
  const api = await getApi();
  if (!api) return { success: false, error: 'Not authenticated' };

  try {
    const page = await api.getQuoteLineItems(quoteId, query);
    return {
      success: true,
      groups: page.groups,
      total: page.total,
      page: page.page,
      limit: page.limit,
      groupSummaries: page.groupSummaries,
    };
  } catch (err) {
    console.error(`[${PREFIX}]`, err);
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
  quoteComboId?: string;
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
      quoteComboId: params.quoteComboId,
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
  quoteComboId?: string;
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
      quoteComboId: params.quoteComboId,
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

export async function reorderQuoteLineItemsAction(params: {
  quoteId: string;
  items?: Array<{ id: string; sortIndex: number }>;
  combos?: Array<{ id: string; sortIndex: number }>;
}): Promise<{ success: boolean; error?: string }> {
  const api = await getApi();
  if (!api) return { success: false, error: 'Not authenticated' };

  try {
    await api.reorderQuoteLineItems(params.quoteId, {
      items: params.items,
      combos: params.combos,
    });
    revalidatePath(`/quotes/${params.quoteId}`);
    return { success: true };
  } catch (err) {
    console.error('[quotes/actions.reorderQuoteLineItemsAction]', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to reorder line items',
    };
  }
}

export async function moveQuoteLineItemAction(params: {
  quoteId: string;
  itemId?: string;
  comboId?: string;
  targetGroupId: string;
  targetComboId?: string;
  insertAtIndex?: number;
}): Promise<{ success: boolean; error?: string }> {
  const api = await getApi();
  if (!api) return { success: false, error: 'Not authenticated' };

  try {
    await api.moveQuoteLineItem(params.quoteId, {
      itemId: params.itemId,
      comboId: params.comboId,
      targetGroupId: params.targetGroupId,
      targetComboId: params.targetComboId,
      insertAtIndex: params.insertAtIndex,
    });
    revalidatePath(`/quotes/${params.quoteId}`);
    return { success: true };
  } catch (err) {
    console.error('[quotes/actions.moveQuoteLineItemAction]', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to move line item',
    };
  }
}

export async function duplicateQuoteLineItemAction(params: {
  quoteId: string;
  itemId?: string;
  comboId?: string;
  targetGroupId: string;
  targetComboId?: string;
  insertAtIndex?: number;
}): Promise<{ success: boolean; newId?: string; error?: string }> {
  const api = await getApi();
  if (!api) return { success: false, error: 'Not authenticated' };

  try {
    const result = await api.duplicateQuoteLineItem(params.quoteId, {
      itemId: params.itemId,
      comboId: params.comboId,
      targetGroupId: params.targetGroupId,
      targetComboId: params.targetComboId,
      insertAtIndex: params.insertAtIndex,
    });
    revalidatePath(`/quotes/${params.quoteId}`);
    return { success: true, newId: result.newId };
  } catch (err) {
    console.error('[quotes/actions.duplicateQuoteLineItemAction]', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to duplicate line item',
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

export type UpdateQuoteFieldsInput = {
  name?: string | null;
  reference?: string | null;
  note?: string | null;
  quoteType?: string | null;
  estimateDate?: string | null;
  expiresInDays?: number | null;
  estimatedStartDate?: string | null;
  estimatedCompletionDate?: string | null;
  reasonForVariation?: string | null;
  quoteTo?: QuotePartyPayload;
  quoteFor?: QuotePartyPayload;
  quoteFrom?: QuotePartyPayload;
  assignedToUserId?: string | null;
};

/** Persist §3.3.6 creatable/editable quote fields for a local draft estimate. */
export async function updateQuoteFieldsAction(
  quoteId: string,
  fields: UpdateQuoteFieldsInput,
): Promise<{ success: boolean; error?: string }> {
  const api = await getApi();
  if (!api) return { success: false, error: 'Not authenticated' };

  try {
    const body: Record<string, unknown> = {};
    if (fields.name !== undefined) body.name = fields.name;
    if (fields.reference !== undefined) body.reference = fields.reference;
    if (fields.note !== undefined) body.note = fields.note;
    if (fields.quoteType !== undefined) body.quoteType = fields.quoteType;
    if (fields.estimateDate !== undefined) body.estimateDate = fields.estimateDate;
    if (fields.expiresInDays !== undefined) body.expiresInDays = fields.expiresInDays;
    if (fields.estimatedStartDate !== undefined) {
      body.estimatedStartDate = fields.estimatedStartDate;
    }
    if (fields.estimatedCompletionDate !== undefined) {
      body.estimatedCompletionDate = fields.estimatedCompletionDate;
    }
    if (fields.reasonForVariation !== undefined) {
      body.reasonForVariation = fields.reasonForVariation;
    }
    if (fields.quoteTo !== undefined) body.quoteTo = fields.quoteTo;
    if (fields.quoteFor !== undefined) body.quoteFor = fields.quoteFor;
    if (fields.quoteFrom !== undefined) body.quoteFrom = fields.quoteFrom;
    if (fields.assignedToUserId !== undefined) {
      body.assignedToUserId = fields.assignedToUserId;
    }

    await api.updateQuote(quoteId, body);
    revalidatePath(`/quotes/${quoteId}`);
    revalidatePath('/quotes');
    return { success: true };
  } catch (err) {
    console.error('[quotes/actions.updateQuoteFieldsAction]', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to update estimate',
    };
  }
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
