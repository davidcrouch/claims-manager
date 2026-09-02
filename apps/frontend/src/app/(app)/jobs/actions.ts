'use server';

import { getSession, getAccessToken } from '@/lib/auth';
import { createApiClient } from '@/lib/api-client';
import {
  buildJobsListFetchKey,
  DEFAULT_JOBS_SORT,
  statusIdsForJobsListTab,
} from '@/components/jobs/jobs-list-helpers';
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
  assignedToUserId?: string;
  assignedToUserIds?: string;
  refs?: string;
}): Promise<PaginatedResponse<Job> | null> {
  const session = await getSession();
  if (!session.authenticated) return null;

  const token = await getAccessToken();
  if (!token) return null;

  const tenantId =
    session.identity?.organization_id ??
    process.env.NEXT_PUBLIC_DEFAULT_TENANT_ID ??
    undefined;
  const api = createApiClient({ token, tenantId });
  try {
    return await api.getJobs({
      page: params.page ?? 1,
      limit: params.limit ?? 20,
      search: params.search,
      claimId: params.claimId,
      sort: params.sort,
      status: params.status,
      jobType: params.jobType,
      assignedToUserId: params.assignedToUserId,
      assignedToUserIds: params.assignedToUserIds,
      refs: params.refs,
    });
  } catch (err) {
    console.error(
      'frontend:fetchJobsAction - getJobs failed:',
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

export async function fetchJobFilterOptionsAction(): Promise<{
  refs: string[];
  assignees: { id: string; name: string }[];
}> {
  const session = await getSession();
  if (!session.authenticated) return { refs: [], assignees: [] };

  const token = await getAccessToken();
  if (!token) return { refs: [], assignees: [] };

  const api = createApiClient({ token });
  try {
    return await api.getJobFilterOptions();
  } catch (err) {
    console.error(
      'frontend:fetchJobFilterOptionsAction - getJobFilterOptions failed:',
      err instanceof Error ? err.message : err,
    );
    return { refs: [], assignees: [] };
  }
}

/** Lookups + first page of jobs for the job-switcher drawer on job detail. */
export async function fetchJobsPickerBootstrapAction(): Promise<{
  jobs: PaginatedResponse<Job>;
  statusOptions: { id: string; name: string }[];
  jobTypes: { id: string; name: string }[];
  unreadJobIds: string[];
  initialFetchKey?: string;
} | null> {
  const session = await getSession();
  if (!session.authenticated) return null;

  const token = await getAccessToken();
  if (!token) return null;

  const tenantId =
    session.identity?.organization_id ??
    process.env.NEXT_PUBLIC_DEFAULT_TENANT_ID ??
    undefined;
  const api = createApiClient({ token, tenantId });
  const emptyJobs: PaginatedResponse<Job> = { data: [], total: 0 };

  const [statusLookupsRes, jobTypesAllRes, unreadJobIds] = await Promise.all([
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
    api.getUnreadEntityIds('job').catch((err: unknown) => {
      console.error(
        'frontend:fetchJobsPickerBootstrapAction - getUnreadEntityIds failed:',
        err instanceof Error ? err.message : err,
      );
      return [] as string[];
    }),
  ]);

  const statusOptions = (Array.isArray(statusLookupsRes) ? statusLookupsRes : []).map((row) => ({
    id: row.id,
    name: row.name?.trim() ? row.name : 'Unknown',
  }));
  const activeStatus = statusIdsForJobsListTab('active', statusOptions);
  const initialFetchKey = buildJobsListFetchKey({
    sort: DEFAULT_JOBS_SORT,
    tab: 'active',
    page: 1,
    status: activeStatus,
  });

  let jobsSsrOk = false;
  const jobs = await api
    .getJobs({
      page: 1,
      limit: 20,
      sort: DEFAULT_JOBS_SORT,
      status: activeStatus,
    })
    .then((data) => {
      jobsSsrOk = true;
      return data;
    })
    .catch((err: unknown) => {
      console.error(
        'frontend:fetchJobsPickerBootstrapAction - getJobs failed:',
        err instanceof Error ? err.message : err,
      );
      return emptyJobs;
    });

  return {
    jobs,
    statusOptions,
    jobTypes: (Array.isArray(jobTypesAllRes) ? jobTypesAllRes : []).map((row) => ({
      id: row.id,
      name: row.name?.trim() ? row.name.trim() : 'Unknown',
    })),
    unreadJobIds,
    initialFetchKey: jobsSsrOk ? initialFetchKey : undefined,
  };
}
