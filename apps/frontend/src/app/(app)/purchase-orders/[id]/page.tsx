import { getSession, getAccessToken } from '@/lib/auth';
import { redirect, notFound } from 'next/navigation';
import { createApiClient } from '@/lib/api-client';
import { SetBreadcrumbs } from '@/components/layout/SetBreadcrumbs';
import { PurchaseOrderDetail } from '@/components/purchase-orders/PurchaseOrderDetail';
import type { Metadata } from 'next';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const session = await getSession();
  if (!session.authenticated) return { title: 'Purchase Order | Claims Manager' };

  const token = await getAccessToken();
  if (!token) return { title: 'Purchase Order | Claims Manager' };

  const api = createApiClient({ token });
  const po = await api.getPurchaseOrder(id);
  const title = po?.purchaseOrderNumber ?? po?.externalId ?? id;
  return { title: `${title} | Claims Manager` };
}

export default async function PurchaseOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getSession();
  if (!session.authenticated) redirect('/api/auth/login');

  const token = await getAccessToken();
  if (!token) redirect('/api/auth/login');

  const api = createApiClient({ token });
  const po = await api.getPurchaseOrder(id);
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
