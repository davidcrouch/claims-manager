import { redirect } from 'next/navigation';
import { getServerApiClient } from '@/lib/server-api';
import { DocumentTemplatesSettingsPanel } from '@/components/document-templates/DocumentTemplatesSettingsPanel';
import type { FSDocument } from '@/lib/api-client';

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

  const [settingsResult, documentsResult] = await Promise.allSettled([
    api.getDocumentTemplateSettings(),
    api.getDocuments({ uploadStatus: 'complete', limit: 100, sort: 'name' }),
  ]);

  const settings =
    settingsResult.status === 'fulfilled' ? settingsResult.value : [];
  const allDocs =
    documentsResult.status === 'fulfilled' ? documentsResult.value.data : [];
  const docxDocuments = allDocs.filter(isDocx);

  return (
    <div className="flex min-h-0 flex-1 flex-col" style={{ height: '100%' }}>
      <div className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-2xl">
          <DocumentTemplatesSettingsPanel
            initialSettings={settings}
            docxDocuments={docxDocuments}
          />
        </div>
      </div>
    </div>
  );
}
