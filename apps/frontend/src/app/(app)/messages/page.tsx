import { redirect } from 'next/navigation';
import { getServerApiClient } from '@/lib/server-api';
import { MessagesListClient } from '@/components/messages/MessagesListClient';
import { buildJobNameById } from '@/components/shared/job-label';
import type { Job, Claim, PaginatedResponse } from '@/types/api';

export const metadata = { title: 'Messages — EnsureOS' };

export default async function MessagesPage({
  searchParams,
}: {
  searchParams: Promise<{ jobId?: string }>;
}) {
  const api = await getServerApiClient();
  if (!api) redirect('/api/auth/login');

  const params = await searchParams;
  const emptyJobs: PaginatedResponse<Job> = { data: [], total: 0 };

  const jobsRes = await api.getJobs({ limit: 100 }).catch((err: unknown) => {
    console.error(
      'frontend:MessagesPage - getJobs failed:',
      err instanceof Error ? err.message : err,
    );
    return emptyJobs;
  });

  let job: Job | null = null;
  let parentClaim: Claim | null = null;
  if (params.jobId) {
    job = await api.getJob(params.jobId).catch((err: unknown) => {
      console.error(
        'frontend:MessagesPage - getJob failed:',
        err instanceof Error ? err.message : err,
      );
      return null;
    });
    if (job?.claimId) {
      parentClaim = await api.getClaim(job.claimId).catch(() => null);
    }
  }

  return (
    <MessagesListClient
      job={job}
      parentClaim={parentClaim}
      jobNameById={buildJobNameById(jobsRes?.data ?? [])}
    />
  );
}
