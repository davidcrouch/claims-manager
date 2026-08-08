'use server';

import { getSession, getAccessToken } from '@/lib/auth';
import { createApiClient } from '@/lib/api-client';
import type { PaginatedResponse, WorkOrder } from '@/types/api';

export async function fetchWorkOrdersAction(params?: {
  page?: number;
  limit?: number;
  jobId?: string;
  purchaseOrderId?: string;
  status?: string;
  workOrderType?: string;
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
      purchaseOrderId: params?.purchaseOrderId,
      status: params?.status,
      workOrderType: params?.workOrderType,
      sort: params?.sort,
    });
  } catch (err) {
    console.error('[work-orders/actions.fetchWorkOrdersAction]', err);
    return { data: [], total: 0 };
  }
}

export async function getWorkOrderLineItemsAction(woId: string): Promise<{
  success: boolean;
  groups?: Array<Record<string, unknown>>;
  error?: string;
}> {
  const session = await getSession();
  if (!session.authenticated) return { success: false, error: 'Not authenticated' };

  const token = await getAccessToken();
  if (!token) return { success: false, error: 'Not authenticated' };

  const api = createApiClient({ token });
  try {
    const groups = await api.getWorkOrderLineItems(woId);
    return { success: true, groups };
  } catch (err) {
    console.error('[work-orders/actions.getWorkOrderLineItemsAction]', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to load line items',
    };
  }
}
