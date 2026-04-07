import { redirect } from 'next/navigation';
import { getServerApiClient } from '@/lib/server-api';
import { SetBreadcrumbs } from '@/components/layout/SetBreadcrumbs';
import { JobsPageClient } from '@/components/jobs/JobsPageClient';

export default async function JobsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; search?: string }>;
}) {
  const api = await getServerApiClient();
  if (!api) redirect('/api/auth/login');

  const params = await searchParams;
  const [initialJobs, claimsRes, jobTypesRes] = await Promise.all([
    api.getJobs({
      page: parseInt(params.page ?? '1', 10),
      limit: 20,
      search: params.search,
    }),
    api.getClaims({ limit: 100 }),
    api.getLookupsByDomain('job_type').catch(() => []),
  ]);

  const claims = claimsRes?.data ?? [];
  const jobTypes = Array.isArray(jobTypesRes) ? jobTypesRes : [];

  return (
    <>
      <SetBreadcrumbs items={[{ title: 'Jobs', href: '/jobs' }]} />
      <JobsPageClient
        initialData={initialJobs}
        claims={claims}
        jobTypes={jobTypes}
      />
    </>
  );
}
