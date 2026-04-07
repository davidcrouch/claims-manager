import { getSession, getAccessToken } from '@/lib/auth';
import { redirect, notFound } from 'next/navigation';
import { createApiClient } from '@/lib/api-client';
import { SetBreadcrumbs } from '@/components/layout/SetBreadcrumbs';
import { JobDetail } from '@/components/jobs/JobDetail';
import type { Metadata } from 'next';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const session = await getSession();
  if (!session.authenticated) return { title: 'Job | Claims Manager' };

  const token = await getAccessToken();
  if (!token) return { title: 'Job | Claims Manager' };

  const api = createApiClient({ token });
  const job = await api.getJob(id);
  const title = job?.externalReference ?? id;
  return { title: `${title} | Claims Manager` };
}

export default async function JobDetailPage({
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
  const job = await api.getJob(id);
  if (!job) {
    notFound();
  }

  const title = job.externalReference ?? id;

  return (
    <>
      <SetBreadcrumbs
        items={[
          { title: 'Jobs', href: '/jobs' },
          { title, href: `/jobs/${id}` },
        ]}
      />
      <JobDetail job={job} />
    </>
  );
}
