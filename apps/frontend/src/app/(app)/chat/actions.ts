'use server';

import { getSession, getAccessToken } from '@/lib/auth';
import { createApiClient } from '@/lib/api-client';
import type { ChatConversationDetail, ChatConversationSummary } from '@/types/api';
import type { Agent, AiAuditRecord } from '@/lib/ai/types';
import { DEFAULT_AGENT } from '@/lib/ai/types';
import type { ChatMessage } from '@/lib/ai/chat-types';

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

export async function listConversationsAction(): Promise<ChatConversationSummary[]> {
  const api = await getApi();
  if (!api) return [];
  try {
    return await api.listConversations();
  } catch (err) {
    console.error('[chat/actions.listConversationsAction]', err);
    return [];
  }
}

export async function getConversationAction(
  id: string,
): Promise<ChatConversationDetail | null> {
  const api = await getApi();
  if (!api) return null;
  try {
    return await api.getConversation(id);
  } catch (err) {
    console.error('[chat/actions.getConversationAction]', err);
    return null;
  }
}

export async function createConversationAction(input?: {
  title?: string;
  id?: string;
  agentId?: string;
  relatedEntityType?: string;
  relatedEntityId?: string;
}): Promise<{ id: string } | null> {
  const api = await getApi();
  if (!api) return null;
  try {
    return await api.createConversation(input);
  } catch (err) {
    console.error('[chat/actions.createConversationAction]', err);
    return null;
  }
}

export async function updateConversationAction(
  id: string,
  data: {
    title?: string;
    messages?: ChatMessage[];
    pinned?: boolean;
    relatedEntityType?: string;
    relatedEntityId?: string;
  },
): Promise<{ success: boolean; error?: string }> {
  const api = await getApi();
  if (!api) return { success: false, error: 'Not authenticated' };
  try {
    await api.updateConversation(id, data);
    return { success: true };
  } catch (err) {
    console.error('[chat/actions.updateConversationAction]', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to save conversation',
    };
  }
}

export async function deleteConversationAction(
  id: string,
): Promise<{ success: boolean; error?: string }> {
  const api = await getApi();
  if (!api) return { success: false, error: 'Not authenticated' };
  try {
    await api.deleteConversation(id);
    return { success: true };
  } catch (err) {
    console.error('[chat/actions.deleteConversationAction]', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to delete conversation',
    };
  }
}

export async function pinConversationAction(
  id: string,
): Promise<{ success: boolean; error?: string }> {
  const api = await getApi();
  if (!api) return { success: false, error: 'Not authenticated' };
  try {
    await api.updateConversation(id, { pinned: true } as any);
    return { success: true };
  } catch (err) {
    console.error('[chat/actions.pinConversationAction]', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to pin conversation',
    };
  }
}

export async function unpinConversationAction(
  id: string,
): Promise<{ success: boolean; error?: string }> {
  const api = await getApi();
  if (!api) return { success: false, error: 'Not authenticated' };
  try {
    await api.updateConversation(id, { pinned: false } as any);
    return { success: true };
  } catch (err) {
    console.error('[chat/actions.unpinConversationAction]', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to unpin conversation',
    };
  }
}

export async function shareConversationAction(
  id: string,
  expiresInDays?: number,
): Promise<{ token: string; expiresAt: string | null } | null> {
  const api = await getApi();
  if (!api) return null;
  try {
    return await api.shareConversation(id, expiresInDays);
  } catch (err) {
    console.error('[chat/actions.shareConversationAction]', err);
    return null;
  }
}

export async function submitFeedbackAction(params: {
  conversationId: string;
  messageId: string;
  rating: 'positive' | 'negative';
}): Promise<{ success: boolean; error?: string }> {
  const api = await getApi();
  if (!api) return { success: false, error: 'Not authenticated' };
  try {
    await api.submitChatFeedback(params);
    return { success: true };
  } catch (err) {
    console.error('[chat/actions.submitFeedbackAction]', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to submit feedback',
    };
  }
}

export async function listChatAgentsAction(): Promise<Agent[]> {
  const api = await getApi();
  if (!api) return [DEFAULT_AGENT];
  try {
    const agents = await api.listAgents({ chatEnabled: true });
    return agents.length > 0 ? agents : [DEFAULT_AGENT];
  } catch (err) {
    console.error('[chat/actions.listChatAgentsAction]', err);
    return [DEFAULT_AGENT];
  }
}

// ── Canvas API actions ──

export async function createCanvasArtifactAction(params: {
  conversationId: string;
  title: string;
  contentType?: string;
  content: string;
  language?: string;
  componentName?: string;
  componentProps?: Record<string, unknown>;
}): Promise<{ id: string } | null> {
  const api = await getApi();
  if (!api) return null;
  try {
    return await api.createCanvasArtifact(params);
  } catch (err) {
    console.error('[chat/actions.createCanvasArtifactAction]', err);
    return null;
  }
}

export async function updateCanvasArtifactAction(
  id: string,
  content: string,
): Promise<{ success: boolean; error?: string }> {
  const api = await getApi();
  if (!api) return { success: false, error: 'Not authenticated' };
  try {
    await api.updateCanvasArtifact(id, content);
    return { success: true };
  } catch (err) {
    console.error('[chat/actions.updateCanvasArtifactAction]', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to update canvas artifact',
    };
  }
}

export async function listCanvasArtifactsAction(
  conversationId: string,
): Promise<unknown[]> {
  const api = await getApi();
  if (!api) return [];
  try {
    return await api.listCanvasArtifacts(conversationId);
  } catch (err) {
    console.error('[chat/actions.listCanvasArtifactsAction]', err);
    return [];
  }
}

export async function getConversationAuditAction(
  conversationId: string,
): Promise<AiAuditRecord[]> {
  const api = await getApi();
  if (!api) return [];
  try {
    return await api.getConversationAudit(conversationId);
  } catch (err) {
    console.error('[chat/actions.getConversationAuditAction]', err);
    return [];
  }
}
