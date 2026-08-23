import { redirect } from 'next/navigation';
import { getServerApiClient } from '@/lib/server-api';
import { WorkOrdersPageClient } from '@/components/work-orders/WorkOrdersPageClient';
import {buildJobNameById, toJobOptions,
  mergeCurrentJobIntoNameById,
  mergeCurrentJobIntoOptions } from '@/components/shared/job-label';
import type { Job, Claim, PaginatedResponse, WorkOrder } from '@/types/api';

export const metadata = { title: 'Work Orders — EnsureOS' };

type ListTab = 'active' | 'archived' | 'all';
const VALID_TABS = new Set<ListTab>(['active', 'archived', 'all']);
const ARCHIVED_STATUS_NAMES = new Set(['archived', 'closed']);

/** Server-safe mirror of statusIdsForArchiveListTab (list-filters is a client module). */
function resolveStatusForTab(
  tab: ListTab,
  explicitStatus: string | undefined,
  statusOptions: { id: string; name: string }[],
): string | undefined {
  if (explicitStatus) return explicitStatus;
  if (tab === 'all') return undefined;
  const ids = statusOptions
    .filter((s) => {
      const archived = ARCHIVED_STATUS_NAMES.has(s.name.trim().toLowerCase());
      return tab === 'archived' ? archived : !archived;
    })
    .map((s) => s.id);
  return ids.length > 0 ? ids.sort().join(',') : undefined;
}

export default async function WorkOrdersPage({
  searchParams }: {
  searchParams: Promise<{
    page?: string;
    sort?: string;
    status?: string;
    workOrderType?: string;
    jobId?: string;
    search?: string;
    tab?: string;
  }>;
}) {
  const api = await getServerApiClient();
  if (!api) redirect('/api/auth/login');

  const params = await searchParams;
  const tab: ListTab =
    params.tab && VALID_TABS.has(params.tab as ListTab)
      ? (params.tab as ListTab)
      : 'active';
  const empty: PaginatedResponse<WorkOrder> = { data: [], total: 0 };
  const emptyJobs: PaginatedResponse<Job> = { data: [], total: 0 };

  const [statusLookupsRes, typeLookupsRes, jobsRes] = await Promise.all([
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
      name: row.name?.trim() ? row.name : 'Unknown' }),
  );
  const workOrderTypes = (Array.isArray(typeLookupsRes) ? typeLookupsRes : []).map((row) => ({
    id: row.id,
    name: row.name?.trim() ? row.name : 'Unknown' }));

  const resolvedStatus = resolveStatusForTab(tab, params.status, statusOptions);

  const initialData = await api
    .getWorkOrders({
      page: parseInt(params.page ?? '1', 10),
      limit: 20,
      sort: params.sort,
      status: resolvedStatus,
      workOrderType: params.workOrderType,
      jobId: params.jobId,
      search: params.search })
    .catch((err: unknown) => {
      console.error(
        'frontend:WorkOrdersPage - getWorkOrders failed:',
        err instanceof Error ? err.message : err,
      );
      return empty;
    });

  let job: Job | null = null;
  let parentClaim: Claim | null = null;
  if (params.jobId) {
    job = await api.getJob(params.jobId).catch((err: unknown) => {
      console.error(
        'frontend:WorkOrdersPage - getJob failed:',
        err instanceof Error ? err.message : err,
      );
      return null;
    });
    if (job?.claimId) {
      parentClaim = await api.getClaim(job.claimId).catch(() => null);
    }
  }

  const jobs = jobsRes?.data ?? [];
  const jobNameById = mergeCurrentJobIntoNameById(buildJobNameById(jobs), job);

  return (
    <WorkOrdersPageClient
      initialData={initialData}
      statusOptions={statusOptions}
      workOrderTypes={workOrderTypes}
      jobNameById={jobNameById}
      jobs={mergeCurrentJobIntoOptions(toJobOptions(jobs), job)}
      job={job}
      parentClaim={parentClaim}
    />
  );
}
