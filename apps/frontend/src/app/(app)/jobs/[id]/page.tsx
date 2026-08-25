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

  const [parentClaim, statusOptions, jobTypeLookups, contactTypeOptions, reportStatusOptions, reportTypeOptions, assessmentsResult] =
    await Promise.all([
    job.claimId ? loadClaim(job.claimId) : Promise.resolve(null as Claim | null),
    // All providers: synced CW statuses often have provider_code null, while
    // seed/crunchwork rows use provider_code='crunchwork'. Filtering to one
    // provider left the status select showing the lookup UUID.
    api.getLookupsByDomain('job_status').catch((err: unknown) => {
      console.warn(
        'frontend:JobDetailPage - getLookupsByDomain(job_status) failed:',
        err instanceof Error ? err.message : err,
      );
      return [] as Awaited<ReturnType<typeof api.getLookupsByDomain>>;
    }),
    Promise.all([
      api
        .getLookupsByDomain('job_type', { providerCode: 'crunchwork' })
        .catch((err: unknown) => {
          console.warn(
            'frontend:JobDetailPage - getLookupsByDomain(job_type, crunchwork) failed:',
            err instanceof Error ? err.message : err,
          );
          return [] as Awaited<ReturnType<typeof api.getLookupsByDomain>>;
        }),
      api
        .getLookupsByDomain('job_type', { providerCode: 'direct' })
        .catch((err: unknown) => {
          console.warn(
            'frontend:JobDetailPage - getLookupsByDomain(job_type, direct) failed:',
            err instanceof Error ? err.message : err,
          );
          return [] as Awaited<ReturnType<typeof api.getLookupsByDomain>>;
        }),
    ]).then(([crunchwork, direct]) => ({ crunchwork, direct })),
    api.getLookupsByDomain('contact_type').catch(() => []),
    api.getLookupsByDomain('report_status').catch(() => []),
    api.getLookupsByDomain('report_type').catch(() => []),
    api.getAssessments({ jobId: id, limit: 10 }).catch((err: unknown) => {
      console.warn(
        'frontend:JobDetailPage - getAssessments failed:',
        err instanceof Error ? err.message : err,
      );
      return { data: [], total: 0 };
    }),
  ]);

  const toOptions = (
    rows: Awaited<ReturnType<typeof api.getLookupsByDomain>>,
  ) =>
    (Array.isArray(rows) ? rows : []).map((row) => ({
      id: row.id,
      name: row.name?.trim() ? row.name : 'Unknown',
      externalReference: row.externalReference ?? undefined,
    }));

  const jobTypeOptions = jobTypeLookups.crunchwork;
  const makeSafeMatches = [
    ...jobTypeLookups.crunchwork,
    ...jobTypeLookups.direct,
  ].filter((row) => (row.name ?? '').trim().toLowerCase() === 'builder make safe');
  const makeSafeJobTypeRow =
    makeSafeMatches.find((row) => row.providerCode === 'crunchwork') ??
    makeSafeMatches[0] ??
    null;
  const makeSafeJobType = makeSafeJobTypeRow
    ? {
        id: makeSafeJobTypeRow.id,
        name: makeSafeJobTypeRow.name?.trim() || 'Builder Make Safe',
        externalReference: makeSafeJobTypeRow.externalReference ?? undefined,
      }
    : null;

  return (
    <>
      <SetPageHeader>
        <JobPageHeader job={job} parentClaim={parentClaim} />
      </SetPageHeader>
      <JobDetail
        job={job}
        parentClaim={parentClaim}
        statusOptions={toOptions(statusOptions)}
        jobTypeOptions={toOptions(jobTypeOptions)}
        contactTypeOptions={toOptions(contactTypeOptions)}
        reportStatusOptions={toOptions(reportStatusOptions)}
        reportTypeOptions={toOptions(reportTypeOptions)}
        assessments={assessmentsResult.data}
        makeSafeJobType={makeSafeJobType}
      />
    </>
  );
}
