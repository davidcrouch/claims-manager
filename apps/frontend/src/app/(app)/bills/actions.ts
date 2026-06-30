'use server';

import { getSession, getAccessToken } from '@/lib/auth';
import { createApiClient } from '@/lib/api-client';
import type { PaginatedResponse, Bill } from '@/types/api';

export async function fetchBillsAction(params?: {
  page?: number;
  limit?: number;
  jobId?: string;
  purchaseOrderId?: string;
  vendorId?: string;
  invoiceId?: string;
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
      purchaseOrderId: params?.purchaseOrderId,
      vendorId: params?.vendorId,
      invoiceId: params?.invoiceId,
      sort: params?.sort,
    });
  } catch (err) {
    console.error('[bills/actions.fetchBillsAction]', err);
    return { data: [], total: 0 };
  }
}
