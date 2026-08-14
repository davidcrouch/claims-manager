import { redirect, notFound } from 'next/navigation';
import { getServerApiClient } from '@/lib/server-api';
import { DocumentTemplateDetailClient } from '@/components/document-templates/DocumentTemplateDetailClient';
import type { DocumentTemplatesFolderSetting, FSDocument } from '@/lib/api-client';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ documentType: string }>;
}) {
  const api = await getServerApiClient();
  if (!api) return { title: 'Document Template — EnsureOS' };
  const { documentType } = await params;
  const settings = await api.getDocumentTemplateSettings().catch(() => []);
  const setting = settings.find((row) => row.documentType === documentType);
  return {
    title: setting
      ? `${setting.label} — Document Templates — EnsureOS`
      : 'Document Template — EnsureOS',
  };
}

const DOCX_MIME =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

function isDocx(doc: FSDocument): boolean {
  return (
    doc.mimeType === DOCX_MIME ||
    doc.fileName.toLowerCase().endsWith('.docx')
  );
}

export default async function DocumentTemplateDetailPage({
  params,
}: {
  params: Promise<{ documentType: string }>;
}) {
  const api = await getServerApiClient();
  if (!api) {
    redirect('/api/auth/login');
  }

  const { documentType } = await params;

  const [settingsResult, documentsResult, folderResult, filesystemResult] =
    await Promise.allSettled([
      api.getDocumentTemplateSettings(),
      api.getDocuments({ uploadStatus: 'complete', limit: 200, sort: 'name' }),
      api.getDocumentTemplatesFolder(),
      api.getCompanyFilesystem(),
    ]);

  const settings =
    settingsResult.status === 'fulfilled' ? settingsResult.value : [];
  const setting = settings.find((row) => row.documentType === documentType);
  if (!setting) {
    notFound();
  }

  const allDocs =
    documentsResult.status === 'fulfilled' ? documentsResult.value.data : [];
  const docxDocuments = allDocs.filter(isDocx);
  const folderValue =
    folderResult.status === 'fulfilled' ? folderResult.value : null;
  const folderSetting: DocumentTemplatesFolderSetting = {
    filesystemCategoryId: folderValue?.filesystemCategoryId ?? null,
    folder: folderValue?.folder ?? null,
  };
  const companyFilesystem =
    filesystemResult.status === 'fulfilled' ? filesystemResult.value : null;
  const companyCategories = companyFilesystem?.categories ?? [];

  return (
    <DocumentTemplateDetailClient
      setting={setting}
      docxDocuments={docxDocuments}
      companyCategories={companyCategories}
      folderSetting={folderSetting}
    />
  );
}
