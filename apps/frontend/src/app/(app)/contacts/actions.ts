'use server';

import { getSession, getAccessToken } from '@/lib/auth';
import { createApiClient } from '@/lib/api-client';
import type { PaginatedResponse, Contact } from '@/types/api';

export async function fetchContactsAction(params?: {
  page?: number;
  limit?: number;
  search?: string;
  sort?: string;
}): Promise<PaginatedResponse<Contact>> {
  const session = await getSession();
  if (!session.authenticated) return { data: [], total: 0 };

  const token = await getAccessToken();
  if (!token) return { data: [], total: 0 };

  const api = createApiClient({ token });
  try {
    return await api.getContacts({
      page: params?.page ?? 1,
      limit: params?.limit ?? 20,
      search: params?.search,
      sort: params?.sort,
    });
  } catch (err) {
    console.error('[contacts/actions.fetchContactsAction]', err);
    return { data: [], total: 0 };
  }
}
