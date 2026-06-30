'use server';

import { getSession, getAccessToken } from '@/lib/auth';
import { createApiClient } from '@/lib/api-client';
import type { Proposal } from '@/types/api';

async function getApi() {
  const session = await getSession();
  if (!session.authenticated) return null;
  const token = await getAccessToken();
  if (!token) return null;
  return createApiClient({ token });
}

export async function fetchRfqProposalsAction(rfqId: string): Promise<Proposal[]> {
  const api = await getApi();
  if (!api) return [];
  try {
    return await api.getRfqProposals(rfqId);
  } catch (err) {
    console.error(
      'frontend:fetchRfqProposalsAction - getRfqProposals failed:',
      err instanceof Error ? err.message : err,
    );
    return [];
  }
}

export async function fetchRfqLineItemsAction(rfqId: string): Promise<{
  success: boolean;
  groups?: Array<Record<string, unknown>>;
  error?: string;
}> {
  const api = await getApi();
  if (!api) return { success: false, error: 'Not authenticated' };
  try {
    const groups = await api.getRfqLineItems(rfqId);
    return { success: true, groups };
  } catch (err) {
    console.error(
      'frontend:fetchRfqLineItemsAction - getRfqLineItems failed:',
      err instanceof Error ? err.message : err,
    );
    return { success: false, error: err instanceof Error ? err.message : 'Failed to load scope items' };
  }
}
