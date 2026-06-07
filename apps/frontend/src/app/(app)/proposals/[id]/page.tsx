import { redirect, notFound } from 'next/navigation';
import { getServerApiClient } from '@/lib/server-api';
import { SetPageHeader } from '@/components/layout/SetPageHeader';
import {
  ProposalDetail,
  ProposalPageHeader,
} from '@/components/proposals/ProposalDetail';
import type { Metadata } from 'next';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const api = await getServerApiClient();
  if (!api) return { title: 'Proposal | EnsureOS' };

  const proposal = await api.getProposal(id).catch(() => null);
  const title = proposal?.proposalNumber ?? proposal?.reference ?? proposal?.name ?? id;
  return { title: `${title} | EnsureOS` };
}

export default async function ProposalDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const api = await getServerApiClient();
  if (!api) redirect('/api/auth/login');

  const proposal = await api.getProposal(id).catch((err: unknown) => {
    console.error(
      'frontend:ProposalDetailPage - getProposal failed:',
      err instanceof Error ? err.message : err,
    );
    return null;
  });
  if (!proposal) notFound();

  return (
    <>
      <SetPageHeader>
        <ProposalPageHeader proposal={proposal} />
      </SetPageHeader>
      <ProposalDetail proposal={proposal} />
    </>
  );
}
