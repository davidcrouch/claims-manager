import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { getServerApiClient } from '@/lib/server-api';
import { resolveCurrentOrgUserId } from '@/lib/current-org-user';
import { ScheduleClient } from '@/components/schedule/ScheduleClient';
import type { Job, Claim } from '@/types/api';

export const metadata = { title: 'Schedule — EnsureOS' };

export default async function SchedulePage({
  searchParams,
}: {
  searchParams: Promise<{ jobId?: string; assignedToUserId?: string; assignedToUserIds?: string }>;
}) {
  const api = await getServerApiClient();
  if (!api) redirect('/api/auth/login');

  const params = await searchParams;

  const [orgUsers, session] = await Promise.all([
    api.listOrgUsersForSelect().catch((err: unknown) => {
      console.error(
        'frontend:SchedulePage - listOrgUsersForSelect failed:',
        err instanceof Error ? err.message : err,
      );
      return [] as { id: string; email?: string }[];
    }),
    getSession(),
  ]);

  const currentUserId = resolveCurrentOrgUserId(orgUsers, session.identity);

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

  return (
    <ScheduleClient
      jobId={params.jobId}
      job={job}
      parentClaim={parentClaim}
      currentUserId={currentUserId}
    />
  );
}
