import { getSession, getAccessToken } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { createApiClient } from '@/lib/api-client';
import { SetBreadcrumbs } from '@/components/layout/SetBreadcrumbs';
import { PurchaseOrdersListClient } from '@/components/purchase-orders/PurchaseOrdersListClient';

export default async function PurchaseOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; jobId?: string }>;
}) {
  const session = await getSession();
  if (!session.authenticated) redirect('/api/auth/login');

  const token = await getAccessToken();
  if (!token) redirect('/api/auth/login');

  const params = await searchParams;
  const api = createApiClient({ token });
  const initialPOs = await api.getPurchaseOrders({
    page: parseInt(params.page ?? '1', 10),
    limit: 20,
    jobId: params.jobId,
  });

  return (
    <>
      <SetBreadcrumbs items={[{ title: 'Purchase Orders', href: '/purchase-orders' }]} />
      <PurchaseOrdersListClient initialData={initialPOs} />
    </>
  );
}
