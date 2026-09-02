'use server';

import { getSession, getAccessToken } from '@/lib/auth';
import { createApiClient } from '@/lib/api-client';
import type { DashboardInbox } from '@/types/api';

async function getApi() {
  const session = await getSession();
  if (!session.authenticated) return null;
  const token = await getAccessToken();
  if (!token) return null;
  return createApiClient({ token });
}

export async function fetchDashboardInboxAction(params?: {
  mine?: boolean;
}): Promise<DashboardInbox | null> {
  const api = await getApi();
  if (!api) return null;
  try {
    return await api.getDashboardInbox(params);
  } catch (err) {
    console.error('[dashboard/actions fetchDashboardInboxAction]', err);
    return null;
  }
}
