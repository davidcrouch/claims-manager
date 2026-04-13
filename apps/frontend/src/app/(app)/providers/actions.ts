'use server';

import { getSession, getAccessToken } from '@/lib/auth';
import { createApiClient } from '@/lib/api-client';
import type {
  ProviderSummary,
  Provider,
  ProviderConnection,
  WebhookEvent,
  PaginatedResponse,
  CreateProviderPayload,
  UpdateProviderPayload,
  CreateConnectionPayload,
  UpdateConnectionPayload,
} from '@/types/api';

async function getApi() {
  const session = await getSession();
  if (!session.authenticated) return null;
  const token = await getAccessToken();
  if (!token) return null;
  return createApiClient({ token });
}

export async function fetchProvidersAction(): Promise<ProviderSummary[] | null> {
  const api = await getApi();
  if (!api) return null;
  return api.getProviders();
}

export async function fetchProviderAction(
  id: string,
): Promise<Provider | null> {
  const api = await getApi();
  if (!api) return null;
  return api.getProvider(id);
}

export async function fetchProviderConnectionsAction(
  providerId: string,
): Promise<ProviderConnection[] | null> {
  const api = await getApi();
  if (!api) return null;
  return api.getProviderConnections(providerId);
}

export async function fetchProviderWebhookEventsAction(
  providerId: string,
  params?: { page?: number; limit?: number; status?: string },
): Promise<PaginatedResponse<WebhookEvent> | null> {
  const api = await getApi();
  if (!api) return null;
  return api.getProviderWebhookEvents(providerId, params);
}

export async function createProviderAction(
  data: CreateProviderPayload,
): Promise<{ success: boolean; provider?: Provider; error?: string }> {
  const api = await getApi();
  if (!api) return { success: false, error: 'Not authenticated' };
  try {
    const provider = await api.createProvider(data);
    return { success: true, provider };
  } catch (err) {
    console.error('[createProviderAction]', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to create provider',
    };
  }
}

export async function updateProviderAction(
  id: string,
  data: UpdateProviderPayload,
): Promise<{ success: boolean; error?: string }> {
  const api = await getApi();
  if (!api) return { success: false, error: 'Not authenticated' };
  try {
    await api.updateProvider(id, data);
    return { success: true };
  } catch (err) {
    console.error('[updateProviderAction]', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to update provider',
    };
  }
}

export async function createConnectionAction(
  providerId: string,
  data: CreateConnectionPayload,
): Promise<{ success: boolean; connection?: ProviderConnection; error?: string }> {
  const api = await getApi();
  if (!api) return { success: false, error: 'Not authenticated' };
  try {
    const connection = await api.createProviderConnection(providerId, data);
    return { success: true, connection };
  } catch (err) {
    console.error('[createConnectionAction]', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to create connection',
    };
  }
}

export async function updateConnectionAction(
  providerId: string,
  connId: string,
  data: UpdateConnectionPayload,
): Promise<{ success: boolean; error?: string }> {
  const api = await getApi();
  if (!api) return { success: false, error: 'Not authenticated' };
  try {
    await api.updateProviderConnection(providerId, connId, data);
    return { success: true };
  } catch (err) {
    console.error('[updateConnectionAction]', err);
    return {
      success: false,
      error:
        err instanceof Error ? err.message : 'Failed to update connection',
    };
  }
}
