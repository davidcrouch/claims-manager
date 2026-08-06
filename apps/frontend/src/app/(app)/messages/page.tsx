import { redirect } from 'next/navigation';
import { getServerApiClient } from '@/lib/server-api';
import { MessagesListClient } from '@/components/messages/MessagesListClient';
import type { Job, Claim } from '@/types/api';

export const metadata = { title: 'Messages — EnsureOS' };

export default async function MessagesPage({
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
        'frontend:MessagesPage - getJob failed:',
        err instanceof Error ? err.message : err,
      );
      return null;
    });
    if (job?.claimId) {
      parentClaim = await api.getClaim(job.claimId).catch(() => null);
    }
  }

  return <MessagesListClient job={job} parentClaim={parentClaim} />;
}
