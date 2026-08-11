'use server';

import { getSession, getAccessToken } from '@/lib/auth';
import { ApiError, createApiClient } from '@/lib/api-client';
import type { Assessment, PaginatedResponse } from '@/types/api';

async function getApi() {
  const session = await getSession();
  if (!session.authenticated) return null;
  const token = await getAccessToken();
  if (!token) return null;
  return createApiClient({ token });
}

export async function fetchAssessmentsAction(params?: {
  page?: number;
  limit?: number;
  status?: string;
  jobId?: string;
}): Promise<PaginatedResponse<Assessment>> {
  const api = await getApi();
  if (!api) return { data: [], total: 0 };
  try {
    return await api.getAssessments({
      page: params?.page ?? 1,
      limit: params?.limit ?? 20,
      status: params?.status,
      jobId: params?.jobId,
    });
  } catch (err) {
    console.error('[assessments/actions.fetchAssessmentsAction]', err);
    return { data: [], total: 0 };
  }
}

export async function createAssessmentAction(
  data: Partial<Assessment> & { name: string },
): Promise<Assessment | null> {
  const api = await getApi();
  if (!api) return null;
  return api.createAssessment(data);
}

export async function updateAssessmentAction(
  id: string,
  data: Partial<Assessment>,
): Promise<Assessment | null> {
  const api = await getApi();
  if (!api) return null;
  return api.updateAssessment(id, data);
}

export async function validateAssessmentAction(
  id: string,
): Promise<{ valid: boolean; errors: string[]; error?: string }> {
  const api = await getApi();
  if (!api) return { valid: false, errors: [], error: 'Not authenticated' };
  try {
    const result = await api.validateAssessment(id);
    return { valid: result.valid, errors: result.errors ?? [] };
  } catch (err) {
    console.error('[assessments/actions.validateAssessmentAction]', err);
    return {
      valid: false,
      errors: [],
      error: err instanceof Error ? err.message : 'Failed to validate assessment',
    };
  }
}

export async function publishAssessmentAction(
  id: string,
): Promise<{ success: boolean; assessment?: Assessment; error?: string }> {
  const api = await getApi();
  if (!api) return { success: false, error: 'Not authenticated' };
  try {
    const assessment = await api.publishAssessment(id);
    return { success: true, assessment };
  } catch (err) {
    console.error('[assessments/actions.publishAssessmentAction]', err);
    const details =
      err instanceof ApiError && err.body && typeof err.body === 'object'
        ? (err.body as { details?: unknown }).details
        : undefined;
    const detailText = Array.isArray(details)
      ? details.map((d) => String(d)).join('; ')
      : undefined;
    const message = err instanceof Error ? err.message : 'Failed to publish assessment';
    return {
      success: false,
      error: detailText ? `${message}: ${detailText}` : message,
    };
  }
}
