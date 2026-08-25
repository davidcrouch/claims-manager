import { redirect } from 'next/navigation';
import { getServerApiClient } from '@/lib/server-api';
import { ClaimsListClient } from '@/components/claims/ClaimsListClient';
import {
  buildClaimsListFetchKeyFromPageParams,
  normalizeSortParam,
} from '@/components/claims/claims-list-helpers';
import { isArchivedStatus } from '@/components/shared/list-filters';
import type { Claim, PaginatedResponse } from '@/types/api';

/** Lookup domain for claim lifecycle status values (tenant-specific). */
const CLAIM_STATUS_LOOKUP_DOMAIN = 'claim_status';
/** Lookup domain for insurer/account values. */
const CLAIM_ACCOUNT_LOOKUP_DOMAIN = 'account';

type ClaimTab = 'active' | 'archived' | 'all';
const VALID_TABS = new Set<ClaimTab>(['active', 'archived', 'all']);

function resolveStatusForTab(
  tab: ClaimTab,
  explicitStatus: string | undefined,
  statusOptions: { id: string; name: string }[],
): string | undefined {
  if (explicitStatus) return explicitStatus;
  if (tab === 'all') return undefined;
  const archivedIds: string[] = [];
  const activeIds: string[] = [];
  for (const opt of statusOptions) {
    if (isArchivedStatus(opt.name)) {
      archivedIds.push(opt.id);
    } else {
      activeIds.push(opt.id);
    }
  }
  const ids = tab === 'archived' ? archivedIds : activeIds;
  return ids.length ? ids.sort().join(',') : undefined;
}

export default async function ClaimsPage({
  searchParams,
}: {
  searchParams: Promise<{
    page?: string;
    search?: string;
    sort?: string;
    status?: string;
    account?: string;
    tab?: string;
  }>;
}) {
  const api = await getServerApiClient();
  if (!api) {
    redirect('/api/auth/login');
  }

  const params = await searchParams;
  const sort = normalizeSortParam(params.sort ?? null);
  const tab: ClaimTab = params.tab && VALID_TABS.has(params.tab as ClaimTab)
    ? (params.tab as ClaimTab)
    : 'active';

  const emptyClaims: PaginatedResponse<Claim> = { data: [], total: 0 };

  const [statusLookups, accountLookups] = await Promise.all([
    api.getLookupsByDomain(CLAIM_STATUS_LOOKUP_DOMAIN).catch(() => []),
    api.getLookupsByDomain(CLAIM_ACCOUNT_LOOKUP_DOMAIN).catch(() => []),
  ]);

  const statusOptions = (Array.isArray(statusLookups) ? statusLookups : []).map(
    (row) => ({
      id: row.id,
      name: row.name?.trim() ? row.name : 'Unknown',
    })
  );

  const accountOptions = (Array.isArray(accountLookups) ? accountLookups : []).map(
    (row) => ({
      id: row.id,
      name: row.name?.trim() ? row.name : 'Unknown',
    })
  );

  const resolvedStatus = resolveStatusForTab(tab, params.status, statusOptions);

  const initialClaims = await api
    .getClaims({
      page: parseInt(params.page ?? '1', 10),
      limit: 20,
      search: params.search,
      sort,
      status: resolvedStatus,
      account: params.account,
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
    tab,
    status: resolvedStatus,
    account: params.account,
  });

  return (
    <ClaimsListClient
      initialData={initialClaims}
      initialFetchKey={initialFetchKey}
      statusOptions={statusOptions}
      accountOptions={accountOptions}
    />
  );
}
