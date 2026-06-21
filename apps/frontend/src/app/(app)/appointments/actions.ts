'use server';

import { getSession, getAccessToken } from '@/lib/auth';
import { createApiClient } from '@/lib/api-client';
import type { Appointment, PaginatedResponse } from '@/types/api';

async function getApi() {
  const session = await getSession();
  if (!session.authenticated) return null;
  const token = await getAccessToken();
  if (!token) return null;
  return createApiClient({ token });
}

export async function fetchAppointmentsAction(params?: {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  sort?: string;
  order?: 'asc' | 'desc';
}): Promise<PaginatedResponse<Appointment>> {
  const api = await getApi();
  if (!api) return { data: [], total: 0 };
  try {
    return await api.getAppointments(params);
  } catch (err) {
    console.error('[fetchAppointmentsAction]', err);
    return { data: [], total: 0 };
  }
}
