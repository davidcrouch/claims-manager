'use server';

import { getSession, getAccessToken } from '@/lib/auth';
import { createApiClient } from '@/lib/api-client';
import type { PaginatedResponse } from '@/types/api';
import type { Quote } from '@/types/api';

export async function fetchQuotesAction(params: {
  page?: number;
  limit?: number;
  search?: string;
  jobId?: string;
  statusId?: string;
}): Promise<PaginatedResponse<Quote> | null> {
  const session = await getSession();
  if (!session.authenticated) return null;

  const token = await getAccessToken();
  if (!token) return null;

  const api = createApiClient({ token });
  return api.getQuotes({
    page: params.page ?? 1,
    limit: params.limit ?? 20,
    jobId: params.jobId,
    statusId: params.statusId,
  });
}
