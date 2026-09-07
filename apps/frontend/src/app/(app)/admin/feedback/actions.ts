'use server';

import { getSession, getAccessToken } from '@/lib/auth';
import { createApiClient } from '@/lib/api-client';
import type { FeedbackItem, FeedbackStats } from '@/types/api';

async function getApi() {
  const session = await getSession();
  if (!session.authenticated) return null;
  const token = await getAccessToken();
  if (!token) return null;
  const tenantId =
    session.identity?.organization_id ??
    process.env.NEXT_PUBLIC_DEFAULT_TENANT_ID ??
    undefined;
  return createApiClient({ token, tenantId });
}

export async function fetchFeedbackAction(params: {
  page?: number;
  limit?: number;
  type?: string;
  status?: string;
  priority?: string;
  search?: string;
}): Promise<{ data: FeedbackItem[]; total: number }> {
  const api = await getApi();
  if (!api) return { data: [], total: 0 };
  try {
    return await api.getFeedback(params);
  } catch (err) {
    console.error('[admin/feedback/actions.fetchFeedbackAction]', err);
    return { data: [], total: 0 };
  }
}

export async function fetchFeedbackStatsAction(): Promise<FeedbackStats> {
  const api = await getApi();
  if (!api) return { byStatus: {}, byType: {}, total: 0 };
  try {
    return await api.getFeedbackStats();
  } catch (err) {
    console.error('[admin/feedback/actions.fetchFeedbackStatsAction]', err);
    return { byStatus: {}, byType: {}, total: 0 };
  }
}

export async function updateFeedbackAction(
  id: string,
  body: Partial<
    Pick<FeedbackItem, 'status' | 'priority' | 'resolution' | 'tags' | 'title' | 'description'>
  >,
): Promise<FeedbackItem> {
  const api = await getApi();
  if (!api) throw new Error('Not authenticated');
  return api.updateFeedback(id, body);
}
