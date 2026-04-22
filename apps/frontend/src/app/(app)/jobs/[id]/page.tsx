import { redirect, notFound } from 'next/navigation';
import { getServerApiClient } from '@/lib/server-api';
import { SetBreadcrumbs } from '@/components/layout/SetBreadcrumbs';
import { JobDetail } from '@/components/jobs/JobDetail';
import type { Metadata } from 'next';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const api = await getServerApiClient();
  if (!api) return { title: 'Job | Claims Manager' };

  const job = await api.getJob(id).catch(() => null);
  const title = job?.externalReference ?? id;
  return { title: `${title} | Claims Manager` };
}

export default async function JobDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const api = await getServerApiClient();
  if (!api) redirect('/api/auth/login');

  const job = await api.getJob(id).catch((err: unknown) => {
    console.error(
      'frontend:JobDetailPage - getJob failed:',
      err instanceof Error ? err.message : err,
    );
    return null;
  });
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
