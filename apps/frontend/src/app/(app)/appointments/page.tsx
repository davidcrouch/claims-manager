import { redirect } from 'next/navigation';
import { getServerApiClient } from '@/lib/server-api';
import { AppointmentsListClient } from '@/components/appointments/AppointmentsListClient';
import {toJobOptions,
  mergeCurrentJobIntoOptions } from '@/components/shared/job-label';
import type { Job, Claim, PaginatedResponse } from '@/types/api';

export const metadata = { title: 'Appointments — EnsureOS' };

export default async function AppointmentsPage({
  searchParams }: {
  searchParams: Promise<{ jobId?: string }>;
}) {
  const api = await getServerApiClient();
  if (!api) redirect('/api/auth/login');

  const params = await searchParams;

  const emptyJobs: PaginatedResponse<Job> = { data: [], total: 0 };
  const jobsRes = await api.getJobs({ limit: 100 }).catch((err: unknown) => {
    console.error(
      'frontend:AppointmentsPage - getJobs failed:',
      err instanceof Error ? err.message : err,
    );
    return emptyJobs;
  });

  let job: Job | null = null;
  let parentClaim: Claim | null = null;
  if (params.jobId) {
    job = await api.getJob(params.jobId).catch((err: unknown) => {
      console.error(
        'frontend:AppointmentsPage - getJob failed:',
        err instanceof Error ? err.message : err,
      );
      return null;
    });
    if (job?.claimId) {
      parentClaim = await api.getClaim(job.claimId).catch(() => null);
    }
  }

  return (
    <AppointmentsListClient
      jobs={mergeCurrentJobIntoOptions(toJobOptions(jobsRes?.data ?? []), job)}
      job={job}
      parentClaim={parentClaim}
    />
  );
}
