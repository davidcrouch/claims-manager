import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { getServerApiClient } from '@/lib/server-api';
import { ClaimsListClient } from '@/components/claims/ClaimsListClient';
import {
  buildClaimsListFetchKeyFromPageParams,
  isClaimsMineTab,
  normalizeSortParam,
  parseClaimsListTab,
  resolveClaimsListStatusParam,
} from '@/components/claims/claims-list-helpers';
import type { Claim, PaginatedResponse } from '@/types/api';

/** Lookup domain for claim lifecycle status values (tenant-specific). */
const CLAIM_STATUS_LOOKUP_DOMAIN = 'claim_status';
/** Lookup domain for insurer/account values. */
const CLAIM_ACCOUNT_LOOKUP_DOMAIN = 'account';

export default async function ClaimsPage({
  searchParams,
}: {
  searchParams: Promise<{
    page?: string;
    search?: string;
    sort?: string;
    status?: string;
    account?: string;
    jobType?: string;
    tab?: string;
    archiveState?: string;
    assignedToUserId?: string;
  }>;
}) {
  const api = await getServerApiClient();
  if (!api) {
    redirect('/api/auth/login');
  }

  const params = await searchParams;
  const sort = normalizeSortParam(params.sort ?? null);
  const tab = parseClaimsListTab(params.tab ?? null);

  const emptyClaims: PaginatedResponse<Claim> = { data: [], total: 0 };

  const [statusLookups, accountLookups, jobTypesDirect, jobTypesCw, jobTypesAll, orgUsers, session] =
    await Promise.all([
      api.getLookupsByDomain(CLAIM_STATUS_LOOKUP_DOMAIN).catch(() => []),
      api.getLookupsByDomain(CLAIM_ACCOUNT_LOOKUP_DOMAIN).catch(() => []),
      api.getLookupsByDomain('job_type', { providerCode: 'direct' }).catch(() => []),
      api.getLookupsByDomain('job_type', { providerCode: 'crunchwork' }).catch(() => []),
      api.getLookupsByDomain('job_type').catch(() => []),
      api.listOrgUsersForSelect().catch((err: unknown) => {
        console.error(
          'frontend:ClaimsPage - listOrgUsersForSelect failed:',
          err instanceof Error ? err.message : err,
        );
        return [] as { id: string; email?: string }[];
      }),
      getSession(),
    ]);

  const email = session.identity?.email?.trim().toLowerCase();
  const sub = session.identity?.sub;
  const currentUserId =
    orgUsers.find((u) => email && u.email?.trim().toLowerCase() === email)?.id ??
    (sub && orgUsers.some((u) => u.id === sub) ? sub : null);

  const effectiveTab =
    tab === 'active' && params.assignedToUserId && params.assignedToUserId === currentUserId
      ? 'mine'
      : tab;
  const mineTab = isClaimsMineTab(effectiveTab);

  const statusOptions = (Array.isArray(statusLookups) ? statusLookups : []).map(
    (row) => ({
      id: row.id,
      name: row.name?.trim() ? row.name : 'Unknown',
    }),
  );

  const accountOptions = (Array.isArray(accountLookups) ? accountLookups : []).map(
    (row) => ({
      id: row.id,
      name: row.name?.trim() ? row.name : 'Unknown',
    }),
  );

  const jobTypeById = new Map<string, { id: string; name?: string }>();
  for (const row of [
    ...(Array.isArray(jobTypesDirect) ? jobTypesDirect : []),
    ...(Array.isArray(jobTypesCw) ? jobTypesCw : []),
    ...(Array.isArray(jobTypesAll) ? jobTypesAll : []),
  ]) {
    if (!row?.id || jobTypeById.has(row.id)) continue;
    jobTypeById.set(row.id, row);
  }
  const jobTypes = [...jobTypeById.values()].map((row) => ({
    id: row.id,
    name: row.name?.trim() ? row.name : 'Unknown',
  }));

  const resolvedStatus = resolveClaimsListStatusParam({
    tab: effectiveTab,
    statusOptions,
    explicitStatus: params.status,
    archiveState: mineTab ? params.archiveState : undefined,
  });

  const initialAssignedToUserId = mineTab && currentUserId ? currentUserId : undefined;

  const initialClaims = await api
    .getClaims({
      page: parseInt(params.page ?? '1', 10),
      limit: 20,
      search: params.search,
      sort,
      status: resolvedStatus,
      account: params.account,
      jobType: params.jobType,
      assignedToUserId: initialAssignedToUserId,
    })
    .catch((err: unknown) => {
      console.error(
        'frontend:ClaimsPage - getClaims failed:',
        err instanceof Error ? err.message : err,
      );
      return emptyClaims;
    });

  const initialFetchKey = buildClaimsListFetchKeyFromPageParams({
    ...params,
    tab: effectiveTab,
    status: resolvedStatus,
    account: params.account,
    jobType: params.jobType,
    assignedToUserId: initialAssignedToUserId,
    archiveState: mineTab ? params.archiveState : undefined,
  });

  return (
    <ClaimsListClient
      initialData={initialClaims}
      initialFetchKey={initialFetchKey}
      statusOptions={statusOptions}
      accountOptions={accountOptions}
      jobTypes={jobTypes}
      currentUserId={currentUserId}
    />
  );
}
