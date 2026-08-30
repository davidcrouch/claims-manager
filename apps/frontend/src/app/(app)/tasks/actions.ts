'use server';

import { connection } from 'next/server';
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
  jobId?: string;
  jobIds?: string[];
  assignedToUserId?: string;
  assignedToUserIds?: string;
  names?: string;
  taskTypes?: string;
  overdue?: boolean;
}): Promise<PaginatedResponse<Task>> {
  await connection();
  const api = await getApi();
  if (!api) return { data: [], total: 0 };
  try {
    return await api.getTasks(params);
  } catch (err) {
    console.error('[tasks/actions fetchTasksAction]', err);
    return { data: [], total: 0 };
  }
}

export async function fetchTaskFilterOptionsAction(): Promise<{
  names: string[];
  taskTypes: string[];
  assignees: { id: string; name: string }[];
}> {
  const api = await getApi();
  if (!api) return { names: [], taskTypes: [], assignees: [] };
  try {
    return await api.getTaskFilterOptions();
  } catch (err) {
    console.error('[tasks/actions.fetchTaskFilterOptionsAction]', err);
    return { names: [], taskTypes: [], assignees: [] };
  }
}

export async function fetchTaskAction(id: string): Promise<Task | null> {
  const api = await getApi();
  if (!api) return null;
  try {
    return await api.getTask(id);
  } catch (err) {
    console.error('[tasks/actions.fetchTaskAction]', err);
    return null;
  }
}
