import { redirect } from 'next/navigation';
import { getServerApiClient } from '@/lib/server-api';
import { FilesystemView } from '@/components/filesystem/FilesystemView';
import type { Job, Claim } from '@/types/api';

export const metadata = { title: 'Documents — EnsureOS' };

export default async function DocumentsPage({
  searchParams,
}: {
  searchParams: Promise<{ jobId?: string }>;
}) {
  const api = await getServerApiClient();
  if (!api) {
    redirect('/api/auth/login');
  }

  const params = await searchParams;

  const [filesystemResult, documentsResult] = await Promise.allSettled([
    api.getFilesystem(),
    api.getDocuments({ page: 1, limit: 24 }),
  ]);

  const filesystem = filesystemResult.status === 'fulfilled' ? filesystemResult.value : null;
  const documentsData =
    documentsResult.status === 'fulfilled' ? documentsResult.value : { data: [], total: 0 };

  let job: Job | null = null;
  let parentClaim: Claim | null = null;
  if (params.jobId) {
    job = await api.getJob(params.jobId).catch((err: unknown) => {
      console.error(
        'frontend:DocumentsPage - getJob failed:',
        err instanceof Error ? err.message : err,
      );
      return null;
    });
    if (job?.claimId) {
      parentClaim = await api.getClaim(job.claimId).catch(() => null);
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col" style={{ height: '100%' }}>
      <FilesystemView
        initialFilesystem={filesystem}
        initialDocuments={documentsData.data}
        initialTotal={documentsData.total}
        job={job}
        parentClaim={parentClaim}
      />
    </div>
  );
}
