import { redirect, notFound } from 'next/navigation';
import { getServerApiClient } from '@/lib/server-api';
import { SetPageHeader } from '@/components/layout/SetPageHeader';
import { BillDetail, BillPageHeader } from '@/components/bills/BillDetail';
import type { Metadata } from 'next';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const api = await getServerApiClient();
  if (!api) return { title: 'Bill | EnsureOS' };

  const bill = await api.getBill(id).catch(() => null);
  const title = bill?.billNumber ?? bill?.externalReference ?? id;
  return { title: `${title} | EnsureOS` };
}

export default async function BillDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const api = await getServerApiClient();
  if (!api) redirect('/api/auth/login');

  const bill = await api.getBill(id).catch((err: unknown) => {
    console.error(
      'frontend:BillDetailPage - getBill failed:',
      err instanceof Error ? err.message : err,
    );
    return null;
  });
  if (!bill) notFound();

  return (
    <>
      <SetPageHeader>
        <BillPageHeader bill={bill} />
      </SetPageHeader>
      <BillDetail bill={bill} />
    </>
  );
}
