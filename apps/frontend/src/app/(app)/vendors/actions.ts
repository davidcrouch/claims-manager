'use server';

import { getSession, getAccessToken } from '@/lib/auth';
import { createApiClient } from '@/lib/api-client';
import type { PaginatedResponse, Vendor } from '@/types/api';

export async function fetchVendorsAction(params?: {
  page?: number;
  limit?: number;
  search?: string;
  linked?: boolean;
  sort?: string;
}): Promise<PaginatedResponse<Vendor>> {
  const session = await getSession();
  if (!session.authenticated) return { data: [], total: 0 };

  const token = await getAccessToken();
  if (!token) return { data: [], total: 0 };

  const api = createApiClient({ token });
  try {
    return await api.getVendors({
      page: params?.page ?? 1,
      limit: params?.limit ?? 20,
      search: params?.search,
      linked: params?.linked,
      sort: params?.sort,
    });
  } catch (err) {
    console.error('[vendors/actions.fetchVendorsAction]', err);
    return { data: [], total: 0 };
  }
}
