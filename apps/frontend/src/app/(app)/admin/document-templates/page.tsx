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

  // Folder resolve is cheap (org config + category walk). Company filesystem is
  // still needed for the folder picker tree; documents feed the .docx selects.
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

  if (settingsResult.status === 'rejected') {
    console.error(
      'frontend:DocumentTemplatesPage — getDocumentTemplateSettings failed:',
      settingsResult.reason instanceof Error
        ? settingsResult.reason.message
        : settingsResult.reason,
    );
  }
  if (documentsResult.status === 'rejected') {
    console.error(
      'frontend:DocumentTemplatesPage — getDocuments failed:',
      documentsResult.reason instanceof Error
        ? documentsResult.reason.message
        : documentsResult.reason,
    );
  }
  if (folderResult.status === 'rejected') {
    console.error(
      'frontend:DocumentTemplatesPage — getDocumentTemplatesFolder failed:',
      folderResult.reason instanceof Error
        ? folderResult.reason.message
        : folderResult.reason,
    );
  }
  if (filesystemResult.status === 'rejected') {
    console.error(
      'frontend:DocumentTemplatesPage — getCompanyFilesystem failed:',
      filesystemResult.reason instanceof Error
        ? filesystemResult.reason.message
        : filesystemResult.reason,
    );
  }

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
