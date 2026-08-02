'use server';

import { getSession, getAccessToken } from '@/lib/auth';
import { createApiClient } from '@/lib/api-client';
import type { McpIntegration } from '@/types/api';
import type { McpToolGroupResponse } from '@/lib/ai/types';

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

export async function listMcpIntegrationsAction(): Promise<McpIntegration[]> {
  const api = await getApi();
  if (!api) return [];
  try {
    return await api.listMcpIntegrations();
  } catch (err) {
    console.error('[admin/mcp-servers/actions.listMcpIntegrationsAction]', err);
    return [];
  }
}

export async function createMcpIntegrationAction(
  input: Record<string, unknown>,
): Promise<{ success: boolean; integration?: McpIntegration; error?: string }> {
  const api = await getApi();
  if (!api) return { success: false, error: 'Not authenticated' };
  try {
    const integration = await api.createMcpIntegration(input);
    return { success: true, integration };
  } catch (err) {
    console.error('[admin/mcp-servers/actions.createMcpIntegrationAction]', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to create integration',
    };
  }
}

export async function updateMcpIntegrationAction(
  id: string,
  input: Record<string, unknown>,
): Promise<{ success: boolean; error?: string }> {
  const api = await getApi();
  if (!api) return { success: false, error: 'Not authenticated' };
  try {
    await api.updateMcpIntegration(id, input);
    return { success: true };
  } catch (err) {
    console.error('[admin/mcp-servers/actions.updateMcpIntegrationAction]', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to update integration',
    };
  }
}

export async function deleteMcpIntegrationAction(
  id: string,
): Promise<{ success: boolean; error?: string }> {
  const api = await getApi();
  if (!api) return { success: false, error: 'Not authenticated' };
  try {
    await api.deleteMcpIntegration(id);
    return { success: true };
  } catch (err) {
    console.error('[admin/mcp-servers/actions.deleteMcpIntegrationAction]', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to delete integration',
    };
  }
}

export async function discoverMcpServerAction(body: {
  url: string;
}): Promise<Record<string, unknown>> {
  const api = await getApi();
  if (!api) throw new Error('Not authenticated');
  return api.discoverMcpServer(body) as Promise<Record<string, unknown>>;
}

export async function listMcpConnectionsAction() {
  const api = await getApi();
  if (!api) return [];
  try {
    return await api.listMcpConnections();
  } catch (err) {
    console.error('[admin/mcp-servers/actions.listMcpConnectionsAction]', err);
    return [];
  }
}

export async function createMcpConnectionAction(
  input: Record<string, unknown>,
) {
  const api = await getApi();
  if (!api) throw new Error('Not authenticated');
  return api.createMcpConnection(input);
}

export async function testMcpConnectionAction(id: string) {
  const api = await getApi();
  if (!api) throw new Error('Not authenticated');
  return api.testMcpConnection(id);
}

export async function disconnectMcpConnectionAction(id: string) {
  const api = await getApi();
  if (!api) throw new Error('Not authenticated');
  return api.disconnectMcpConnection(id);
}

export async function initiateMcpOAuthAction(input: {
  integrationId: string;
  redirectUri: string;
}) {
  const api = await getApi();
  if (!api) throw new Error('Not authenticated');
  return api.initiateMcpOAuth(input);
}

export async function listMcpToolsAction(): Promise<McpToolGroupResponse[]> {
  const api = await getApi();
  if (!api) return [];
  try {
    return await api.listMcpTools();
  } catch (err) {
    console.error('[admin/mcp-servers/actions.listMcpToolsAction]', err);
    return [];
  }
}

export async function refreshMcpToolsAction(connectionId: string) {
  const api = await getApi();
  if (!api) throw new Error('Not authenticated');
  return api.refreshMcpTools({ connectionId });
}
