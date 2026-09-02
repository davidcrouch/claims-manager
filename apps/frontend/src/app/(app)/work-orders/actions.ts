'use server';

import { revalidatePath } from 'next/cache';
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
  assignedToUserId?: string;
  assignedToUserIds?: string;
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
      assignedToUserId: params?.assignedToUserId,
      assignedToUserIds: params?.assignedToUserIds,
      search: params?.search,
      sort: params?.sort,
    });
  } catch (err) {
    console.error('[work-orders/actions.fetchWorkOrdersAction]', err);
    return { data: [], total: 0 };
  }
}

export async function fetchWorkOrderFilterAssigneesAction(): Promise<
  { id: string; name: string }[]
> {
  const session = await getSession();
  if (!session.authenticated) return [];

  const token = await getAccessToken();
  if (!token) return [];

  const api = createApiClient({ token });
  try {
    return await api.getWorkOrderFilterAssignees();
  } catch (err) {
    console.error('[work-orders/actions.fetchWorkOrderFilterAssigneesAction]', err);
    return [];
  }
}

export async function updateWorkOrderAssigneeAction(
  id: string,
  assignedToUserId: string | null,
): Promise<{ success: boolean; error?: string }> {
  const PREFIX = 'work-orders/actions.updateWorkOrderAssigneeAction';
  const session = await getSession();
  if (!session.authenticated) return { success: false, error: 'Not authenticated' };

  const token = await getAccessToken();
  if (!token) return { success: false, error: 'Not authenticated' };

  const api = createApiClient({ token });
  try {
    await api.updateWorkOrder(id, { assignedToUserId });
    revalidatePath(`/work-orders/${id}`);
    revalidatePath('/work-orders');
    return { success: true };
  } catch (err) {
    console.error(`[${PREFIX}]`, err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to update assignee',
    };
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
