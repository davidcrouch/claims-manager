'use server';

import { getSession, getAccessToken } from '@/lib/auth';
import { createApiClient } from '@/lib/api-client';
import type { Agent } from '@/lib/ai/types';
import { DEFAULT_AGENT, normalizeAgent, uiProviderToApi } from '@/lib/ai/types';
import type { CreateAgentPayload } from '@/types/api';

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

export async function listAgentsAction(): Promise<Agent[]> {
  const api = await getApi();
  if (!api) return [DEFAULT_AGENT];
  try {
    const agents = await api.listAgents();
    const normalized = agents.map((agent) => normalizeAgent(agent));
    return normalized.length > 0 ? normalized : [DEFAULT_AGENT];
  } catch (err) {
    console.error('[admin/agents/actions.listAgentsAction]', err);
    return [DEFAULT_AGENT];
  }
}

export async function listChatAgentsAction(): Promise<Agent[]> {
  const api = await getApi();
  if (!api) return [DEFAULT_AGENT];
  try {
    const agents = await api.listAgents({ chatEnabled: true });
    const normalized = agents.map((agent) => normalizeAgent(agent));
    return normalized.length > 0 ? normalized : [DEFAULT_AGENT];
  } catch (err) {
    console.error('[admin/agents/actions.listChatAgentsAction]', err);
    return [DEFAULT_AGENT];
  }
}

export async function createAgentAction(
  payload: CreateAgentPayload,
): Promise<{ success: boolean; agent?: Agent; error?: string }> {
  const api = await getApi();
  if (!api) return { success: false, error: 'Not authenticated' };
  try {
    const agent = await api.createAgent(payload);
    return { success: true, agent: normalizeAgent(agent) };
  } catch (err) {
    console.error('[admin/agents/actions.createAgentAction]', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to create agent',
    };
  }
}

export async function deleteAgentAction(
  id: string,
): Promise<{ success: boolean; error?: string }> {
  const api = await getApi();
  if (!api) return { success: false, error: 'Not authenticated' };
  try {
    await api.deleteAgent(id);
    return { success: true };
  } catch (err) {
    console.error('[admin/agents/actions.deleteAgentAction]', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to delete agent',
    };
  }
}

export async function updateAgentAction(
  id: string,
  payload: Record<string, unknown>,
): Promise<{ success: boolean; agent?: Agent; error?: string }> {
  const api = await getApi();
  if (!api) return { success: false, error: 'Not authenticated' };
  try {
    const body = { ...payload };
    if (typeof body.provider === 'string') {
      body.provider = uiProviderToApi(body.provider as 'google' | 'anthropic');
    }
    const agent = await api.updateAgent(id, body);
    return { success: true, agent: normalizeAgent(agent) };
  } catch (err) {
    console.error('[admin/agents/actions.updateAgentAction]', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to update agent',
    };
  }
}

export async function getAiChatModelsAction(): Promise<
  Record<string, Array<{ id: string; label: string }>>
> {
  const api = await getApi();
  if (!api) return {};
  try {
    return await api.getAiChatModels();
  } catch (err) {
    console.error('[admin/agents/actions.getAiChatModelsAction]', err);
    return {};
  }
}
