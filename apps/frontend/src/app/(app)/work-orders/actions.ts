'use server';

import { getSession, getAccessToken } from '@/lib/auth';
import { createApiClient } from '@/lib/api-client';
import type { PaginatedResponse, WorkOrder, LineItemsPageQuery } from '@/types/api';

export async function fetchWorkOrdersAction(params?: {
  page?: number;
  limit?: number;
  jobId?: string;
  jobIds?: string[];
  purchaseOrderId?: string;
  status?: string;
  workOrderType?: string;
  search?: string;
  sort?: string;
}): Promise<PaginatedResponse<WorkOrder>> {
  const session = await getSession();
  if (!session.authenticated) return { data: [], total: 0 };

  const token = await getAccessToken();
  if (!token) return { data: [], total: 0 };

  const api = createApiClient({ token });
  try {
    return await api.getWorkOrders({
      page: params?.page ?? 1,
      limit: params?.limit ?? 20,
      jobId: params?.jobId,
      jobIds: params?.jobIds,
      purchaseOrderId: params?.purchaseOrderId,
      status: params?.status,
      workOrderType: params?.workOrderType,
      search: params?.search,
      sort: params?.sort,
    });
  } catch (err) {
    console.error('[work-orders/actions.fetchWorkOrdersAction]', err);
    return { data: [], total: 0 };
  }
}

export async function getWorkOrderLineItemsAction(
  woId: string,
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
  const PREFIX = 'work-orders/actions.getWorkOrderLineItemsAction';
  const session = await getSession();
  if (!session.authenticated) return { success: false, error: 'Not authenticated' };

  const token = await getAccessToken();
  if (!token) return { success: false, error: 'Not authenticated' };

  const api = createApiClient({ token });
  try {
    const page = await api.getWorkOrderLineItems(woId, query);
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
