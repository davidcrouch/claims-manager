'use server';

import { getSession, getAccessToken } from '@/lib/auth';
import { createApiClient } from '@/lib/api-client';
import type { PaginatedResponse } from '@/types/api';
import type { Report } from '@/types/api';

export async function fetchReportsAction(params: {
  page?: number;
  limit?: number;
  jobId?: string;
  claimId?: string;
}): Promise<PaginatedResponse<Report> | null> {
  const session = await getSession();
  if (!session.authenticated) return null;

  const token = await getAccessToken();
  if (!token) return null;

  const api = createApiClient({ token });
  return api.getReports({
    page: params.page ?? 1,
    limit: params.limit ?? 20,
    jobId: params.jobId,
    claimId: params.claimId,
  });
}
