'use server';

import { getSession, getAccessToken } from '@/lib/auth';
import { createApiClient } from '@/lib/api-client';
import type { ScheduleEvent } from '@/types/api';

async function getApi() {
  const session = await getSession();
  if (!session.authenticated) return null;
  const token = await getAccessToken();
  if (!token) return null;
  return createApiClient({ token });
}

export async function fetchScheduleEventsAction(params: {
  from: string;
  to: string;
  eventType?: string;
  jobId?: string;
  limit?: number;
}): Promise<{ data: ScheduleEvent[]; total: number }> {
  const api = await getApi();
  if (!api) return { data: [], total: 0 };
  try {
    return await api.getScheduleEvents(params);
  } catch (err) {
    console.error('[schedule/actions fetchScheduleEventsAction]', err);
    return { data: [], total: 0 };
  }
}
