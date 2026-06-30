import { redirect } from 'next/navigation';
import { getServerApiClient } from '@/lib/server-api';
import { BillsListClient } from '@/components/bills/BillsListClient';
import type { PaginatedResponse, Bill } from '@/types/api';

export const metadata = { title: 'Bills — EnsureOS' };

export default async function BillsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; sort?: string }>;
}) {
  const api = await getServerApiClient();
  if (!api) redirect('/api/auth/login');

  const params = await searchParams;
  const empty: PaginatedResponse<Bill> = { data: [], total: 0 };
  const [initialData, statusLookupsRes] = await Promise.all([
    api
      .getBills({
        page: parseInt(params.page ?? '1', 10),
        limit: 20,
        sort: params.sort,
      })
      .catch((err: unknown) => {
        console.error(
          'frontend:BillsPage - getBills failed:',
          err instanceof Error ? err.message : err,
        );
        return empty;
      }),
    api.getLookupsByDomain('bill_status').catch(() => []),
  ]);

  const statusOptions = (Array.isArray(statusLookupsRes) ? statusLookupsRes : []).map(
    (row) => ({
      id: row.id,
      name: row.name?.trim() ? row.name : 'Unknown',
    }),
  );

  return (
    <BillsListClient
      initialData={initialData}
      statusOptions={statusOptions}
    />
  );
}
