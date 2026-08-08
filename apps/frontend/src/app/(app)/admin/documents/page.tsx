import { redirect } from 'next/navigation';
import { getServerApiClient } from '@/lib/server-api';
import { FilesystemSettingsPanel } from '@/components/filesystem/FilesystemSettingsPanel';

export const metadata = { title: 'Document Categories — EnsureOS' };

export default async function DocumentSettingsPage() {
  const api = await getServerApiClient();
  if (!api) {
    redirect('/api/auth/login');
  }

  const [filesystemResult, companyTemplatesResult, projectTemplatesResult, defaultsResult] =
    await Promise.allSettled([
      api.getCompanyFilesystem(),
      api.getFilesystemTemplates('company'),
      api.getFilesystemTemplates('project'),
      api.getFilesystemDefaults(),
    ]);

  const filesystem = filesystemResult.status === 'fulfilled' ? filesystemResult.value : null;
  const companyTemplates =
    companyTemplatesResult.status === 'fulfilled' ? companyTemplatesResult.value.data : [];
  const projectTemplates =
    projectTemplatesResult.status === 'fulfilled' ? projectTemplatesResult.value.data : [];
  const defaults = defaultsResult.status === 'fulfilled' ? defaultsResult.value : null;

  return (
    <div className="flex min-h-0 flex-1 flex-col" style={{ height: '100%' }}>
      <div className="flex-1 overflow-y-auto">
        <FilesystemSettingsPanel
          initialFilesystem={filesystem}
          initialTemplates={companyTemplates}
          initialProjectTemplates={projectTemplates}
          initialDefaults={defaults}
        />
      </div>
    </div>
  );
}
