import { redirect } from 'next/navigation';
import { getServerApiClient } from '@/lib/server-api';
import { SetBreadcrumbs } from '@/components/layout/SetBreadcrumbs';
import { InvoicesPageClient } from '@/components/invoices/InvoicesPageClient';
import type { Invoice, PaginatedResponse, PurchaseOrder } from '@/types/api';

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; purchaseOrderId?: string }>;
}) {
  const api = await getServerApiClient();
  if (!api) redirect('/api/auth/login');

  const params = await searchParams;
  const emptyInvoices: PaginatedResponse<Invoice> = { data: [], total: 0 };
  const emptyPOs: PaginatedResponse<PurchaseOrder> = { data: [], total: 0 };

  const [initialInvoices, posRes] = await Promise.all([
    api
      .getInvoices({
        page: parseInt(params.page ?? '1', 10),
        limit: 20,
        purchaseOrderId: params.purchaseOrderId,
      })
      .catch((err: unknown) => {
        console.error(
          'frontend:InvoicesPage - getInvoices failed:',
          err instanceof Error ? err.message : err,
        );
        return emptyInvoices;
      }),
    api.getPurchaseOrders({ limit: 100 }).catch((err: unknown) => {
      console.error(
        'frontend:InvoicesPage - getPurchaseOrders failed:',
        err instanceof Error ? err.message : err,
      );
      return emptyPOs;
    }),
  ]);

  const purchaseOrders = posRes?.data ?? [];

  return (
    <>
      <SetBreadcrumbs items={[{ title: 'Invoices', href: '/invoices' }]} />
      <InvoicesPageClient initialData={initialInvoices} purchaseOrders={purchaseOrders} />
    </>
  );
}
