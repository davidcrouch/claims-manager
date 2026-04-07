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
  });
}
