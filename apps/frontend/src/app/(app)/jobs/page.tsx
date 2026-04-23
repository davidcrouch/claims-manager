import { redirect } from 'next/navigation';
import { getServerApiClient } from '@/lib/server-api';
import { JobsPageClient } from '@/components/jobs/JobsPageClient';
import type { Claim, Job, PaginatedResponse } from '@/types/api';

export default async function JobsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; search?: string }>;
}) {
  const api = await getServerApiClient();
  if (!api) redirect('/api/auth/login');

  const params = await searchParams;
  const emptyJobs: PaginatedResponse<Job> = { data: [], total: 0 };
  const emptyClaims: PaginatedResponse<Claim> = { data: [], total: 0 };

  const [initialJobs, claimsRes, jobTypesRes, statusLookupsRes] = await Promise.all([
    api
      .getJobs({
        page: parseInt(params.page ?? '1', 10),
        limit: 20,
        search: params.search,
      })
      .catch((err: unknown) => {
        console.error(
          'frontend:JobsPage - getJobs failed:',
          err instanceof Error ? err.message : err,
        );
        return emptyJobs;
      }),
    api.getClaims({ limit: 100 }).catch((err: unknown) => {
      console.error(
        'frontend:JobsPage - getClaims failed:',
        err instanceof Error ? err.message : err,
      );
      return emptyClaims;
    }),
    api.getLookupsByDomain('job_type').catch(() => []),
    api.getLookupsByDomain('job_status').catch(() => []),
  ]);

  const claims = claimsRes?.data ?? [];
  const jobTypes = Array.isArray(jobTypesRes) ? jobTypesRes : [];
  const statusOptions = (Array.isArray(statusLookupsRes) ? statusLookupsRes : []).map(
    (row) => ({
      id: row.id,
      name: row.name?.trim() ? row.name : 'Unknown',
    }),
  );

  return (
    <JobsPageClient
      initialData={initialJobs}
      claims={claims}
      jobTypes={jobTypes}
      statusOptions={statusOptions}
    />
  );
}
