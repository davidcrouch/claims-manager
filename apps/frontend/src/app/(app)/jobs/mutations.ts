'use server';

import { revalidatePath } from 'next/cache';
import { getSession, getAccessToken } from '@/lib/auth';
import { createApiClient } from '@/lib/api-client';
import type { Job } from '@/types/api';

export async function createJobAction(
  body: Record<string, unknown>,
  options?: { provider?: string },
): Promise<{ success: boolean; job?: Job; error?: string }> {
  const session = await getSession();
  if (!session.authenticated) return { success: false, error: 'Not authenticated' };

  const token = await getAccessToken();
  if (!token) return { success: false, error: 'No token' };

  try {
    const api = createApiClient({ token });
    const job = await api.createJob(body, options);
    revalidatePath('/jobs');
    return { success: true, job };
  } catch (err) {
    console.error('[jobs:createJobAction]', err);
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
