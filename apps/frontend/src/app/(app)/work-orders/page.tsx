import { redirect } from 'next/navigation';
import { getServerApiClient } from '@/lib/server-api';
import { WorkOrdersListClient } from '@/components/work-orders/WorkOrdersListClient';
import type { PaginatedResponse, WorkOrder } from '@/types/api';

export const metadata = { title: 'Work Orders — EnsureOS' };

export default async function WorkOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const api = await getServerApiClient();
  if (!api) redirect('/api/auth/login');

  const params = await searchParams;
  const empty: PaginatedResponse<WorkOrder> = { data: [], total: 0 };
  const [initialData, statusLookupsRes] = await Promise.all([
    api
      .getWorkOrders({
        page: parseInt(params.page ?? '1', 10),
        limit: 20,
      })
      .catch((err: unknown) => {
        console.error(
          'frontend:WorkOrdersPage - getWorkOrders failed:',
          err instanceof Error ? err.message : err,
        );
        return empty;
      }),
    api.getLookupsByDomain('work_order_status').catch(() => []),
  ]);

  const statusOptions = (Array.isArray(statusLookupsRes) ? statusLookupsRes : []).map(
    (row) => ({
      id: row.id,
      name: row.name?.trim() ? row.name : 'Unknown',
    }),
  );

  return (
    <WorkOrdersListClient
      initialData={initialData}
      statusOptions={statusOptions}
    />
  );
}
