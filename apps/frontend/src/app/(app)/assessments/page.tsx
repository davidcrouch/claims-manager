import { redirect } from 'next/navigation';
import { getServerApiClient } from '@/lib/server-api';
import { AssessmentsPageClient } from '@/components/assessments/AssessmentsPageClient';
import {buildJobNameById, toJobOptions,
  mergeCurrentJobIntoNameById,
  mergeCurrentJobIntoOptions } from '@/components/shared/job-label';
import type { Metadata } from 'next';
import type { Job, Claim, PaginatedResponse } from '@/types/api';

export const metadata: Metadata = {
  title: 'Assessments | EnsureOS' };

export default async function AssessmentsPage({
  searchParams }: {
  searchParams: Promise<{ page?: string; status?: string; jobId?: string; jobIds?: string; search?: string }>;
}) {
  const api = await getServerApiClient();
  if (!api) redirect('/api/auth/login');

  const params = await searchParams;
  const emptyJobs: PaginatedResponse<Job> = { data: [], total: 0 };
  const jobIds = params.jobIds
    ? params.jobIds.split(',').map((id) => id.trim()).filter(Boolean)
    : undefined;

  const [result, jobsRes] = await Promise.all([
    api.getAssessments({
      page: parseInt(params.page ?? '1', 10),
      limit: 20,
      status: params.status,
      jobId: params.jobId,
      jobIds,
      search: params.search }).catch((err: unknown) => {
      console.error(
        'frontend:AssessmentsPage - getAssessments failed:',
        err instanceof Error ? err.message : err,
      );
      return { data: [], total: 0 };
    }),
    api.getJobs({ limit: 100 }).catch((err: unknown) => {
      console.error(
        'frontend:AssessmentsPage - getJobs failed:',
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
        'frontend:AssessmentsPage - getJob failed:',
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
    <AssessmentsPageClient
      initialData={result}
      job={job}
      parentClaim={parentClaim}
      jobNameById={mergeCurrentJobIntoNameById(buildJobNameById(jobs), job)}
      jobs={mergeCurrentJobIntoOptions(toJobOptions(jobs), job)}
    />
  );
}
