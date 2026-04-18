'use server';

import { getSession, getAccessToken } from '@/lib/auth';
import { createApiClient } from '@/lib/api-client';
import type {
  ConnectionSummary,
  ConnectionDetail,
  WebhookEvent,
  PaginatedResponse,
  CreateConnectionPayload,
  UpdateConnectionPayload,
  ProviderConnection,
} from '@/types/api';

async function getApi() {
  const session = await getSession();
  if (!session.authenticated) return null;
  const token = await getAccessToken();
  if (!token) return null;
  return createApiClient({ token });
}

export async function fetchConnectionsAction(): Promise<ConnectionSummary[] | null> {
  const api = await getApi();
  if (!api) return null;
  return api.getConnections();
}

export async function fetchConnectionAction(
  id: string,
): Promise<ConnectionDetail | null> {
  const api = await getApi();
  if (!api) return null;
  return api.getConnection(id);
}

export async function fetchConnectionWebhookEventsAction(
  connectionId: string,
  params?: { page?: number; limit?: number; status?: string },
): Promise<PaginatedResponse<WebhookEvent> | null> {
  const api = await getApi();
  if (!api) return null;
  return api.getConnectionWebhookEvents(connectionId, params);
}

export async function createConnectionAction(
  providerCode: string,
  data: CreateConnectionPayload,
): Promise<{ success: boolean; connection?: ProviderConnection; error?: string }> {
  const api = await getApi();
  if (!api) return { success: false, error: 'Not authenticated' };
  try {
    const connection = await api.createProviderConnection(providerCode, data);
    return { success: true, connection };
  } catch (err) {
    console.error('[connections/actions.createConnectionAction]', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to create connection',
    };
  }
}

export async function updateConnectionAction(
  connectionId: string,
  data: UpdateConnectionPayload,
): Promise<{ success: boolean; error?: string }> {
  const api = await getApi();
  if (!api) return { success: false, error: 'Not authenticated' };
  try {
    await api.updateConnection(connectionId, data);
    return { success: true };
  } catch (err) {
    console.error('[connections/actions.updateConnectionAction]', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to update connection',
    };
  }
}
