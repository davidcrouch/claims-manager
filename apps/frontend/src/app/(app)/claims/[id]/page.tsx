import { redirect, notFound } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { getServerApiClient } from '@/lib/server-api';
import { loadClaim } from '@/lib/cached-entity-loaders';
import { SetPageHeader } from '@/components/layout/SetPageHeader';
import { ClaimDetail, ClaimPageHeader } from '@/components/claims/ClaimDetail';
import type { Metadata } from 'next';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const claim = await loadClaim(id);
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

  const [claim, jobsRes, jobTypesRes, orgUsers, session] = await Promise.all([
    loadClaim(id),
    api.getJobs({ claimId: id, limit: 50 }).catch((err: unknown) => {
      console.error(
        'frontend:ClaimDetailPage - getJobs failed:',
        err instanceof Error ? err.message : err,
      );
      return { data: [], total: 0 };
    }),
    Promise.all([
      api.getLookupsByDomain('job_type', { providerCode: 'direct' }).catch(() => []),
      api.getLookupsByDomain('job_type', { providerCode: 'crunchwork' }).catch(() => []),
    ]).then(([direct, crunchwork]) => [...direct, ...crunchwork]),
    api.listOrgUsersForSelect().catch((err: unknown) => {
      console.error(
        'frontend:ClaimDetailPage - listOrgUsersForSelect failed:',
        err instanceof Error ? err.message : err,
      );
      return [] as { id: string; email?: string }[];
    }),
    getSession(),
  ]);

  if (!claim) {
    notFound();
  }

  const email = session.identity?.email?.trim().toLowerCase();
  const sub = session.identity?.sub;
  const currentUserId =
    orgUsers.find((u) => email && u.email?.trim().toLowerCase() === email)?.id ??
    (sub && orgUsers.some((u) => u.id === sub) ? sub : null);

  const jobTypes = (Array.isArray(jobTypesRes) ? jobTypesRes : []).map((row) => ({
    id: row.id,
    name: row.name,
    providerCode: row.providerCode ?? null,
  }));

  const claimWithJobs = { ...claim, jobs: jobsRes?.data ?? [] };

  return (
    <>
      <SetPageHeader>
        <ClaimPageHeader claim={claimWithJobs} />
      </SetPageHeader>
      <ClaimDetail
        claim={claimWithJobs}
        jobTypes={jobTypes}
        currentUserId={currentUserId}
      />
    </>
  );
}
