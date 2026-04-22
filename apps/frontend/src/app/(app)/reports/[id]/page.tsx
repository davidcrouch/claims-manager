import { redirect, notFound } from 'next/navigation';
import { getServerApiClient } from '@/lib/server-api';
import { SetBreadcrumbs } from '@/components/layout/SetBreadcrumbs';
import { ReportDetail } from '@/components/reports/ReportDetail';
import type { Metadata } from 'next';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const api = await getServerApiClient();
  if (!api) return { title: 'Report | Claims Manager' };

  const report = await api.getReport(id).catch(() => null);
  const title = report?.title ?? report?.reference ?? id;
  return { title: `${title} | Claims Manager` };
}

export default async function ReportDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const api = await getServerApiClient();
  if (!api) redirect('/api/auth/login');

  const report = await api.getReport(id).catch((err: unknown) => {
    console.error(
      'frontend:ReportDetailPage - getReport failed:',
      err instanceof Error ? err.message : err,
    );
    return null;
  });
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
