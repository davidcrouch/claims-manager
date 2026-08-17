'use server';

import { getSession, getAccessToken } from '@/lib/auth';
import { createApiClient, ApiError } from '@/lib/api-client';
import type { Attachment } from '@/types/api';

export interface PhaseGatedAttachmentResult {
  data: Attachment[];
  phaseUnavailable: boolean;
  error?: string;
}

function isNotImplemented(err: unknown): boolean {
  if (err instanceof ApiError) {
    return err.status === 404 || err.status === 501;
  }
  return false;
}

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

export async function fetchEntityAttachmentsAction(
  relatedRecordType: string,
  entityId: string,
): Promise<PhaseGatedAttachmentResult> {
  const api = await getApi();
  if (!api) return { data: [], phaseUnavailable: false, error: 'Not authenticated' };
  try {
    const data = await api.getEntityAttachments(relatedRecordType, entityId);
    return { data: data ?? [], phaseUnavailable: false };
  } catch (err) {
    if (isNotImplemented(err)) {
      return { data: [], phaseUnavailable: true };
    }
    console.error('[attachments/actions.fetchEntityAttachmentsAction]', err);
    return {
      data: [],
      phaseUnavailable: false,
      error: err instanceof Error ? err.message : 'Failed to load attachments',
    };
  }
}
