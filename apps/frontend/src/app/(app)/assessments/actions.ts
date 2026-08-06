'use server';

import { getSession, getAccessToken } from '@/lib/auth';
import { createApiClient } from '@/lib/api-client';
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
