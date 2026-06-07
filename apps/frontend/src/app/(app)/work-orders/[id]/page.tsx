import { redirect, notFound } from 'next/navigation';
import { getServerApiClient } from '@/lib/server-api';
import { SetPageHeader } from '@/components/layout/SetPageHeader';
import {
  WorkOrderDetail,
  WorkOrderPageHeader,
} from '@/components/work-orders/WorkOrderDetail';
import type { Metadata } from 'next';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const api = await getServerApiClient();
  if (!api) return { title: 'Work Order | EnsureOS' };

  const wo = await api.getWorkOrder(id).catch(() => null);
  const title = wo?.workOrderNumber ?? wo?.externalId ?? id;
  return { title: `${title} | EnsureOS` };
}

export default async function WorkOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const api = await getServerApiClient();
  if (!api) redirect('/api/auth/login');

  const wo = await api.getWorkOrder(id).catch((err: unknown) => {
    console.error(
      'frontend:WorkOrderDetailPage - getWorkOrder failed:',
      err instanceof Error ? err.message : err,
    );
    return null;
  });
  if (!wo) notFound();

  return (
    <>
      <SetPageHeader>
        <WorkOrderPageHeader wo={wo} />
      </SetPageHeader>
      <WorkOrderDetail wo={wo} />
    </>
  );
}
