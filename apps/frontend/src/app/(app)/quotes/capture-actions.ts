'use server';

import { getSession, getAccessToken } from '@/lib/auth';
import {
  createApiClient,
  type CaptureEstimateRequest,
  type CaptureEstimateResponse,
} from '@/lib/api-client';

async function getApi() {
  const session = await getSession();
  if (!session.authenticated) return null;
  const token = await getAccessToken();
  if (!token) return null;
  return createApiClient({ token });
}

export async function captureEstimateAction(
  body: CaptureEstimateRequest,
): Promise<{ success: boolean; data?: CaptureEstimateResponse; error?: string }> {
  const api = await getApi();
  if (!api) return { success: false, error: 'Not authenticated' };

  try {
    const data = await api.captureEstimate(body);
    return { success: true, data };
  } catch (err) {
    console.error('[frontend:captureEstimateAction]', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to capture estimate',
    };
  }
}
