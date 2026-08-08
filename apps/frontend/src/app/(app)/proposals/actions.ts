'use server';

import { getSession, getAccessToken } from '@/lib/auth';
import { createApiClient } from '@/lib/api-client';
import type { PaginatedResponse, Proposal } from '@/types/api';

export async function fetchProposalsAction(params?: {
  page?: number;
  limit?: number;
  jobId?: string;
  rfqId?: string;
  status?: string;
  vendorId?: string;
  sort?: string;
}): Promise<PaginatedResponse<Proposal>> {
  const session = await getSession();
  if (!session.authenticated) return { data: [], total: 0 };

  const token = await getAccessToken();
  if (!token) return { data: [], total: 0 };

  const api = createApiClient({ token });
  try {
    return await api.getProposals({
      page: params?.page ?? 1,
      limit: params?.limit ?? 20,
      jobId: params?.jobId,
      rfqId: params?.rfqId,
      status: params?.status,
      vendorId: params?.vendorId,
      sort: params?.sort,
    });
  } catch (err) {
    console.error('[proposals/actions.fetchProposalsAction]', err);
    return { data: [], total: 0 };
  }
}

export async function getProposalLineItemsAction(proposalId: string): Promise<{
  success: boolean;
  groups?: Array<Record<string, unknown>>;
  error?: string;
}> {
  const session = await getSession();
  if (!session.authenticated) return { success: false, error: 'Not authenticated' };

  const token = await getAccessToken();
  if (!token) return { success: false, error: 'Not authenticated' };

  const api = createApiClient({ token });
  try {
    const groups = await api.getProposalLineItems(proposalId);
    return { success: true, groups };
  } catch (err) {
    console.error('[proposals/actions.getProposalLineItemsAction]', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to load line items',
    };
  }
}
