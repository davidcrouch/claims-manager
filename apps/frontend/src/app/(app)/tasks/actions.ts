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
  jobId?: string;
  assignedToUserId?: string;
  overdue?: boolean;
}): Promise<PaginatedResponse<Task>> {
  const api = await getApi();
  if (!api) return { data: [], total: 0 };
  try {
    if (params?.jobId) {
      const tasks = await api.getJobTasks(params.jobId);
      return { data: tasks, total: tasks.length };
    }
    return await api.getTasks(params);
  } catch (err) {
    console.error('[tasks/actions fetchTasksAction]', err);
    return { data: [], total: 0 };
  }
}
