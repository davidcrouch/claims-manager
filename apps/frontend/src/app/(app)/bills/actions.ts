'use server';

import { getSession, getAccessToken } from '@/lib/auth';
import { createApiClient } from '@/lib/api-client';
import type { PaginatedResponse, Bill } from '@/types/api';

export async function fetchBillsAction(params?: {
  page?: number;
  limit?: number;
  jobId?: string;
  jobIds?: string[];
  purchaseOrderId?: string;
  status?: string;
  vendorId?: string;
  search?: string;
  sort?: string;
}): Promise<PaginatedResponse<Bill>> {
  const session = await getSession();
  if (!session.authenticated) return { data: [], total: 0 };

  const token = await getAccessToken();
  if (!token) return { data: [], total: 0 };

  const api = createApiClient({ token });
  try {
    return await api.getBills({
      page: params?.page ?? 1,
      limit: params?.limit ?? 20,
      jobId: params?.jobId,
      jobIds: params?.jobIds,
      purchaseOrderId: params?.purchaseOrderId,
      status: params?.status,
      vendorId: params?.vendorId,
      search: params?.search,
      sort: params?.sort,
    });
  } catch (err) {
    console.error('[bills/actions.fetchBillsAction]', err);
    return { data: [], total: 0 };
  }
}

export async function fetchPurchaseOrderBillsAction(purchaseOrderId: string): Promise<Bill[]> {
  const session = await getSession();
  if (!session.authenticated) return [];

  const token = await getAccessToken();
  if (!token) return [];

  const api = createApiClient({ token });
  try {
    return await api.getPurchaseOrderBills(purchaseOrderId);
  } catch (err) {
    console.error('[bills/actions.fetchPurchaseOrderBillsAction]', err);
    return [];
  }
}
