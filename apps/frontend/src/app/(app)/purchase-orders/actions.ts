'use server';

import { revalidatePath } from 'next/cache';
import { getSession, getAccessToken } from '@/lib/auth';
import { createApiClient } from '@/lib/api-client';
import type { PaginatedResponse, PurchaseOrder, LineItemsPageQuery } from '@/types/api';
import type { PoIssueRequestListItem, PoIssueRequestDetail } from '@/lib/api-client';

async function getApi() {
  const session = await getSession();
  if (!session.authenticated) return null;
  const token = await getAccessToken();
  if (!token) return null;
  const tenantId =
    session.identity?.organization_id ?? process.env.NEXT_PUBLIC_DEFAULT_TENANT_ID ?? undefined;
  return createApiClient({ token, tenantId });
}

export async function fetchPurchaseOrdersAction(params: {
  page?: number;
  limit?: number;
  jobId?: string;
  jobIds?: string[];
  status?: string;
  vendorId?: string;
  search?: string;
  sort?: string;
}): Promise<PaginatedResponse<PurchaseOrder> | null> {
  const api = await getApi();
  if (!api) return null;

  return api.getPurchaseOrders({
    page: params.page ?? 1,
    limit: params.limit ?? 20,
    jobId: params.jobId,
    jobIds: params.jobIds,
    status: params.status,
    vendorId: params.vendorId,
    search: params.search,
    sort: params.sort,
  });
}

export async function getPurchaseOrderLineItemsAction(
  poId: string,
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
  const PREFIX = 'purchase-orders/actions.getPurchaseOrderLineItemsAction';
  const api = await getApi();
  if (!api) return { success: false, error: 'Not authenticated' };

  try {
    const page = await api.getPurchaseOrderLineItems(poId, query);
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

async function resolvePurchaseOrderGroupId(
  api: NonNullable<Awaited<ReturnType<typeof getApi>>>,
  purchaseOrderId: string,
  groupId?: string,
) {
  if (groupId) return groupId;
  const page = await api.getPurchaseOrderLineItems(purchaseOrderId, { page: 1, limit: 1 });
  if (page.groupSummaries && page.groupSummaries.length > 0) {
    return page.groupSummaries[0].id;
  }
  const group = await api.ensurePurchaseOrderGroup(purchaseOrderId);
  return group.id;
}

export async function addCatalogItemToPurchaseOrderAction(params: {
  purchaseOrderId: string;
  catalogItemId: string;
  quantity: string;
  groupId?: string;
  purchaseOrderComboId?: string;
}): Promise<{ success: boolean; error?: string }> {
  const api = await getApi();
  if (!api) return { success: false, error: 'Not authenticated' };

  try {
    const groupId = await resolvePurchaseOrderGroupId(
      api,
      params.purchaseOrderId,
      params.groupId,
    );
    await api.addCatalogItemToPurchaseOrder({
      purchaseOrderId: params.purchaseOrderId,
      groupId,
      catalogItemId: params.catalogItemId,
      quantity: params.quantity,
      purchaseOrderComboId: params.purchaseOrderComboId,
    });
    revalidatePath(`/purchase-orders/${params.purchaseOrderId}`);
    return { success: true };
  } catch (err) {
    console.error('[purchase-orders/actions.addCatalogItemToPurchaseOrderAction]', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to add item',
    };
  }
}

export async function addCatalogAssemblyToPurchaseOrderAction(params: {
  purchaseOrderId: string;
  catalogAssemblyId: string;
  quantity: string;
  groupId?: string;
}): Promise<{ success: boolean; error?: string }> {
  const api = await getApi();
  if (!api) return { success: false, error: 'Not authenticated' };

  try {
    const groupId = await resolvePurchaseOrderGroupId(
      api,
      params.purchaseOrderId,
      params.groupId,
    );
    await api.addCatalogAssemblyToPurchaseOrder({
      purchaseOrderId: params.purchaseOrderId,
      groupId,
      catalogAssemblyId: params.catalogAssemblyId,
      quantity: params.quantity,
    });
    revalidatePath(`/purchase-orders/${params.purchaseOrderId}`);
    return { success: true };
  } catch (err) {
    console.error('[purchase-orders/actions.addCatalogAssemblyToPurchaseOrderAction]', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to add assembly',
    };
  }
}

export async function createPurchaseOrderGroupAction(params: {
  purchaseOrderId: string;
  groupLabelLookupId?: string;
  description?: string;
}): Promise<{
  success: boolean;
  group?: { id: string; description: string | null };
  error?: string;
}> {
  const api = await getApi();
  if (!api) return { success: false, error: 'Not authenticated' };

  try {
    const group = await api.createPurchaseOrderGroup(params.purchaseOrderId, {
      groupLabelLookupId: params.groupLabelLookupId,
      description: params.description,
    });
    revalidatePath(`/purchase-orders/${params.purchaseOrderId}`);
    return { success: true, group };
  } catch (err) {
    console.error('[purchase-orders/actions.createPurchaseOrderGroupAction]', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to create group',
    };
  }
}

export async function updatePurchaseOrderGroupAction(params: {
  purchaseOrderId: string;
  groupId: string;
  groupLabelLookupId?: string;
  description?: string;
  component?: string;
  dimensions?: Record<string, unknown>;
}): Promise<{ success: boolean; error?: string }> {
  const api = await getApi();
  if (!api) return { success: false, error: 'Not authenticated' };

  try {
    await api.updatePurchaseOrderGroup(params.purchaseOrderId, params.groupId, {
      groupLabelLookupId: params.groupLabelLookupId,
      description: params.description,
      component: params.component,
      dimensions: params.dimensions,
    });
    revalidatePath(`/purchase-orders/${params.purchaseOrderId}`);
    return { success: true };
  } catch (err) {
    console.error('[purchase-orders/actions.updatePurchaseOrderGroupAction]', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to update group',
    };
  }
}

export async function deletePurchaseOrderGroupAction(params: {
  purchaseOrderId: string;
  groupId: string;
}): Promise<{ success: boolean; error?: string }> {
  const api = await getApi();
  if (!api) return { success: false, error: 'Not authenticated' };

  try {
    await api.deletePurchaseOrderGroup(params.purchaseOrderId, params.groupId);
    revalidatePath(`/purchase-orders/${params.purchaseOrderId}`);
    return { success: true };
  } catch (err) {
    console.error('[purchase-orders/actions.deletePurchaseOrderGroupAction]', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to delete group',
    };
  }
}

export async function reorderPurchaseOrderGroupsAction(params: {
  purchaseOrderId: string;
  groupIds: string[];
}): Promise<{ success: boolean; error?: string }> {
  const api = await getApi();
  if (!api) return { success: false, error: 'Not authenticated' };

  try {
    await api.reorderPurchaseOrderGroups(params.purchaseOrderId, params.groupIds);
    revalidatePath(`/purchase-orders/${params.purchaseOrderId}`);
    return { success: true };
  } catch (err) {
    console.error('[purchase-orders/actions.reorderPurchaseOrderGroupsAction]', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to reorder groups',
    };
  }
}

export async function deletePurchaseOrderItemAction(params: {
  purchaseOrderId: string;
  itemId: string;
  removeFromCatalogAssembly?: boolean;
}): Promise<{ success: boolean; removedFromCatalog?: boolean; error?: string }> {
  const api = await getApi();
  if (!api) return { success: false, error: 'Not authenticated' };

  try {
    const result = await api.deletePurchaseOrderItem(params.purchaseOrderId, params.itemId, {
      removeFromCatalogAssembly: params.removeFromCatalogAssembly,
    });
    revalidatePath(`/purchase-orders/${params.purchaseOrderId}`);
    return { success: true, removedFromCatalog: result.removedFromCatalog };
  } catch (err) {
    console.error('[purchase-orders/actions.deletePurchaseOrderItemAction]', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to delete item',
    };
  }
}

export async function deletePurchaseOrderComboAction(params: {
  purchaseOrderId: string;
  comboId: string;
}): Promise<{ success: boolean; error?: string }> {
  const api = await getApi();
  if (!api) return { success: false, error: 'Not authenticated' };

  try {
    await api.deletePurchaseOrderCombo(params.purchaseOrderId, params.comboId);
    revalidatePath(`/purchase-orders/${params.purchaseOrderId}`);
    return { success: true };
  } catch (err) {
    console.error('[purchase-orders/actions.deletePurchaseOrderComboAction]', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to delete assembly',
    };
  }
}

export async function savePurchaseOrderLineItemsAction(params: {
  purchaseOrderId: string;
  items: Array<{
    id: string;
    name?: string;
    component?: string;
    description?: string;
    quantity?: string;
    unitCost?: string;
    markupValue?: string;
    tax?: string;
    unitType?: string;
  }>;
  combos: Array<{
    id: string;
    name?: string;
    component?: string;
    description?: string;
    quantity?: string;
  }>;
}): Promise<{ success: boolean; updated?: number; error?: string }> {
  const api = await getApi();
  if (!api) return { success: false, error: 'Not authenticated' };

  try {
    const result = await api.updatePurchaseOrderLineItems(params.purchaseOrderId, {
      items: params.items,
      combos: params.combos,
    });
    revalidatePath(`/purchase-orders/${params.purchaseOrderId}`);
    return { success: true, updated: result.updated };
  } catch (err) {
    console.error('[purchase-orders/actions.savePurchaseOrderLineItemsAction]', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to save line items',
    };
  }
}

export async function reorderPurchaseOrderLineItemsAction(params: {
  purchaseOrderId: string;
  items?: Array<{ id: string; sortIndex: number }>;
  combos?: Array<{ id: string; sortIndex: number }>;
}): Promise<{ success: boolean; error?: string }> {
  const api = await getApi();
  if (!api) return { success: false, error: 'Not authenticated' };

  try {
    await api.reorderPurchaseOrderLineItems(params.purchaseOrderId, {
      items: params.items,
      combos: params.combos,
    });
    revalidatePath(`/purchase-orders/${params.purchaseOrderId}`);
    return { success: true };
  } catch (err) {
    console.error('[purchase-orders/actions.reorderPurchaseOrderLineItemsAction]', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to reorder line items',
    };
  }
}

export async function movePurchaseOrderLineItemAction(params: {
  purchaseOrderId: string;
  itemId?: string;
  comboId?: string;
  targetGroupId: string;
  targetComboId?: string;
  insertAtIndex?: number;
}): Promise<{ success: boolean; error?: string }> {
  const api = await getApi();
  if (!api) return { success: false, error: 'Not authenticated' };

  try {
    await api.movePurchaseOrderLineItem(params.purchaseOrderId, {
      itemId: params.itemId,
      comboId: params.comboId,
      targetGroupId: params.targetGroupId,
      targetComboId: params.targetComboId,
      insertAtIndex: params.insertAtIndex,
    });
    revalidatePath(`/purchase-orders/${params.purchaseOrderId}`);
    return { success: true };
  } catch (err) {
    console.error('[purchase-orders/actions.movePurchaseOrderLineItemAction]', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to move line item',
    };
  }
}

export async function duplicatePurchaseOrderLineItemAction(params: {
  purchaseOrderId: string;
  itemId?: string;
  comboId?: string;
  targetGroupId: string;
  targetComboId?: string;
  insertAtIndex?: number;
}): Promise<{ success: boolean; newId?: string; error?: string }> {
  const api = await getApi();
  if (!api) return { success: false, error: 'Not authenticated' };

  try {
    const result = await api.duplicatePurchaseOrderLineItem(params.purchaseOrderId, {
      itemId: params.itemId,
      comboId: params.comboId,
      targetGroupId: params.targetGroupId,
      targetComboId: params.targetComboId,
      insertAtIndex: params.insertAtIndex,
    });
    revalidatePath(`/purchase-orders/${params.purchaseOrderId}`);
    return { success: true, newId: result.newId };
  } catch (err) {
    console.error('[purchase-orders/actions.duplicatePurchaseOrderLineItemAction]', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to duplicate line item',
    };
  }
}

// -- Purchase Order Issue Requests --

export async function fetchPoIssueRequestsAction(
  purchaseOrderId: string,
): Promise<{ success: boolean; data?: PoIssueRequestListItem[]; error?: string }> {
  const api = await getApi();
  if (!api) return { success: false, error: 'Not authenticated' };
  try {
    const data = await api.listPoIssueRequests(purchaseOrderId);
    return { success: true, data };
  } catch (err) {
    console.error(
      'frontend:fetchPoIssueRequestsAction - failed:',
      err instanceof Error ? err.message : err,
    );
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to load issue requests',
    };
  }
}

export async function fetchPoIssueRequestDetailAction(
  purchaseOrderId: string,
  requestId: string,
): Promise<{ success: boolean; data?: PoIssueRequestDetail; error?: string }> {
  const api = await getApi();
  if (!api) return { success: false, error: 'Not authenticated' };
  try {
    const data = await api.getPoIssueRequest(purchaseOrderId, requestId);
    return { success: true, data };
  } catch (err) {
    console.error(
      'frontend:fetchPoIssueRequestDetailAction - failed:',
      err instanceof Error ? err.message : err,
    );
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to load issue detail',
    };
  }
}

export async function createPoIssueRequestAction(
  purchaseOrderId: string,
  body: {
    recipients: Array<{ contactId?: string; name: string; email: string }>;
    generatedDocumentId: string;
    emailSubject?: string;
    emailBodyHtml?: string;
    emailBodyText?: string;
  },
): Promise<{ success: boolean; data?: PoIssueRequestDetail; error?: string }> {
  const api = await getApi();
  if (!api) return { success: false, error: 'Not authenticated' };
  try {
    const data = await api.createPoIssueRequest(purchaseOrderId, body);
    revalidatePath(`/purchase-orders/${purchaseOrderId}`);
    return { success: true, data };
  } catch (err) {
    console.error(
      'frontend:createPoIssueRequestAction - failed:',
      err instanceof Error ? err.message : err,
    );
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to issue purchase order',
    };
  }
}

export async function retryPoIssueRequestAction(
  purchaseOrderId: string,
  requestId: string,
  body: { recipients: Array<{ recipientId: string; email?: string }> },
): Promise<{ success: boolean; data?: PoIssueRequestDetail; error?: string }> {
  const api = await getApi();
  if (!api) return { success: false, error: 'Not authenticated' };
  try {
    const data = await api.retryPoIssueRequest(purchaseOrderId, requestId, body);
    revalidatePath(`/purchase-orders/${purchaseOrderId}`);
    return { success: true, data };
  } catch (err) {
    console.error(
      'frontend:retryPoIssueRequestAction - failed:',
      err instanceof Error ? err.message : err,
    );
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to retry issue',
    };
  }
}
