import { getSession, getAccessToken } from '@/lib/auth';
import { redirect, notFound } from 'next/navigation';
import { createApiClient } from '@/lib/api-client';
import { SetBreadcrumbs } from '@/components/layout/SetBreadcrumbs';
import { ReportDetail } from '@/components/reports/ReportDetail';
import type { Metadata } from 'next';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const session = await getSession();
  if (!session.authenticated) return { title: 'Report | Claims Manager' };

  const token = await getAccessToken();
  if (!token) return { title: 'Report | Claims Manager' };

  const api = createApiClient({ token });
  const report = await api.getReport(id);
  const title = report?.title ?? report?.reference ?? id;
  return { title: `${title} | Claims Manager` };
}

export default async function ReportDetailPage({
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
  const report = await api.getReport(id);
  if (!report) notFound();

  const title = report.title ?? report.reference ?? id;

  return (
    <>
      <SetBreadcrumbs
        items={[
          { title: 'Reports', href: '/reports' },
          { title, href: `/reports/${id}` },
        ]}
      />
      <ReportDetail report={report} />
    </>
  );
}
