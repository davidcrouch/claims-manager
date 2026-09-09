'use server';

import { getSession, getAccessToken } from '@/lib/auth';
import { createApiClient, ApiError } from '@/lib/api-client';
import type { Message, JobNote } from '@/types/api';

function isNotImplemented(err: unknown): boolean {
  if (err instanceof ApiError) {
    return err.status === 404 || err.status === 501;
  }
  return false;
}

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

export interface MessagesResult {
  data: Message[];
  phaseUnavailable: boolean;
  error?: string;
}

export async function fetchMessagesAction(params?: {
  page?: number;
  limit?: number;
  jobId?: string;
  jobIds?: string[];
  claimId?: string;
  readStatus?: string;
  fromNames?: string;
  toNames?: string;
  search?: string;
  sort?: string;
}): Promise<{ data: Message[]; total: number }> {
  const api = await getApi();
  if (!api) return { data: [], total: 0 };
  try {
    const res = await api.getMessages(params);
    return { data: res?.data ?? [], total: res?.total ?? 0 };
  } catch (err) {
    console.error('[messages/actions.fetchMessagesAction]', err);
    return { data: [], total: 0 };
  }
}

export async function fetchMessageFilterOptionsAction(): Promise<{
  fromNames: string[];
  toNames: string[];
  statuses: ('Read' | 'Unread')[];
}> {
  const api = await getApi();
  if (!api) return { fromNames: [], toNames: [], statuses: ['Read', 'Unread'] };
  try {
    return await api.getMessageFilterOptions();
  } catch (err) {
    console.error('[messages/actions.fetchMessageFilterOptionsAction]', err);
    return { fromNames: [], toNames: [], statuses: ['Read', 'Unread'] };
  }
}

export async function fetchEntityMessagesAction(
  entityType: 'job' | 'claim',
  entityId: string,
): Promise<MessagesResult> {
  const api = await getApi();
  if (!api) return { data: [], phaseUnavailable: false, error: 'Not authenticated' };
  try {
    const res = entityType === 'job'
      ? await api.getJobMessages(entityId)
      : await api.getClaimMessages(entityId);
    return { data: res?.data ?? [], phaseUnavailable: false };
  } catch (err) {
    if (isNotImplemented(err)) {
      return { data: [], phaseUnavailable: true };
    }
    console.error('[messages/actions.fetchEntityMessagesAction]', err);
    return {
      data: [],
      phaseUnavailable: false,
      error: err instanceof Error ? err.message : 'Failed to load messages',
    };
  }
}

export async function fetchNotesAction(params?: {
  page?: number;
  limit?: number;
  jobId?: string;
  jobIds?: string[];
  search?: string;
  sort?: string;
}): Promise<{ data: JobNote[]; total: number }> {
  const api = await getApi();
  if (!api) return { data: [], total: 0 };
  try {
    const res = await api.getNotes(params);
    return { data: res?.data ?? [], total: res?.total ?? 0 };
  } catch (err) {
    console.error('[messages/actions.fetchNotesAction]', err);
    return { data: [], total: 0 };
  }
}

export async function createNoteAction(params: {
  jobId: string;
  body: string;
}): Promise<{ success: boolean; note?: JobNote; error?: string }> {
  const api = await getApi();
  if (!api) return { success: false, error: 'Not authenticated' };
  try {
    const note = await api.createNote(params);
    return { success: true, note };
  } catch (err) {
    console.error('[messages/actions.createNoteAction]', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to add note',
    };
  }
}

export async function deleteNoteAction(id: string): Promise<{
  success: boolean;
  error?: string;
}> {
  const api = await getApi();
  if (!api) return { success: false, error: 'Not authenticated' };
  try {
    await api.deleteNote(id);
    return { success: true };
  } catch (err) {
    console.error('[messages/actions.deleteNoteAction]', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to delete note',
    };
  }
}
