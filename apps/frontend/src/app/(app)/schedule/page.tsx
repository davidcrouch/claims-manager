import { redirect } from 'next/navigation';
import { getServerApiClient } from '@/lib/server-api';
import { ScheduleClient } from '@/components/schedule/ScheduleClient';
import type { Job, Claim } from '@/types/api';

export const metadata = { title: 'Schedule — EnsureOS' };

export default async function SchedulePage({
  searchParams,
}: {
  searchParams: Promise<{ jobId?: string }>;
}) {
  const api = await getServerApiClient();
  if (!api) redirect('/api/auth/login');

  const params = await searchParams;

  let job: Job | null = null;
  let parentClaim: Claim | null = null;
  if (params.jobId) {
    job = await api.getJob(params.jobId).catch((err: unknown) => {
      console.error(
        'frontend:SchedulePage - getJob failed:',
        err instanceof Error ? err.message : err,
      );
      return null;
    });
    if (job?.claimId) {
      parentClaim = await api.getClaim(job.claimId).catch(() => null);
    }
  }

  return <ScheduleClient jobId={params.jobId} job={job} parentClaim={parentClaim} />;
}
