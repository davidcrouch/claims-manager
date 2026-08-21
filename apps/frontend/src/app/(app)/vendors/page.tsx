import { redirect } from 'next/navigation';
import { getServerApiClient } from '@/lib/server-api';
import { VendorsListClient } from '@/components/vendors/VendorsListClient';
import type { PaginatedResponse, Vendor } from '@/types/api';

export default async function VendorsPage({
  searchParams,
}: {
  searchParams: Promise<{
    page?: string;
    search?: string;
    sort?: string;
    link?: string;
  }>;
}) {
  const api = await getServerApiClient();
  if (!api) redirect('/api/auth/login');

  const params = await searchParams;
  const empty: PaginatedResponse<Vendor> = { data: [], total: 0 };
  const linkIds = (params.link ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const linked =
    linkIds.length === 1
      ? linkIds[0] === 'linked'
        ? true
        : linkIds[0] === 'unlinked'
          ? false
          : undefined
      : undefined;

  const vendorsRes = await api
    .getVendors({
      page: parseInt(params.page ?? '1', 10),
      limit: 20,
      search: params.search,
      sort: params.sort,
      linked,
    })
    .catch((err: unknown) => {
      console.error(
        'frontend:VendorsPage - getVendors failed:',
        err instanceof Error ? err.message : err,
      );
      return empty;
    });

  return <VendorsListClient initialData={vendorsRes ?? empty} />;
}
