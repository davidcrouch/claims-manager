import { redirect } from 'next/navigation';
import { getServerApiClient } from '@/lib/server-api';
import { FilesystemSettingsPanel } from '@/components/filesystem/FilesystemSettingsPanel';

export const metadata = { title: 'Document Settings — EnsureOS' };

export default async function DocumentSettingsPage() {
  const api = await getServerApiClient();
  if (!api) {
    redirect('/api/auth/login');
  }

  const [filesystemResult, templatesResult] = await Promise.allSettled([
    api.getFilesystem(),
    api.getFilesystemTemplates(),
  ]);

  const filesystem = filesystemResult.status === 'fulfilled' ? filesystemResult.value : null;
  const templates =
    templatesResult.status === 'fulfilled' ? templatesResult.value.data : [];

  return (
    <div className="flex min-h-0 flex-1 flex-col" style={{ height: '100%' }}>
      <div className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-2xl">
          <FilesystemSettingsPanel
            initialFilesystem={filesystem}
            initialTemplates={templates}
          />
        </div>
      </div>
    </div>
  );
}
