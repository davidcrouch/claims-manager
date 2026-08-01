import { redirect } from 'next/navigation';
import { getServerApiClient } from '@/lib/server-api';
import { FilesystemView } from '@/components/filesystem/FilesystemView';

export const metadata = { title: 'Documents — EnsureOS' };

export default async function DocumentsPage() {
  const api = await getServerApiClient();
  if (!api) {
    redirect('/api/auth/login');
  }

  const [filesystemResult, documentsResult] = await Promise.allSettled([
    api.getFilesystem(),
    api.getDocuments({ page: 1, limit: 24 }),
  ]);

  const filesystem = filesystemResult.status === 'fulfilled' ? filesystemResult.value : null;
  const documentsData =
    documentsResult.status === 'fulfilled' ? documentsResult.value : { data: [], total: 0 };

  return (
    <div className="flex min-h-0 flex-1 flex-col" style={{ height: '100%' }}>
      <FilesystemView
        initialFilesystem={filesystem}
        initialDocuments={documentsData.data}
        initialTotal={documentsData.total}
      />
    </div>
  );
}
