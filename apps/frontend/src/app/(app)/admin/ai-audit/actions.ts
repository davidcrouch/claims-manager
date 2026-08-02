'use server';

import { getSession, getAccessToken } from '@/lib/auth';
import { createApiClient } from '@/lib/api-client';
import type { AiAuditRecord } from '@/lib/ai/types';

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

export async function getAiAuditLogAction(
  filters: Record<string, unknown>,
): Promise<{ rows: AiAuditRecord[]; total: number }> {
  const api = await getApi();
  if (!api) return { rows: [], total: 0 };
  try {
    const result = await api.getAiAuditLog({
      userId: filters.userId as string | undefined,
      dateFrom: filters.dateFrom as string | undefined,
      dateTo: filters.dateTo as string | undefined,
      model: filters.model as string | undefined,
      status: filters.status as string | undefined,
      page: filters.page as number | undefined,
      limit: filters.limit as number | undefined,
    });
    return {
      rows: result?.rows ?? [],
      total: result?.total ?? 0,
    };
  } catch (err) {
    console.error('[admin/ai-audit/actions.getAiAuditLogAction]', err);
    return { rows: [], total: 0 };
  }
}

export async function getAiAuditDetailAction(
  id: string,
): Promise<AiAuditRecord | null> {
  const api = await getApi();
  if (!api) return null;
  try {
    return await api.getAiAuditDetail(id);
  } catch (err) {
    console.error('[admin/ai-audit/actions.getAiAuditDetailAction]', err);
    return null;
  }
}
