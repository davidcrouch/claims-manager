import { redirect } from 'next/navigation';
import { getServerApiClient } from '@/lib/server-api';
import { ReportsListClient } from '@/components/reports/ReportsListClient';
import type { PaginatedResponse, Report } from '@/types/api';

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; jobId?: string; status?: string; reportTypeId?: string; sort?: string }>;
}) {
  const api = await getServerApiClient();
  if (!api) redirect('/api/auth/login');

  const params = await searchParams;
  const empty: PaginatedResponse<Report> = { data: [], total: 0 };
  const [initialReports, statusLookupsRes, reportTypesRes] = await Promise.all([
    api
      .getReports({
        page: parseInt(params.page ?? '1', 10),
        limit: 20,
        jobId: params.jobId,
        status: params.status,
        reportTypeId: params.reportTypeId,
        sort: params.sort,
      })
      .catch((err: unknown) => {
        console.error(
          'frontend:ReportsPage - getReports failed:',
          err instanceof Error ? err.message : err,
        );
        return empty;
      }),
    api.getLookupsByDomain('report_status').catch(() => []),
    api.getLookupsByDomain('report_type').catch(() => []),
  ]);

  const statusOptions = (Array.isArray(statusLookupsRes) ? statusLookupsRes : []).map(
    (row) => ({
      id: row.id,
      name: row.name?.trim() ? row.name : 'Unknown',
    }),
  );
  const reportTypes = (Array.isArray(reportTypesRes) ? reportTypesRes : []).map((row) => ({
    id: row.id,
    name: row.name?.trim() ? row.name : 'Unknown',
  }));

  return (
    <ReportsListClient initialData={initialReports} statusOptions={statusOptions} reportTypes={reportTypes} />
  );
}
