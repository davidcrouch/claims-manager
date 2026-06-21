'use server';

import { getSession, getAccessToken } from '@/lib/auth';
import { createApiClient } from '@/lib/api-client';
import type { Task, PaginatedResponse } from '@/types/api';

async function getApi() {
  const session = await getSession();
  if (!session.authenticated) return null;
  const token = await getAccessToken();
  if (!token) return null;
  return createApiClient({ token });
}

export async function fetchTasksAction(params?: {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  priority?: string;
  sort?: string;
  order?: 'asc' | 'desc';
}): Promise<PaginatedResponse<Task>> {
  const api = await getApi();
  if (!api) return { data: [], total: 0 };
  try {
    return await api.getTasks(params);
  } catch (err) {
    console.error('[tasks/actions fetchTasksAction]', err);
    return { data: [], total: 0 };
  }
}
