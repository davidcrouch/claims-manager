'use server';

import { getSession, getAccessToken } from '@/lib/auth';
import { createApiClient } from '@/lib/api-client';
import type { PaginatedResponse, Contact, ContactRelatedJob } from '@/types/api';

export async function fetchContactsAction(params?: {
  page?: number;
  limit?: number;
  search?: string;
  sort?: string;
  jobId?: string;
  jobIds?: string[];
  unlinkedOnly?: boolean;
  typeLookupIds?: string[];
  archived?: boolean;
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
      jobId: params?.jobId,
      jobIds: params?.jobIds,
      unlinkedOnly: params?.unlinkedOnly,
      typeLookupIds: params?.typeLookupIds,
      archived: params?.archived,
    });
  } catch (err) {
    console.error('[contacts/actions.fetchContactsAction]', err);
    return { data: [], total: 0 };
  }
}

export async function fetchContactAction(id: string): Promise<Contact | null> {
  const session = await getSession();
  if (!session.authenticated) return null;

  const token = await getAccessToken();
  if (!token) return null;

  const api = createApiClient({ token });
  try {
    return await api.getContact(id);
  } catch (err) {
    console.error('[contacts/actions.fetchContactAction]', err);
    return null;
  }
}

export async function fetchContactRelatedJobsAction(
  id: string,
): Promise<ContactRelatedJob[]> {
  const session = await getSession();
  if (!session.authenticated) return [];

  const token = await getAccessToken();
  if (!token) return [];

  const api = createApiClient({ token });
  try {
    return await api.getContactRelatedJobs(id);
  } catch (err) {
    console.error('[contacts/actions.fetchContactRelatedJobsAction]', err);
    return [];
  }
}
