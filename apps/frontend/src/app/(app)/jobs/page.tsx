import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { getServerApiClient } from '@/lib/server-api';
import { JobsPageClient } from '@/components/jobs/JobsPageClient';
import { toJobFormClaimOption } from '@/components/forms/job-form-claim';
import {
  buildJobsListFetchKeyFromPageParams,
  isJobsMineTab,
  JOBS_PAGE_SIZE,
  parseJobsListTab,
  resolveJobsListStatusParam,
} from '@/components/jobs/jobs-list-helpers';
import type { Job, PaginatedResponse } from '@/types/api';

export default async function JobsPage({
  searchParams,
}: {
  searchParams: Promise<{
    page?: string;
    search?: string;
    sort?: string;
    status?: string;
    jobType?: string;
    tab?: string;
    refs?: string;
    archiveState?: string;
    assignedToUserId?: string;
    assignedToUserIds?: string;
  }>;
}) {
  const api = await getServerApiClient();
  if (!api) redirect('/api/auth/login');

  const params = await searchParams;
  const emptyJobs: PaginatedResponse<Job> = { data: [], total: 0 };
  const tab = parseJobsListTab(params.tab ?? null);

  const [statusLookupsRes, jobTypesRes, jobTypesAllRes, orgUsers, session] = await Promise.all([
    api.getLookupsByDomain('job_status').catch(() => []),
    Promise.all([
      api.getLookupsByDomain('job_type', { providerCode: 'direct' }).catch(() => []),
      api.getLookupsByDomain('job_type', { providerCode: 'crunchwork' }).catch(() => []),
    ]).then(([direct, crunchwork]) => [...direct, ...crunchwork]),
    api.getLookupsByDomain('job_type').catch(() => []),
    api.listOrgUsersForSelect().catch((err: unknown) => {
      console.error(
        'frontend:JobsPage - listOrgUsersForSelect failed:',
        err instanceof Error ? err.message : err,
      );
      return [] as { id: string; email?: string }[];
    }),
    getSession(),
  ]);

  const email = session.identity?.email?.trim().toLowerCase();
  const sub = session.identity?.sub;
  const currentUserId =
    orgUsers.find((u) => email && u.email?.trim().toLowerCase() === email)?.id ??
    (sub && orgUsers.some((u) => u.id === sub) ? sub : null);

  const effectiveTab =
    tab === 'active' && params.assignedToUserId && params.assignedToUserId === currentUserId
      ? 'mine'
      : tab;
  const mineTab = isJobsMineTab(effectiveTab);

  const statusOptions = (Array.isArray(statusLookupsRes) ? statusLookupsRes : []).map(
    (row) => ({
      id: row.id,
      name: row.name?.trim() ? row.name : 'Unknown',
    }),
  );
  const initialStatus = resolveJobsListStatusParam({
    tab: effectiveTab,
    statusOptions,
    explicitStatus: params.status,
    archiveState: mineTab ? params.archiveState : undefined,
  });
  const initialAssignedToUserId = mineTab && currentUserId ? currentUserId : undefined;
  const initialAssignedToUserIds = mineTab ? undefined : params.assignedToUserIds;
  const initialFetchKey = buildJobsListFetchKeyFromPageParams({
    search: params.search,
    sort: params.sort,
    tab: effectiveTab,
    page: params.page,
    status: initialStatus,
    jobType: params.jobType,
    refs: params.refs,
    assignedToUserId: initialAssignedToUserId,
    assignedToUserIds: initialAssignedToUserIds,
  });

  let jobsSsrOk = false;
  const [initialJobs, unreadJobIds, claimsRes] = await Promise.all([
    api
      .getJobs({
        page: parseInt(params.page ?? '1', 10),
        limit: JOBS_PAGE_SIZE,
        search: params.search,
        sort: params.sort,
        status: initialStatus,
        jobType: params.jobType,
        refs: params.refs,
        assignedToUserId: initialAssignedToUserId,
        assignedToUserIds: initialAssignedToUserIds,
      })
      .then((data) => {
        jobsSsrOk = true;
        return data;
      })
      .catch((err: unknown) => {
        console.error(
          'frontend:JobsPage - getJobs failed:',
          err instanceof Error ? err.message : err,
        );
        return emptyJobs;
      }),
    api.getUnreadEntityIds('job').catch(() => [] as string[]),
    api.getClaims({ limit: 100, sort: 'updated_at_desc' }).catch((err: unknown) => {
      console.error(
        'frontend:JobsPage - getClaims failed:',
        err instanceof Error ? err.message : err,
      );
      return { data: [], total: 0 };
    }),
  ]);

  const jobTypes = (Array.isArray(jobTypesRes) ? jobTypesRes : []).map((row) => ({
    id: row.id,
    name: row.name,
    providerCode: row.providerCode ?? null,
  }));
  const jobTypeFilterOptions = (Array.isArray(jobTypesAllRes) ? jobTypesAllRes : []).map(
    (row) => ({
      id: row.id,
      name: row.name?.trim() ? row.name.trim() : 'Unknown',
    }),
  );
  const claims = (claimsRes?.data ?? []).map(toJobFormClaimOption);

  return (
    <JobsPageClient
      initialData={initialJobs}
      initialFetchKey={jobsSsrOk ? initialFetchKey : undefined}
      jobTypes={jobTypes}
      jobTypeFilterOptions={jobTypeFilterOptions}
      claims={claims}
      statusOptions={statusOptions}
      unreadJobIds={unreadJobIds}
      currentUserId={currentUserId}
    />
  );
}
