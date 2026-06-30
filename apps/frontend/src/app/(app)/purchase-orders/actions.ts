'use server';

import { getSession, getAccessToken } from '@/lib/auth';
import { createApiClient } from '@/lib/api-client';
import type { PaginatedResponse } from '@/types/api';
import type { PurchaseOrder } from '@/types/api';

export async function fetchPurchaseOrdersAction(params: {
  page?: number;
  limit?: number;
  jobId?: string;
  vendorId?: string;
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
    vendorId: params.vendorId,
    sort: params.sort,
  });
}

export async function getPurchaseOrderLineItemsAction(poId: string): Promise<{
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
    const groups = await api.getPurchaseOrderLineItems(poId);
    return { success: true, groups };
  } catch (err) {
    console.error('[purchase-orders/actions.getPurchaseOrderLineItemsAction]', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to load line items',
    };
  }
}
