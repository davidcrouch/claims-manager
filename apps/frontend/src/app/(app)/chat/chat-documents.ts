'use server';

import { getSession, getAccessToken } from '@/lib/auth';
import { createApiClient } from '@/lib/api-client';

async function getApi() {
  const session = await getSession();
  if (!session.authenticated) return null;
  const token = await getAccessToken();
  if (!token) return null;
  const tenantId =
    session.identity?.organization_id ??
    process.env.NEXT_PUBLIC_DEFAULT_TENANT_ID ??
    undefined;
  return createApiClient({ token, tenantId });
}

export async function listRelatedDocumentsForChat(
  relatedRecordType: string,
  relatedRecordId: string,
): Promise<Array<{ id: string; fileName: string | null; mimeType: string | null }>> {
  const api = await getApi();
  if (!api) return [];
  try {
    const result = await api.getDocuments({
      relatedRecordType,
      relatedRecordId,
      uploadStatus: 'complete',
      limit: 100,
    });
    return result.data.map((row) => ({
      id: row.id,
      fileName: row.fileName,
      mimeType: row.mimeType,
    }));
  } catch (err) {
    console.error('[chat/chat-documents.listRelatedDocumentsForChat]', err);
    return [];
  }
}

export async function getDocumentReadUrlForChat(documentId: string): Promise<{
  uri: string;
  signedUrl: string;
  mimeType: string;
  fileName: string;
} | null> {
  const api = await getApi();
  if (!api) return null;
  try {
    const [doc, download] = await Promise.all([
      api.getDocument(documentId),
      api.getDocumentDownloadUrl(documentId),
    ]);
    const uri =
      doc.uri ??
      (doc.gcsBucket && doc.gcsObjectPath
        ? `gs://${doc.gcsBucket}/${doc.gcsObjectPath}`
        : download.downloadUrl);
    return {
      uri,
      signedUrl: download.downloadUrl,
      mimeType: doc.mimeType,
      fileName: doc.fileName,
    };
  } catch (err) {
    console.error('[chat/chat-documents.getDocumentReadUrlForChat]', err);
    return null;
  }
}
