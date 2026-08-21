'use server';

import { getSession, getAccessToken } from '@/lib/auth';
import { createApiClient } from '@/lib/api-client';
import type { PaginatedResponse, PurchaseOrder, LineItemsPageQuery } from '@/types/api';

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
  const session = await getSession();
  if (!session.authenticated) return null;

  const token = await getAccessToken();
  if (!token) return null;

  const api = createApiClient({ token });
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
  const session = await getSession();
  if (!session.authenticated) return { success: false, error: 'Not authenticated' };

  const token = await getAccessToken();
  if (!token) return { success: false, error: 'Not authenticated' };

  const api = createApiClient({ token });
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
