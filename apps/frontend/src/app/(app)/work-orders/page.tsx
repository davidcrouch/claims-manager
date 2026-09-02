import { redirect } from 'next/navigation';
import { getServerApiClient } from '@/lib/server-api';
import { getSession } from '@/lib/auth';
import { resolveCurrentOrgUserId } from '@/lib/current-org-user';
import { WorkOrdersPageClient } from '@/components/work-orders/WorkOrdersPageClient';
import {
  isWorkOrdersMineTab,
  parseWorkOrdersListTab,
  resolveWorkOrdersListStatusParam,
} from '@/components/work-orders/work-orders-list-helpers';
import {buildJobNameById, buildJobTypeById, toJobOptions,
  mergeCurrentJobIntoNameById,
  mergeCurrentJobIntoTypeById,
  mergeCurrentJobIntoOptions } from '@/components/shared/job-label';
import type { Job, Claim, PaginatedResponse, WorkOrder } from '@/types/api';

export const metadata = { title: 'Work Orders — EnsureOS' };

export default async function WorkOrdersPage({
  searchParams }: {
  searchParams: Promise<{
    page?: string;
    sort?: string;
    status?: string;
    workOrderType?: string;
    jobId?: string;
    jobIds?: string;
    search?: string;
    tab?: string;
    archiveState?: string;
    assignedToUserId?: string;
    assignedToUserIds?: string;
  }>;
}) {
  const api = await getServerApiClient();
  if (!api) redirect('/api/auth/login');

  const params = await searchParams;
  const empty: PaginatedResponse<WorkOrder> = { data: [], total: 0 };
  const emptyJobs: PaginatedResponse<Job> = { data: [], total: 0 };
  const tab = parseWorkOrdersListTab(params.tab ?? null);
  const jobIds = params.jobIds
    ? params.jobIds.split(',').map((id) => id.trim()).filter(Boolean)
    : undefined;

  const [orgUsers, session, statusLookupsRes, typeLookupsRes, jobsRes] = await Promise.all([
    api.listOrgUsersForSelect().catch(() => [] as { id: string; email?: string }[]),
    getSession(),
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

  const currentUserId = resolveCurrentOrgUserId(orgUsers, session.identity);
  const effectiveTab =
    tab === 'active' && params.assignedToUserId && params.assignedToUserId === currentUserId
      ? 'mine'
      : tab;
  const mineTab = isWorkOrdersMineTab(effectiveTab);

  const statusOptions = (Array.isArray(statusLookupsRes) ? statusLookupsRes : []).map(
    (row) => ({
      id: row.id,
      name: row.name?.trim() ? row.name : 'Unknown' }),
  );
  const workOrderTypes = (Array.isArray(typeLookupsRes) ? typeLookupsRes : []).map((row) => ({
    id: row.id,
    name: row.name?.trim() ? row.name : 'Unknown' }));

  const resolvedStatus = resolveWorkOrdersListStatusParam({
    tab: effectiveTab,
    statusOptions,
    explicitStatus: params.status,
    archiveState: mineTab ? params.archiveState : undefined,
  });
  const initialAssignedToUserId = mineTab && currentUserId ? currentUserId : undefined;
  const initialAssignedToUserIds = mineTab ? undefined : params.assignedToUserIds;

  const initialData = await api
    .getWorkOrders({
      page: parseInt(params.page ?? '1', 10),
      limit: 20,
      sort: params.sort,
      status: resolvedStatus,
      workOrderType: params.workOrderType,
      jobId: params.jobId,
      jobIds,
      search: params.search,
      assignedToUserId: initialAssignedToUserId,
      assignedToUserIds: initialAssignedToUserIds,
    })
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
  const jobTypeById = mergeCurrentJobIntoTypeById(buildJobTypeById(jobs), job);

  return (
    <WorkOrdersPageClient
      initialData={initialData}
      statusOptions={statusOptions}
      workOrderTypes={workOrderTypes}
      jobNameById={jobNameById}
      jobTypeById={jobTypeById}
      jobs={mergeCurrentJobIntoOptions(toJobOptions(jobs), job)}
      job={job}
      parentClaim={parentClaim}
      currentUserId={currentUserId}
    />
  );
}
