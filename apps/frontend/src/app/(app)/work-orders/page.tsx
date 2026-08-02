import { redirect } from 'next/navigation';
import { getServerApiClient } from '@/lib/server-api';
import { WorkOrdersPageClient } from '@/components/work-orders/WorkOrdersPageClient';
import { buildJobNameById, toJobOptions } from '@/components/shared/job-label';
import type { Job, PaginatedResponse, WorkOrder } from '@/types/api';

export const metadata = { title: 'Work Orders — EnsureOS' };

export default async function WorkOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; sort?: string; status?: string; workOrderType?: string }>;
}) {
  const api = await getServerApiClient();
  if (!api) redirect('/api/auth/login');

  const params = await searchParams;
  const empty: PaginatedResponse<WorkOrder> = { data: [], total: 0 };
  const emptyJobs: PaginatedResponse<Job> = { data: [], total: 0 };
  const [initialData, statusLookupsRes, typeLookupsRes, jobsRes] = await Promise.all([
    api
      .getWorkOrders({
        page: parseInt(params.page ?? '1', 10),
        limit: 20,
        sort: params.sort,
        status: params.status,
        workOrderType: params.workOrderType,
      })
      .catch((err: unknown) => {
        console.error(
          'frontend:WorkOrdersPage - getWorkOrders failed:',
          err instanceof Error ? err.message : err,
        );
        return empty;
      }),
    api.getLookupsByDomain('work_order_status').catch(() => []),
    api.getLookupsByDomain('work_order_type', { providerCode: 'direct' }).catch(() => []),
    api.getJobs({ limit: 100 }).catch((err: unknown) => {
      console.error(
        'frontend:WorkOrdersPage - getJobs failed:',
        err instanceof Error ? err.message : err,
      );
      return emptyJobs;
    }),
  ]);

  const statusOptions = (Array.isArray(statusLookupsRes) ? statusLookupsRes : []).map(
    (row) => ({
      id: row.id,
      name: row.name?.trim() ? row.name : 'Unknown',
    }),
  );
  const workOrderTypes = (Array.isArray(typeLookupsRes) ? typeLookupsRes : []).map((row) => ({
    id: row.id,
    name: row.name?.trim() ? row.name : 'Unknown',
  }));
  const jobs = jobsRes?.data ?? [];
  const jobNameById = buildJobNameById(jobs);

  return (
    <WorkOrdersPageClient
      initialData={initialData}
      statusOptions={statusOptions}
      workOrderTypes={workOrderTypes}
      jobNameById={jobNameById}
      jobs={toJobOptions(jobs)}
    />
  );
}
