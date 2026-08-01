'use server';

import { getSession, getAccessToken } from '@/lib/auth';
import { createApiClient } from '@/lib/api-client';

async function getApi() {
  const session = await getSession();
  if (!session.authenticated) return null;
  const token = await getAccessToken();
  if (!token) return null;
  const tenantId =
    session.identity?.organization_id ?? process.env.NEXT_PUBLIC_DEFAULT_TENANT_ID ?? undefined;
  return createApiClient({ token, tenantId });
}

export async function assignCategoryAction(documentId: string, categoryId: string | null) {
  const api = await getApi();
  if (!api) throw new Error('Unauthorized');
  return api.assignDocumentCategory(documentId, categoryId);
}

export async function bulkAssignCategoryAction(documentIds: string[], categoryId: string | null) {
  const api = await getApi();
  if (!api) throw new Error('Unauthorized');
  return api.bulkAssignCategory(documentIds, categoryId);
}

export async function archiveDocumentAction(documentId: string) {
  const api = await getApi();
  if (!api) throw new Error('Unauthorized');
  return api.archiveDocument(documentId);
}

export async function deleteDocumentAction(documentId: string) {
  const api = await getApi();
  if (!api) throw new Error('Unauthorized');
  return api.deleteDocument(documentId);
}
