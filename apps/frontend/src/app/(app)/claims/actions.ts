'use server';

import { getSession, getAccessToken } from '@/lib/auth';
import { createApiClient } from '@/lib/api-client';
import type { PaginatedResponse } from '@/types/api';
import type { Claim } from '@/types/api';

export async function fetchClaimsAction(params: {
  page?: number;
  limit?: number;
  search?: string;
  sort?: string;
  status?: string;
}): Promise<PaginatedResponse<Claim> | null> {
  const session = await getSession();
  if (!session.authenticated) return null;

  const token = await getAccessToken();
  if (!token) return null;

  const api = createApiClient({ token });
  return api.getClaims({
    page: params.page ?? 1,
    limit: params.limit ?? 20,
    search: params.search,
    sort: params.sort,
    status: params.status,
  });
}
