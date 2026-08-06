'use server';

import { getSession, getAccessToken } from '@/lib/auth';
import { createApiClient } from '@/lib/api-client';
import type { PaginatedResponse } from '@/types/api';
import type { Job } from '@/types/api';

export async function fetchJobByIdAction(jobId: string): Promise<Job | null> {
  const session = await getSession();
  if (!session.authenticated) return null;

  const token = await getAccessToken();
  if (!token) return null;

  const api = createApiClient({ token });
  return api.getJob(jobId).catch((err: unknown) => {
    console.error(
      'frontend:fetchJobByIdAction - getJob failed:',
      err instanceof Error ? err.message : err,
    );
    return null;
  });
}

export async function fetchJobsAction(params: {
  page?: number;
  limit?: number;
  search?: string;
  claimId?: string;
  sort?: string;
  status?: string;
  jobType?: string;
}): Promise<PaginatedResponse<Job> | null> {
  const session = await getSession();
  if (!session.authenticated) return null;

  const token = await getAccessToken();
  if (!token) return null;

  const api = createApiClient({ token });
  return api.getJobs({
    page: params.page ?? 1,
    limit: params.limit ?? 20,
    search: params.search,
    claimId: params.claimId,
    sort: params.sort,
    status: params.status,
    jobType: params.jobType,
  });
}

/** Lookups + first page of jobs for the job-switcher drawer on job detail. */
export async function fetchJobsPickerBootstrapAction(): Promise<{
  jobs: PaginatedResponse<Job>;
  statusOptions: { id: string; name: string }[];
  jobTypes: { id: string; name: string }[];
} | null> {
  const session = await getSession();
  if (!session.authenticated) return null;

  const token = await getAccessToken();
  if (!token) return null;

  const api = createApiClient({ token });
  const emptyJobs: PaginatedResponse<Job> = { data: [], total: 0 };

  const [jobs, statusLookupsRes, jobTypesAllRes] = await Promise.all([
    api.getJobs({ page: 1, limit: 20, sort: 'updated_at_desc' }).catch((err: unknown) => {
      console.error(
        'frontend:fetchJobsPickerBootstrapAction - getJobs failed:',
        err instanceof Error ? err.message : err,
      );
      return emptyJobs;
    }),
    api.getLookupsByDomain('job_status').catch((err: unknown) => {
      console.error(
        'frontend:fetchJobsPickerBootstrapAction - job_status lookups failed:',
        err instanceof Error ? err.message : err,
      );
      return [];
    }),
    api.getLookupsByDomain('job_type').catch((err: unknown) => {
      console.error(
        'frontend:fetchJobsPickerBootstrapAction - job_type lookups failed:',
        err instanceof Error ? err.message : err,
      );
      return [];
    }),
  ]);

  return {
    jobs,
    statusOptions: (Array.isArray(statusLookupsRes) ? statusLookupsRes : []).map((row) => ({
      id: row.id,
      name: row.name?.trim() ? row.name : 'Unknown',
    })),
    jobTypes: (Array.isArray(jobTypesAllRes) ? jobTypesAllRes : []).map((row) => ({
      id: row.id,
      name: row.name?.trim() ? row.name.trim() : 'Unknown',
    })),
  };
}
