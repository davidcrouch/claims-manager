'use server';

import { getSession, getAccessToken } from '@/lib/auth';
import { createApiClient } from '@/lib/api-client';
import type { Journal, PaginatedResponse } from '@/types/api';

async function getApi() {
  const session = await getSession();
  if (!session.authenticated) return null;
  const token = await getAccessToken();
  if (!token) return null;
  return createApiClient({ token });
}

export async function fetchJournalsByEntityAction(
  entityType: string,
  entityId: string,
): Promise<Journal[]> {
  const api = await getApi();
  if (!api) return [];
  return api.getJournalsByEntity(entityType, entityId);
}

export async function fetchJournalsListAction(): Promise<Journal[]> {
  const api = await getApi();
  if (!api) return [];
  const res = await api.getJournals({ limit: 100, status: 'active' });
  return res.data;
}

export async function fetchJournalsAction(params?: {
  page?: number;
  limit?: number;
  status?: string;
}): Promise<PaginatedResponse<Journal>> {
  const api = await getApi();
  if (!api) return { data: [], total: 0 };
  try {
    return await api.getJournals({
      page: params?.page ?? 1,
      limit: params?.limit ?? 20,
      status: params?.status,
    });
  } catch (err) {
    console.error('[journals/actions.fetchJournalsAction]', err);
    return { data: [], total: 0 };
  }
}

export async function createJournalAction(data: {
  name: string;
  description?: string;
}): Promise<Journal | null> {
  const api = await getApi();
  if (!api) return null;
  return api.createJournal(data);
}

export async function linkJournalAction(
  journalId: string,
  entityType: string,
  entityId: string,
): Promise<boolean> {
  const api = await getApi();
  if (!api) return false;
  await api.linkJournalToEntity(journalId, entityType, entityId);
  return true;
}

export async function unlinkJournalAction(
  journalId: string,
  entityType: string,
  entityId: string,
): Promise<boolean> {
  const api = await getApi();
  if (!api) return false;
  await api.unlinkJournalFromEntity(journalId, entityType, entityId);
  return true;
}
