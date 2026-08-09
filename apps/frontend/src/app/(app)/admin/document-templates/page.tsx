import { redirect } from 'next/navigation';
import { getServerApiClient } from '@/lib/server-api';
import { DocumentTemplatesSettingsPanel } from '@/components/document-templates/DocumentTemplatesSettingsPanel';
import type { DocumentTemplatesFolderSetting, FSDocument } from '@/lib/api-client';

export const metadata = { title: 'Document Templates — EnsureOS' };

const DOCX_MIME =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

function isDocx(doc: FSDocument): boolean {
  return (
    doc.mimeType === DOCX_MIME ||
    doc.fileName.toLowerCase().endsWith('.docx')
  );
}

export default async function DocumentTemplatesPage() {
  const api = await getServerApiClient();
  if (!api) {
    redirect('/api/auth/login');
  }

  const [settingsResult, documentsResult, folderResult, filesystemResult] =
    await Promise.allSettled([
      api.getDocumentTemplateSettings(),
      api.getDocuments({ uploadStatus: 'complete', limit: 200, sort: 'name' }),
      api.getDocumentTemplatesFolder(),
      api.getCompanyFilesystem(),
    ]);

  const settings =
    settingsResult.status === 'fulfilled' ? settingsResult.value : [];
  const allDocs =
    documentsResult.status === 'fulfilled' ? documentsResult.value.data : [];
  const docxDocuments = allDocs.filter(isDocx);
  const folderValue =
    folderResult.status === 'fulfilled' ? folderResult.value : null;
  const initialFolder: DocumentTemplatesFolderSetting = {
    filesystemCategoryId: folderValue?.filesystemCategoryId ?? null,
    folder: folderValue?.folder ?? null,
  };
  const companyFilesystem =
    filesystemResult.status === 'fulfilled' ? filesystemResult.value : null;
  const companyCategories = companyFilesystem?.categories ?? [];

  return (
    <div className="flex min-h-0 flex-1 flex-col" style={{ height: '100%' }}>
      <DocumentTemplatesSettingsPanel
        initialSettings={settings}
        docxDocuments={docxDocuments}
        companyCategories={companyCategories}
        initialFolder={initialFolder}
      />
    </div>
  );
}
