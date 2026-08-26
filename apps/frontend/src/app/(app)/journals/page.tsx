import { redirect } from 'next/navigation';
import { getServerApiClient } from '@/lib/server-api';
import { JournalsPageClient } from '@/components/journals/JournalsPageClient';
import {buildJobNameById, buildJobTypeById, toJobOptions,
  mergeCurrentJobIntoNameById,
  mergeCurrentJobIntoTypeById,
  mergeCurrentJobIntoOptions } from '@/components/shared/job-label';
import type { Metadata } from 'next';
import type { Job, Claim, PaginatedResponse } from '@/types/api';

export const metadata: Metadata = {
  title: 'Journals | EnsureOS' };

export default async function JournalsPage({
  searchParams }: {
  searchParams: Promise<{ page?: string; status?: string; search?: string; jobId?: string; jobIds?: string }>;
}) {
  const api = await getServerApiClient();
  if (!api) redirect('/api/auth/login');

  const params = await searchParams;
  const emptyJobs: PaginatedResponse<Job> = { data: [], total: 0 };
  const jobIds = params.jobIds
    ? params.jobIds.split(',').map((id) => id.trim()).filter(Boolean)
    : undefined;

  const [result, jobsRes] = await Promise.all([
    api.getJournals({
      page: parseInt(params.page ?? '1', 10),
      limit: 20,
      status: params.status,
      search: params.search,
      jobId: params.jobId,
      jobIds }).catch((err: unknown) => {
      console.error(
        'frontend:JournalsPage - getJournals failed:',
        err instanceof Error ? err.message : err,
      );
      return { data: [], total: 0 };
    }),
    api.getJobs({ limit: 100 }).catch((err: unknown) => {
      console.error(
        'frontend:JournalsPage - getJobs failed:',
        err instanceof Error ? err.message : err,
      );
      return emptyJobs;
    }),
  ]);

  let job: Job | null = null;
  let parentClaim: Claim | null = null;
  if (params.jobId) {
    job = await api.getJob(params.jobId).catch((err: unknown) => {
      console.error(
        'frontend:JournalsPage - getJob failed:',
        err instanceof Error ? err.message : err,
      );
      return null;
    });
    if (job?.claimId) {
      parentClaim = await api.getClaim(job.claimId).catch(() => null);
    }
  }

  const jobs = jobsRes?.data ?? [];

  return (
    <JournalsPageClient
      initialData={result}
      job={job}
      parentClaim={parentClaim}
      jobNameById={mergeCurrentJobIntoNameById(buildJobNameById(jobs), job)}
      jobTypeById={mergeCurrentJobIntoTypeById(buildJobTypeById(jobs), job)}
      jobs={mergeCurrentJobIntoOptions(toJobOptions(jobs), job)}
    />
  );
}
