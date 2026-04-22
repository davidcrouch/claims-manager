import { redirect } from 'next/navigation';
import { getServerApiClient } from '@/lib/server-api';
import { SetBreadcrumbs } from '@/components/layout/SetBreadcrumbs';
import { ReportsListClient } from '@/components/reports/ReportsListClient';
import type { PaginatedResponse, Report } from '@/types/api';

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; jobId?: string }>;
}) {
  const api = await getServerApiClient();
  if (!api) redirect('/api/auth/login');

  const params = await searchParams;
  const empty: PaginatedResponse<Report> = { data: [], total: 0 };
  const [initialReports, statusLookupsRes] = await Promise.all([
    api
      .getReports({
        page: parseInt(params.page ?? '1', 10),
        limit: 20,
        jobId: params.jobId,
      })
      .catch((err: unknown) => {
        console.error(
          'frontend:ReportsPage - getReports failed:',
          err instanceof Error ? err.message : err,
        );
        return empty;
      }),
    api.getLookupsByDomain('report_status').catch(() => []),
  ]);

  const statusOptions = (Array.isArray(statusLookupsRes) ? statusLookupsRes : []).map(
    (row) => ({
      id: row.id,
      name: row.name?.trim() ? row.name : 'Unknown',
    }),
  );

  return (
    <>
      <SetBreadcrumbs items={[{ title: 'Reports', href: '/reports' }]} />
      <ReportsListClient initialData={initialReports} statusOptions={statusOptions} />
    </>
  );
}
