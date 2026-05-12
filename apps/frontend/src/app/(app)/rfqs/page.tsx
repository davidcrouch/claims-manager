import { redirect } from 'next/navigation';
import { getServerApiClient } from '@/lib/server-api';
import { RfqsListClient } from '@/components/rfqs/RfqsListClient';
import type { PaginatedResponse, Rfq } from '@/types/api';

export const metadata = { title: 'RFQs — EnsureOS' };

export default async function RfqsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const api = await getServerApiClient();
  if (!api) redirect('/api/auth/login');

  const params = await searchParams;
  const empty: PaginatedResponse<Rfq> = { data: [], total: 0 };
  const [initialData, statusLookupsRes] = await Promise.all([
    api
      .getRfqs({
        page: parseInt(params.page ?? '1', 10),
        limit: 20,
      })
      .catch((err: unknown) => {
        console.error(
          'frontend:RfqsPage - getRfqs failed:',
          err instanceof Error ? err.message : err,
        );
        return empty;
      }),
    api.getLookupsByDomain('rfq_status').catch(() => []),
  ]);

  const statusOptions = (Array.isArray(statusLookupsRes) ? statusLookupsRes : []).map(
    (row) => ({
      id: row.id,
      name: row.name?.trim() ? row.name : 'Unknown',
    }),
  );

  return (
    <RfqsListClient
      initialData={initialData}
      statusOptions={statusOptions}
    />
  );
}
