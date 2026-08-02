'use server';

import { getSession, getAccessToken } from '@/lib/auth';
import { createApiClient } from '@/lib/api-client';
import type { Skill } from '@/lib/ai/types';
import type { CreateSkillPayload } from '@/types/api';

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

export async function listSkillsAction(): Promise<Skill[]> {
  const api = await getApi();
  if (!api) return [];
  try {
    return await api.listSkills();
  } catch (err) {
    console.error('[admin/skills/actions.listSkillsAction]', err);
    return [];
  }
}

export async function createSkillAction(
  payload: CreateSkillPayload,
): Promise<{ success: boolean; skill?: Skill; error?: string }> {
  const api = await getApi();
  if (!api) return { success: false, error: 'Not authenticated' };
  try {
    const skill = await api.createSkill(payload);
    return { success: true, skill };
  } catch (err) {
    console.error('[admin/skills/actions.createSkillAction]', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to create skill',
    };
  }
}

export async function updateSkillAction(
  id: string,
  data: Partial<Skill>,
): Promise<{ success: boolean; skill?: Skill; error?: string }> {
  const api = await getApi();
  if (!api) return { success: false, error: 'Not authenticated' };
  try {
    const skill = await api.updateSkill(id, data as Record<string, unknown>);
    return { success: true, skill };
  } catch (err) {
    console.error('[admin/skills/actions.updateSkillAction]', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to update skill',
    };
  }
}

export async function deleteSkillAction(
  id: string,
): Promise<{ success: boolean; error?: string }> {
  const api = await getApi();
  if (!api) return { success: false, error: 'Not authenticated' };
  try {
    await api.deleteSkill(id);
    return { success: true };
  } catch (err) {
    console.error('[admin/skills/actions.deleteSkillAction]', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to delete skill',
    };
  }
}

export async function testMatchAction(
  message: string,
  agentId?: string,
): Promise<{ matches?: Array<{ id: string; name: string; similarity: number }>; error?: string }> {
  const api = await getApi();
  if (!api) return { error: 'Not authenticated' };
  try {
    const result = await api.testSkillMatch({ message, agentId, topK: 5 });
    const matches = result.matches.map((m) => ({
      id: m.skill.id,
      name: m.skill.name,
      similarity: m.similarity,
    }));
    return { matches };
  } catch (err) {
    console.error('[admin/skills/actions.testMatchAction]', err);
    return { error: err instanceof Error ? err.message : 'Test match failed' };
  }
}
