'use server';

import { revalidatePath } from 'next/cache';
import { getSession, getAccessToken } from '@/lib/auth';
import { ApiError, createApiClient } from '@/lib/api-client';
import type { Job } from '@/types/api';

function nestErrorMessage(body: unknown, fallback: string): string {
  if (!body || typeof body !== 'object') return fallback;
  const message = (body as { message?: unknown }).message;
  if (typeof message === 'string' && message.trim()) return message;
  if (Array.isArray(message)) {
    const parts = message.filter((m): m is string => typeof m === 'string' && m.trim());
    if (parts.length) return parts.join('; ');
  }
  return fallback;
}

function nestOutboundPayload(body: unknown): Record<string, unknown> | undefined {
  if (!body || typeof body !== 'object') return undefined;
  const payload = (body as { outboundPayload?: unknown }).outboundPayload;
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return undefined;
  return payload as Record<string, unknown>;
}

export async function createJobAction(
  body: Record<string, unknown>,
  options?: { provider?: string },
): Promise<{
  success: boolean;
  job?: Job;
  error?: string;
  outboundPayload?: Record<string, unknown>;
}> {
  const session = await getSession();
  if (!session.authenticated) return { success: false, error: 'Not authenticated' };

  const token = await getAccessToken();
  if (!token) return { success: false, error: 'No token' };

  try {
    const api = createApiClient({ token });
    const job = await api.createJob(body, options);
    revalidatePath('/jobs');
    if (typeof body.claimId === 'string' && body.claimId) {
      revalidatePath(`/claims/${body.claimId}`);
    }
    return { success: true, job };
  } catch (err) {
    console.error('[jobs:createJobAction]', err);
    if (err instanceof ApiError) {
      return {
        success: false,
        error: nestErrorMessage(err.body, err.message || 'Failed to create job'),
        outboundPayload: nestOutboundPayload(err.body),
      };
    }
    return { success: false, error: err instanceof Error ? err.message : 'Failed to create job' };
  }
}

export async function addJobContactsAction(
  jobId: string,
  contacts: Array<{
    contactId?: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    mobilePhone?: string;
  }>,
): Promise<{ success: boolean; job?: Job; error?: string }> {
  const session = await getSession();
  if (!session.authenticated) return { success: false, error: 'Not authenticated' };

  const token = await getAccessToken();
  if (!token) return { success: false, error: 'No token' };

  try {
    const api = createApiClient({ token });
    const job = await api.addJobContacts(jobId, { contacts });
    revalidatePath('/jobs');
    revalidatePath(`/jobs/${jobId}`);
    return { success: true, job };
  } catch (err) {
    console.error('[jobs:addJobContactsAction]', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to add contacts',
    };
  }
}

export async function removeJobContactAction(
  jobId: string,
  contactId: string,
): Promise<{ success: boolean; job?: Job; error?: string }> {
  const session = await getSession();
  if (!session.authenticated) return { success: false, error: 'Not authenticated' };

  const token = await getAccessToken();
  if (!token) return { success: false, error: 'No token' };

  try {
    const api = createApiClient({ token });
    const job = await api.removeJobContact(jobId, contactId);
    revalidatePath('/jobs');
    revalidatePath(`/jobs/${jobId}`);
    return { success: true, job };
  } catch (err) {
    console.error('[jobs:removeJobContactAction]', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to remove contact',
    };
  }
}
