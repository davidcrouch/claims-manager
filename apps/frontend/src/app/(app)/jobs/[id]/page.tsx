import { redirect, notFound } from 'next/navigation';
import { getServerApiClient } from '@/lib/server-api';
import { loadClaim, loadJob } from '@/lib/cached-entity-loaders';
import { SetPageHeader } from '@/components/layout/SetPageHeader';
import { JobDetail } from '@/components/jobs/JobDetail';
import { JobPageHeader } from '@/components/jobs/JobHeader';
import type { Metadata } from 'next';
import type { Claim } from '@/types/api';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const job = await loadJob(id);
  const title = job?.externalReference ?? id;
  return { title: `${title} | EnsureOS` };
}

export default async function JobDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const api = await getServerApiClient();
  if (!api) redirect('/api/auth/login');

  const job = await loadJob(id);
  if (!job) {
    notFound();
  }

  // Fire-and-forget: mark any unread notifications for this job as read
  api.markEntityNotificationsRead('job', id).catch(() => {});

  const [parentClaim, statusOptions, jobTypeOptions, contactTypeOptions, reportStatusOptions, reportTypeOptions] =
    await Promise.all([
    job.claimId ? loadClaim(job.claimId) : Promise.resolve(null as Claim | null),
    api
      .getLookupsByDomain('job_status', { providerCode: 'crunchwork' })
      .catch((err: unknown) => {
        console.warn(
          'frontend:JobDetailPage - getLookupsByDomain(job_status) failed:',
          err instanceof Error ? err.message : err,
        );
        return [] as Awaited<ReturnType<typeof api.getLookupsByDomain>>;
      }),
    api
      .getLookupsByDomain('job_type', { providerCode: 'crunchwork' })
      .catch((err: unknown) => {
        console.warn(
          'frontend:JobDetailPage - getLookupsByDomain(job_type) failed:',
          err instanceof Error ? err.message : err,
        );
        return [] as Awaited<ReturnType<typeof api.getLookupsByDomain>>;
      }),
    api.getLookupsByDomain('contact_type').catch(() => []),
    api.getLookupsByDomain('report_status').catch(() => []),
    api.getLookupsByDomain('report_type').catch(() => []),
  ]);

  const toOptions = (
    rows: Awaited<ReturnType<typeof api.getLookupsByDomain>>,
  ) =>
    (Array.isArray(rows) ? rows : []).map((row) => ({
      id: row.id,
      name: row.name?.trim() ? row.name : 'Unknown',
    }));

  return (
    <>
      <SetPageHeader>
        <JobPageHeader job={job} parentClaim={parentClaim} />
      </SetPageHeader>
      <JobDetail
        job={job}
        parentClaim={parentClaim}
        statusOptions={statusOptions}
        jobTypeOptions={jobTypeOptions}
        contactTypeOptions={toOptions(contactTypeOptions)}
        reportStatusOptions={toOptions(reportStatusOptions)}
        reportTypeOptions={toOptions(reportTypeOptions)}
      />
    </>
  );
}
