import { redirect } from 'next/navigation';
import { getServerApiClient } from '@/lib/server-api';
import { TasksListClient } from '@/components/tasks/TasksListClient';
import type { Job, Claim } from '@/types/api';

export const metadata = { title: 'Tasks — EnsureOS' };

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; search?: string; jobId?: string; status?: string; priority?: string; sort?: string }>;
}) {
  const api = await getServerApiClient();
  if (!api) redirect('/api/auth/login');

  const params = await searchParams;

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

  return <TasksListClient job={job} parentClaim={parentClaim} />;
}
