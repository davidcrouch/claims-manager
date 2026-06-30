'use server';

import { getSession, getAccessToken } from '@/lib/auth';
import { createApiClient } from '@/lib/api-client';
import type { PaginatedResponse, Rfq } from '@/types/api';

export async function fetchRfqsAction(params?: {
  page?: number;
  limit?: number;
  jobId?: string;
  quoteId?: string;
  vendorId?: string;
  sort?: string;
}): Promise<PaginatedResponse<Rfq>> {
  const session = await getSession();
  if (!session.authenticated) return { data: [], total: 0 };

  const token = await getAccessToken();
  if (!token) return { data: [], total: 0 };

  const api = createApiClient({ token });
  try {
    return await api.getRfqs({
      page: params?.page ?? 1,
      limit: params?.limit ?? 20,
      jobId: params?.jobId,
      quoteId: params?.quoteId,
      vendorId: params?.vendorId,
      sort: params?.sort,
    });
  } catch (err) {
    console.error('[rfqs/actions.fetchRfqsAction]', err);
    return { data: [], total: 0 };
  }
}
