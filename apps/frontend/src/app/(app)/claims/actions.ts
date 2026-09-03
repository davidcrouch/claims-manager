'use server';

import { getSession, getAccessToken } from '@/lib/auth';
import { createApiClient } from '@/lib/api-client';
import {
  buildClaimsListFetchKey,
  DEFAULT_CLAIMS_SORT,
} from '@/components/claims/claims-list-helpers';
import { statusIdsForArchiveListTab } from '@/components/shared/archive-list';
import type { PaginatedResponse } from '@/types/api';
import type { Claim } from '@/types/api';

const CLAIM_STATUS_LOOKUP_DOMAIN = 'claim_status';
const CLAIM_ACCOUNT_LOOKUP_DOMAIN = 'account';

export async function fetchClaimsAction(params: {
  page?: number;
  limit?: number;
  search?: string;
  sort?: string;
  status?: string;
  account?: string;
  jobType?: string;
  assignedToUserId?: string;
}): Promise<PaginatedResponse<Claim> | null> {
  const session = await getSession();
  if (!session.authenticated) return null;

  const token = await getAccessToken();
  if (!token) return null;

  const api = createApiClient({ token });
  return api.getClaims({
    page: params.page ?? 1,
    limit: params.limit ?? 20,
    search: params.search,
    sort: params.sort,
    status: params.status,
    account: params.account,
    jobType: params.jobType,
    assignedToUserId: params.assignedToUserId,
  });
}

export async function fetchClaimsPickerBootstrapAction(): Promise<{
  claims: PaginatedResponse<Claim>;
  statusOptions: { id: string; name: string }[];
  accountOptions: { id: string; name: string }[];
  jobTypes: { id: string; name: string }[];
  currentUserId: string | null;
  initialFetchKey?: string;
} | null> {
  const session = await getSession();
  if (!session.authenticated) return null;

  const token = await getAccessToken();
  if (!token) return null;

  const api = createApiClient({ token });
  const emptyClaims: PaginatedResponse<Claim> = { data: [], total: 0 };

  const [statusLookupsRes, accountLookupsRes, jobTypesAllRes, orgUsers] =
    await Promise.all([
      api.getLookupsByDomain(CLAIM_STATUS_LOOKUP_DOMAIN).catch((err: unknown) => {
        console.error(
          'frontend:fetchClaimsPickerBootstrapAction - claim_status lookups failed:',
          err instanceof Error ? err.message : err,
        );
        return [];
      }),
      api.getLookupsByDomain(CLAIM_ACCOUNT_LOOKUP_DOMAIN).catch((err: unknown) => {
        console.error(
          'frontend:fetchClaimsPickerBootstrapAction - account lookups failed:',
          err instanceof Error ? err.message : err,
        );
        return [];
      }),
      api.getLookupsByDomain('job_type').catch((err: unknown) => {
        console.error(
          'frontend:fetchClaimsPickerBootstrapAction - job_type lookups failed:',
          err instanceof Error ? err.message : err,
        );
        return [];
      }),
      api.listOrgUsersForSelect().catch((err: unknown) => {
        console.error(
          'frontend:fetchClaimsPickerBootstrapAction - listOrgUsersForSelect failed:',
          err instanceof Error ? err.message : err,
        );
        return [] as { id: string; email?: string }[];
      }),
    ]);

  const statusOptions = (Array.isArray(statusLookupsRes) ? statusLookupsRes : []).map(
    (row) => ({
      id: row.id,
      name: row.name?.trim() ? row.name : 'Unknown',
    }),
  );
  const accountOptions = (Array.isArray(accountLookupsRes) ? accountLookupsRes : []).map(
    (row) => ({
      id: row.id,
      name: row.name?.trim() ? row.name : 'Unknown',
    }),
  );
  const jobTypes = (Array.isArray(jobTypesAllRes) ? jobTypesAllRes : []).map((row) => ({
    id: row.id,
    name: row.name?.trim() ? row.name.trim() : 'Unknown',
  }));

  const email = session.identity?.email?.trim().toLowerCase();
  const sub = session.identity?.sub;
  const currentUserId =
    orgUsers.find((u) => email && u.email?.trim().toLowerCase() === email)?.id ??
    (sub && orgUsers.some((u) => u.id === sub) ? sub : null);

  const activeStatus = statusIdsForArchiveListTab('active', statusOptions);
  const initialFetchKey = buildClaimsListFetchKey({
    sort: DEFAULT_CLAIMS_SORT,
    tab: 'active',
    page: 1,
    status: activeStatus,
  });

  let claimsSsrOk = false;
  const claims = await api
    .getClaims({
      page: 1,
      limit: 20,
      sort: DEFAULT_CLAIMS_SORT,
      status: activeStatus ?? undefined,
    })
    .then((data) => {
      claimsSsrOk = true;
      return data;
    })
    .catch((err: unknown) => {
      console.error(
        'frontend:fetchClaimsPickerBootstrapAction - getClaims failed:',
        err instanceof Error ? err.message : err,
      );
      return emptyClaims;
    });

  return {
    claims,
    statusOptions,
    accountOptions,
    jobTypes,
    currentUserId,
    initialFetchKey: claimsSsrOk ? initialFetchKey : undefined,
  };
}
