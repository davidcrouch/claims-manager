'use server';

import { connection } from 'next/server';
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
  location?: string;
  appointmentTypeLookupIds?: string;
  sort?: string;
  order?: 'asc' | 'desc';
  jobId?: string;
  jobIds?: string[];
}): Promise<PaginatedResponse<Appointment>> {
  await connection();
  const api = await getApi();
  if (!api) return { data: [], total: 0 };
  try {
    return await api.getAppointments(params);
  } catch (err) {
    console.error('[fetchAppointmentsAction]', err);
    return { data: [], total: 0 };
  }
}

export async function fetchAppointmentFilterLocationsAction(): Promise<string[]> {
  const api = await getApi();
  if (!api) return [];
  try {
    return await api.getAppointmentFilterLocations();
  } catch (err) {
    console.error('[fetchAppointmentFilterLocationsAction]', err);
    return [];
  }
}

export async function fetchAppointmentFilterTypesAction(): Promise<
  { id: string; name: string }[]
> {
  const api = await getApi();
  if (!api) return [];
  try {
    return await api.getAppointmentFilterTypes();
  } catch (err) {
    console.error('[fetchAppointmentFilterTypesAction]', err);
    return [];
  }
}

export async function fetchAppointmentAction(id: string): Promise<Appointment | null> {
  const api = await getApi();
  if (!api) return null;
  try {
    return await api.getAppointment(id);
  } catch (err) {
    console.error('[appointments/actions.fetchAppointmentAction]', err);
    return null;
  }
}
