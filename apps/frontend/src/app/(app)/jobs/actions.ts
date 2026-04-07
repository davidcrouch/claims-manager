'use server';

import { getSession, getAccessToken } from '@/lib/auth';
import { createApiClient } from '@/lib/api-client';
import type { PaginatedResponse } from '@/types/api';
import type { Job } from '@/types/api';

export async function fetchJobsAction(params: {
  page?: number;
  limit?: number;
  search?: string;
  claimId?: string;
}): Promise<PaginatedResponse<Job> | null> {
  const session = await getSession();
  if (!session.authenticated) return null;

  const token = await getAccessToken();
  if (!token) return null;

  const api = createApiClient({ token });
  return api.getJobs({
    page: params.page ?? 1,
    limit: params.limit ?? 20,
    search: params.search,
    claimId: params.claimId,
  });
}
