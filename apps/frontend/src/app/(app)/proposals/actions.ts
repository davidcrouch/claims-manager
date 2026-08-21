'use server';

import { getSession, getAccessToken } from '@/lib/auth';
import { createApiClient } from '@/lib/api-client';
import type { PaginatedResponse, Proposal, LineItemsPageQuery } from '@/types/api';

export async function fetchProposalsAction(params?: {
  page?: number;
  limit?: number;
  jobId?: string;
  jobIds?: string[];
  rfqId?: string;
  status?: string;
  vendorId?: string;
  search?: string;
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
      jobIds: params?.jobIds,
      rfqId: params?.rfqId,
      status: params?.status,
      vendorId: params?.vendorId,
      search: params?.search,
      sort: params?.sort,
    });
  } catch (err) {
    console.error('[proposals/actions.fetchProposalsAction]', err);
    return { data: [], total: 0 };
  }
}

export async function getProposalLineItemsAction(
  proposalId: string,
  query?: LineItemsPageQuery,
): Promise<{
  success: boolean;
  groups?: Array<Record<string, unknown>>;
  total?: number;
  page?: number;
  limit?: number;
  groupSummaries?: Array<{ id: string; label: string }>;
  error?: string;
}> {
  const PREFIX = 'proposals/actions.getProposalLineItemsAction';
  const session = await getSession();
  if (!session.authenticated) return { success: false, error: 'Not authenticated' };

  const token = await getAccessToken();
  if (!token) return { success: false, error: 'Not authenticated' };

  const api = createApiClient({ token });
  try {
    const page = await api.getProposalLineItems(proposalId, query);
    return {
      success: true,
      groups: page.groups,
      total: page.total,
      page: page.page,
      limit: page.limit,
      groupSummaries: page.groupSummaries,
    };
  } catch (err) {
    console.error(`[${PREFIX}]`, err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to load line items',
    };
  }
}
