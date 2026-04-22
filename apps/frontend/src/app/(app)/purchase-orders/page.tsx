import { redirect } from 'next/navigation';
import { getServerApiClient } from '@/lib/server-api';
import { SetBreadcrumbs } from '@/components/layout/SetBreadcrumbs';
import { PurchaseOrdersListClient } from '@/components/purchase-orders/PurchaseOrdersListClient';
import type { PaginatedResponse, PurchaseOrder } from '@/types/api';

export default async function PurchaseOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; jobId?: string }>;
}) {
  const api = await getServerApiClient();
  if (!api) redirect('/api/auth/login');

  const params = await searchParams;
  const empty: PaginatedResponse<PurchaseOrder> = { data: [], total: 0 };
  const [initialPOs, statusLookupsRes] = await Promise.all([
    api
      .getPurchaseOrders({
        page: parseInt(params.page ?? '1', 10),
        limit: 20,
        jobId: params.jobId,
      })
      .catch((err: unknown) => {
        console.error(
          'frontend:PurchaseOrdersPage - getPurchaseOrders failed:',
          err instanceof Error ? err.message : err,
        );
        return empty;
      }),
    api.getLookupsByDomain('po_status').catch(() => []),
  ]);

  const statusOptions = (Array.isArray(statusLookupsRes) ? statusLookupsRes : []).map(
    (row) => ({
      id: row.id,
      name: row.name?.trim() ? row.name : 'Unknown',
    }),
  );

  return (
    <>
      <SetBreadcrumbs items={[{ title: 'Purchase Orders', href: '/purchase-orders' }]} />
      <PurchaseOrdersListClient
        initialData={initialPOs}
        statusOptions={statusOptions}
      />
    </>
  );
}
