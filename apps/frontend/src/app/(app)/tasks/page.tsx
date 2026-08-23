import { redirect } from 'next/navigation';
import { getServerApiClient } from '@/lib/server-api';
import { TasksListClient } from '@/components/tasks/TasksListClient';
import {buildJobNameById, toJobOptions,
  mergeCurrentJobIntoNameById,
  mergeCurrentJobIntoOptions } from '@/components/shared/job-label';
import type { Job, Claim, PaginatedResponse } from '@/types/api';

export const metadata = { title: 'Tasks — EnsureOS' };

export default async function TasksPage({
  searchParams }: {
  searchParams: Promise<{
    page?: string;
    search?: string;
    jobId?: string;
    status?: string;
    priority?: string;
    sort?: string;
    overdue?: string;
    assignedToUserId?: string;
  }>;
}) {
  const api = await getServerApiClient();
  if (!api) redirect('/api/auth/login');

  const params = await searchParams;
  const emptyJobs: PaginatedResponse<Job> = { data: [], total: 0 };

  const jobsRes = await api.getJobs({ limit: 100 }).catch((err: unknown) => {
    console.error(
      'frontend:TasksPage - getJobs failed:',
      err instanceof Error ? err.message : err,
    );
    return emptyJobs;
  });

  let job: Job | null = null;
  let parentClaim: Claim | null = null;
  if (params.jobId) {
    job = await api.getJob(params.jobId).catch((err: unknown) => {
      console.error(
        'frontend:TasksPage - getJob failed:',
        err instanceof Error ? err.message : err,
      );
      return null;
    });
    if (job?.claimId) {
      parentClaim = await api.getClaim(job.claimId).catch(() => null);
    }
  }

  const jobNameById = mergeCurrentJobIntoNameById(
    buildJobNameById(jobsRes?.data ?? []),
    job,
  );
  const jobs = mergeCurrentJobIntoOptions(
    toJobOptions(jobsRes?.data ?? []),
    job,
  );

  return (
    <TasksListClient
      job={job}
      parentClaim={parentClaim}
      jobNameById={jobNameById}
      jobs={jobs}
    />
  );
}
