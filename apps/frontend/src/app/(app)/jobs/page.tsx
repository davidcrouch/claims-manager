import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { getServerApiClient } from '@/lib/server-api';
import { JobsPageClient } from '@/components/jobs/JobsPageClient';
import { toJobFormClaimOption } from '@/components/forms/job-form-claim';
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
  }>;
}) {
  const api = await getServerApiClient();
  if (!api) redirect('/api/auth/login');

  const params = await searchParams;
  const emptyJobs: PaginatedResponse<Job> = { data: [], total: 0 };

  const [
    initialJobs,
    jobTypesRes,
    jobTypesAllRes,
    statusLookupsRes,
    unreadJobIds,
    orgUsers,
    session,
    claimsRes,
  ] = await Promise.all([
    api
      .getJobs({
        page: parseInt(params.page ?? '1', 10),
        limit: 20,
        search: params.search,
        sort: params.sort,
        status: params.status,
        jobType: params.jobType,
      })
      .catch((err: unknown) => {
        console.error(
          'frontend:JobsPage - getJobs failed:',
          err instanceof Error ? err.message : err,
        );
        return emptyJobs;
      }),
    // Form create drawer: job types for Internal (direct) and Crunchwork
    Promise.all([
      api.getLookupsByDomain('job_type', { providerCode: 'direct' }).catch(() => []),
      api.getLookupsByDomain('job_type', { providerCode: 'crunchwork' }).catch(() => []),
    ]).then(([direct, crunchwork]) => [...direct, ...crunchwork]),
    // List column filter: all providers so IDs match jobs from any source
    api.getLookupsByDomain('job_type').catch(() => []),
    api.getLookupsByDomain('job_status').catch(() => []),
    api.getUnreadEntityIds('job').catch(() => [] as string[]),
    api.listOrgUsersForSelect().catch((err: unknown) => {
      console.error(
        'frontend:JobsPage - listOrgUsersForSelect failed:',
        err instanceof Error ? err.message : err,
      );
      return [] as { id: string; email?: string }[];
    }),
    getSession(),
    api.getClaims({ limit: 100, sort: 'updated_at_desc' }).catch((err: unknown) => {
      console.error(
        'frontend:JobsPage - getClaims failed:',
        err instanceof Error ? err.message : err,
      );
      return { data: [], total: 0 };
    }),
  ]);

  const email = session.identity?.email?.trim().toLowerCase();
  const sub = session.identity?.sub;
  const currentUserId =
    orgUsers.find((u) => email && u.email?.trim().toLowerCase() === email)?.id ??
    (sub && orgUsers.some((u) => u.id === sub) ? sub : null);

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
  const statusOptions = (Array.isArray(statusLookupsRes) ? statusLookupsRes : []).map(
    (row) => ({
      id: row.id,
      name: row.name?.trim() ? row.name : 'Unknown',
    }),
  );
  const claims = (claimsRes?.data ?? []).map(toJobFormClaimOption);

  return (
    <JobsPageClient
      initialData={initialJobs}
      jobTypes={jobTypes}
      jobTypeFilterOptions={jobTypeFilterOptions}
      claims={claims}
      statusOptions={statusOptions}
      unreadJobIds={unreadJobIds}
      currentUserId={currentUserId}
    />
  );
}
