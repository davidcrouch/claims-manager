import { getSession, getAccessToken } from '@/lib/auth';
import { redirect, notFound } from 'next/navigation';
import { createApiClient } from '@/lib/api-client';
import { SetBreadcrumbs } from '@/components/layout/SetBreadcrumbs';
import { ClaimDetail } from '@/components/claims/ClaimDetail';
import type { Metadata } from 'next';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const session = await getSession();
  if (!session.authenticated) return { title: 'Claim | Claims Manager' };

  const token = await getAccessToken();
  if (!token) return { title: 'Claim | Claims Manager' };

  const api = createApiClient({ token });
  const claim = await api.getClaim(id);
  const title = claim?.claimNumber ?? claim?.externalReference ?? id;
  return { title: `${title} | Claims Manager` };
}

export default async function ClaimDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getSession();
  if (!session.authenticated) {
    redirect('/api/auth/login');
  }

  const token = await getAccessToken();
  if (!token) {
    redirect('/api/auth/login');
  }

  const api = createApiClient({ token });
  const [claim, jobsRes] = await Promise.all([
    api.getClaim(id),
    api.getJobs({ claimId: id, limit: 50 }),
  ]);

  if (!claim) {
    notFound();
  }

  const claimWithJobs = { ...claim, jobs: jobsRes?.data ?? [] };
  const title = claim.claimNumber ?? claim.externalReference ?? id;

  return (
    <>
      <SetBreadcrumbs
        items={[
          { title: 'Claims', href: '/claims' },
          { title, href: `/claims/${id}` },
        ]}
      />
      <ClaimDetail claim={claimWithJobs} />
    </>
  );
}
