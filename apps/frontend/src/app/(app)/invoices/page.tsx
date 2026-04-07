import { getSession, getAccessToken } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { createApiClient } from '@/lib/api-client';
import { SetBreadcrumbs } from '@/components/layout/SetBreadcrumbs';
import { InvoicesPageClient } from '@/components/invoices/InvoicesPageClient';

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; purchaseOrderId?: string }>;
}) {
  const session = await getSession();
  if (!session.authenticated) redirect('/api/auth/login');

  const token = await getAccessToken();
  if (!token) redirect('/api/auth/login');

  const params = await searchParams;
  const api = createApiClient({ token });
  const [initialInvoices, posRes] = await Promise.all([
    api.getInvoices({
      page: parseInt(params.page ?? '1', 10),
      limit: 20,
      purchaseOrderId: params.purchaseOrderId,
    }),
    api.getPurchaseOrders({ limit: 100 }),
  ]);

  const purchaseOrders = posRes?.data ?? [];

  return (
    <>
      <SetBreadcrumbs items={[{ title: 'Invoices', href: '/invoices' }]} />
      <InvoicesPageClient initialData={initialInvoices} purchaseOrders={purchaseOrders} />
    </>
  );
}
