'use server';

import { getSession, getAccessToken } from '@/lib/auth';
import { createApiClient } from '@/lib/api-client';
import type { PaginatedResponse } from '@/types/api';
import type { Invoice } from '@/types/api';

export async function fetchInvoicesAction(params: {
  page?: number;
  limit?: number;
  purchaseOrderId?: string;
}): Promise<PaginatedResponse<Invoice> | null> {
  const session = await getSession();
  if (!session.authenticated) return null;

  const token = await getAccessToken();
  if (!token) return null;

  const api = createApiClient({ token });
  return api.getInvoices({
    page: params.page ?? 1,
    limit: params.limit ?? 20,
    purchaseOrderId: params.purchaseOrderId,
  });
}
