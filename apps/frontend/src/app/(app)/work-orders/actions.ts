'use server';

import { getSession, getAccessToken } from '@/lib/auth';
import { createApiClient } from '@/lib/api-client';
import type { PaginatedResponse, WorkOrder } from '@/types/api';

export async function fetchWorkOrdersAction(params?: {
  page?: number;
  limit?: number;
  jobId?: string;
  purchaseOrderId?: string;
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
      sort: params?.sort,
    });
  } catch (err) {
    console.error('[work-orders/actions.fetchWorkOrdersAction]', err);
    return { data: [], total: 0 };
  }
}
