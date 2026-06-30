'use server';

import { getSession, getAccessToken } from '@/lib/auth';
import { createApiClient } from '@/lib/api-client';
import type { PaginatedResponse, Attachment } from '@/types/api';

async function getApi() {
  const session = await getSession();
  if (!session.authenticated) return null;
  const token = await getAccessToken();
  if (!token) return null;
  const tenantId =
    session.identity?.organization_id ?? process.env.NEXT_PUBLIC_DEFAULT_TENANT_ID ?? undefined;
  return createApiClient({ token, tenantId });
}

export async function fetchDocumentsAction(params: {
  page?: number;
  limit?: number;
  search?: string;
  sort?: string;
}): Promise<PaginatedResponse<Attachment> | null> {
  const api = await getApi();
  if (!api) return null;
  return api.getAttachments({
    page: params.page ?? 1,
    limit: params.limit ?? 20,
    search: params.search,
    sort: params.sort,
  });
}
