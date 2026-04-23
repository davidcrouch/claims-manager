import { redirect, notFound } from 'next/navigation';
import { getServerApiClient } from '@/lib/server-api';
import { SetPageHeader } from '@/components/layout/SetPageHeader';
import { ClaimDetail, ClaimPageHeader } from '@/components/claims/ClaimDetail';
import type { Metadata } from 'next';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const api = await getServerApiClient();
  if (!api) return { title: 'Claim | EnsureOS' };

  const claim = await api.getClaim(id).catch(() => null);
  const title = claim?.claimNumber ?? claim?.externalReference ?? id;
  return { title: `${title} | EnsureOS` };
}

export default async function ClaimDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const api = await getServerApiClient();
  if (!api) redirect('/api/auth/login');

  const [claim, jobsRes] = await Promise.all([
    api.getClaim(id).catch((err: unknown) => {
      console.error(
        'frontend:ClaimDetailPage - getClaim failed:',
        err instanceof Error ? err.message : err,
      );
      return null;
    }),
    api.getJobs({ claimId: id, limit: 50 }).catch((err: unknown) => {
      console.error(
        'frontend:ClaimDetailPage - getJobs failed:',
        err instanceof Error ? err.message : err,
      );
      return { data: [], total: 0 };
    }),
  ]);

  if (!claim) {
    notFound();
  }

  const claimWithJobs = { ...claim, jobs: jobsRes?.data ?? [] };

  return (
    <>
      <SetPageHeader>
        <ClaimPageHeader claim={claimWithJobs} />
      </SetPageHeader>
      <ClaimDetail claim={claimWithJobs} />
    </>
  );
}
