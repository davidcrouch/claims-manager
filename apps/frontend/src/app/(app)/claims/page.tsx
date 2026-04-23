import { redirect } from 'next/navigation';
import { getServerApiClient } from '@/lib/server-api';
import { ClaimsListClient } from '@/components/claims/ClaimsListClient';
import {
  buildClaimsListFetchKeyFromPageParams,
  normalizeSortParam,
} from '@/components/claims/claims-list-helpers';
import type { Claim, PaginatedResponse } from '@/types/api';

/** Lookup domain for claim lifecycle status values (tenant-specific). */
const CLAIM_STATUS_LOOKUP_DOMAIN = 'claim_status';

export default async function ClaimsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; search?: string; sort?: string; status?: string }>;
}) {
  const api = await getServerApiClient();
  if (!api) {
    redirect('/api/auth/login');
  }

  const params = await searchParams;
  const sort = normalizeSortParam(params.sort ?? null);

  const emptyClaims: PaginatedResponse<Claim> = { data: [], total: 0 };

  const [initialClaims, statusLookups] = await Promise.all([
    api
      .getClaims({
        page: parseInt(params.page ?? '1', 10),
        limit: 20,
        search: params.search,
        sort,
        status: params.status,
      })
      .catch((err: unknown) => {
        console.error(
          'frontend:ClaimsPage - getClaims failed:',
          err instanceof Error ? err.message : err,
        );
        return emptyClaims;
      }),
    api.getLookupsByDomain(CLAIM_STATUS_LOOKUP_DOMAIN).catch(() => []),
  ]);

  const statusOptions = (Array.isArray(statusLookups) ? statusLookups : []).map(
    (row) => ({
      id: row.id,
      name: row.name?.trim() ? row.name : 'Unknown',
    })
  );

  const initialFetchKey = buildClaimsListFetchKeyFromPageParams(params);

  return (
    <ClaimsListClient
      initialData={initialClaims}
      initialFetchKey={initialFetchKey}
      statusOptions={statusOptions}
    />
  );
}
