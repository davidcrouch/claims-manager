'use server';

import { getSession, getAccessToken } from '@/lib/auth';
import { createApiClient } from '@/lib/api-client';
import type { Job } from '@/types/api';

export async function createJobAction(body: Record<string, unknown>): Promise<{ success: boolean; job?: Job; error?: string }> {
  const session = await getSession();
  if (!session.authenticated) return { success: false, error: 'Not authenticated' };

  const token = await getAccessToken();
  if (!token) return { success: false, error: 'No token' };

  try {
    const api = createApiClient({ token });
    const job = await api.createJob(body);
    return { success: true, job };
  } catch (err) {
    console.error('[createJobAction]', err);
    return { success: false, error: err instanceof Error ? err.message : 'Failed to create job' };
  }
}
