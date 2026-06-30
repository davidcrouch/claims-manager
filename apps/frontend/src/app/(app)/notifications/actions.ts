'use server';

import { getSession, getAccessToken } from '@/lib/auth';
import { createApiClient } from '@/lib/api-client';
import type { PaginatedResponse, AppNotification } from '@/types/api';

export async function fetchNotificationsAction(params?: {
  entityType?: string;
  isRead?: boolean;
  limit?: number;
}): Promise<PaginatedResponse<AppNotification> | null> {
  const session = await getSession();
  if (!session.authenticated) return null;

  const token = await getAccessToken();
  if (!token) return null;

  const api = createApiClient({ token });
  return api.getNotifications(params);
}

export async function fetchUnreadCountAction(): Promise<number> {
  const session = await getSession();
  if (!session.authenticated) return 0;

  const token = await getAccessToken();
  if (!token) return 0;

  const api = createApiClient({ token });
  const result = await api.getUnreadNotificationCount();
  return result.count;
}

export async function fetchUnreadEntityIdsAction(
  entityType: string,
): Promise<string[]> {
  const session = await getSession();
  if (!session.authenticated) return [];

  const token = await getAccessToken();
  if (!token) return [];

  const api = createApiClient({ token });
  return api.getUnreadEntityIds(entityType);
}

export async function markNotificationReadAction(id: string): Promise<void> {
  const session = await getSession();
  if (!session.authenticated) return;

  const token = await getAccessToken();
  if (!token) return;

  const api = createApiClient({ token });
  await api.markNotificationRead(id);
}

export async function markEntityNotificationsReadAction(
  entityType: string,
  entityId: string,
): Promise<void> {
  const session = await getSession();
  if (!session.authenticated) return;

  const token = await getAccessToken();
  if (!token) return;

  const api = createApiClient({ token });
  await api.markEntityNotificationsRead(entityType, entityId);
}
