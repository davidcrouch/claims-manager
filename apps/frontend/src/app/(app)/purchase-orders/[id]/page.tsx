import { redirect, notFound } from 'next/navigation';
import { getServerApiClient } from '@/lib/server-api';
import { SetBreadcrumbs } from '@/components/layout/SetBreadcrumbs';
import { PurchaseOrderDetail } from '@/components/purchase-orders/PurchaseOrderDetail';
import type { Metadata } from 'next';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const api = await getServerApiClient();
  if (!api) return { title: 'Purchase Order | EnsureOS' };

  const po = await api.getPurchaseOrder(id).catch(() => null);
  const title = po?.purchaseOrderNumber ?? po?.externalId ?? id;
  return { title: `${title} | EnsureOS` };
}

export default async function PurchaseOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const api = await getServerApiClient();
  if (!api) redirect('/api/auth/login');

  const po = await api.getPurchaseOrder(id).catch((err: unknown) => {
    console.error(
      'frontend:PurchaseOrderDetailPage - getPurchaseOrder failed:',
      err instanceof Error ? err.message : err,
    );
    return null;
  });
  if (!po) notFound();

  const title = po.purchaseOrderNumber ?? po.externalId ?? id;

  return (
    <>
      <SetBreadcrumbs
        items={[
          { title: 'Purchase Orders', href: '/purchase-orders' },
          { title, href: `/purchase-orders/${id}` },
        ]}
      />
      <PurchaseOrderDetail po={po} />
    </>
  );
}
