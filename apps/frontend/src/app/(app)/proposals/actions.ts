'use server';

import { getSession, getAccessToken } from '@/lib/auth';
import { createApiClient } from '@/lib/api-client';
import type { PaginatedResponse, Proposal } from '@/types/api';

export async function fetchProposalsAction(params?: {
  page?: number;
  limit?: number;
  jobId?: string;
  rfqId?: string;
  vendorId?: string;
  sort?: string;
}): Promise<PaginatedResponse<Proposal>> {
  const session = await getSession();
  if (!session.authenticated) return { data: [], total: 0 };

  const token = await getAccessToken();
  if (!token) return { data: [], total: 0 };

  const api = createApiClient({ token });
  try {
    return await api.getProposals({
      page: params?.page ?? 1,
      limit: params?.limit ?? 20,
      jobId: params?.jobId,
      rfqId: params?.rfqId,
      vendorId: params?.vendorId,
      sort: params?.sort,
    });
  } catch (err) {
    console.error('[proposals/actions.fetchProposalsAction]', err);
    return { data: [], total: 0 };
  }
}
