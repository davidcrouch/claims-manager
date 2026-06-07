import { redirect, notFound } from 'next/navigation';
import { getServerApiClient } from '@/lib/server-api';
import { SetPageHeader } from '@/components/layout/SetPageHeader';
import { RfqDetail, RfqPageHeader } from '@/components/rfqs/RfqDetail';
import { fetchRfqProposalsAction } from './actions';
import type { Metadata } from 'next';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const api = await getServerApiClient();
  if (!api) return { title: 'RFQ | EnsureOS' };

  const rfq = await api.getRfq(id).catch(() => null);
  const title = rfq?.rfqNumber ?? rfq?.name ?? id;
  return { title: `${title} | EnsureOS` };
}

export default async function RfqDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const api = await getServerApiClient();
  if (!api) redirect('/api/auth/login');

  const rfq = await api.getRfq(id).catch((err: unknown) => {
    console.error(
      'frontend:RfqDetailPage - getRfq failed:',
      err instanceof Error ? err.message : err,
    );
    return null;
  });
  if (!rfq) notFound();

  return (
    <>
      <SetPageHeader>
        <RfqPageHeader rfq={rfq} />
      </SetPageHeader>
      <RfqDetail rfq={rfq} fetchProposals={fetchRfqProposalsAction} />
    </>
  );
}
