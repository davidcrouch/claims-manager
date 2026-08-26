import { redirect } from 'next/navigation';
import { getServerApiClient } from '@/lib/server-api';
import { RfqsPageClient } from '@/components/rfqs/RfqsPageClient';
import {buildJobNameById, buildJobTypeById, toJobOptions,
  mergeCurrentJobIntoNameById,
  mergeCurrentJobIntoTypeById,
  mergeCurrentJobIntoOptions } from '@/components/shared/job-label';
import type { Job, Claim, PaginatedResponse, Rfq } from '@/types/api';

export const metadata = { title: 'RFQs — EnsureOS' };

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

export default async function RfqsPage({
  searchParams }: {
  searchParams: Promise<{
    page?: string;
    sort?: string;
    status?: string;
    vendorId?: string;
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
  const empty: PaginatedResponse<Rfq> = { data: [], total: 0 };
  const emptyJobs: PaginatedResponse<Job> = { data: [], total: 0 };

  const [statusLookupsRes, vendorsRes, jobsRes] = await Promise.all([
    api.getLookupsByDomain('rfq_status').catch(() => []),
    api.getVendors({ limit: 100 }).catch(() => ({ data: [] })),
    api.getJobs({ limit: 100 }).catch((err: unknown) => {
      console.error(
        'frontend:RfqsPage - getJobs failed:',
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
  const resolvedStatus = resolveStatusForTab(tab, params.status, statusOptions);

  const initialData = await api
    .getRfqs({
      page: parseInt(params.page ?? '1', 10),
      limit: 20,
      sort: params.sort,
      status: resolvedStatus,
      vendorId: params.vendorId,
      jobId: params.jobId,
      search: params.search })
    .catch((err: unknown) => {
      console.error(
        'frontend:RfqsPage - getRfqs failed:',
        err instanceof Error ? err.message : err,
      );
      return empty;
    });

  let job: Job | null = null;
  let parentClaim: Claim | null = null;
  if (params.jobId) {
    job = await api.getJob(params.jobId).catch((err: unknown) => {
      console.error(
        'frontend:RfqsPage - getJob failed:',
        err instanceof Error ? err.message : err,
      );
      return null;
    });
    if (job?.claimId) {
      parentClaim = await api.getClaim(job.claimId).catch(() => null);
    }
  }

  const vendorOptions = (vendorsRes.data ?? []).map((vendor) => ({
    id: vendor.id,
    name: vendor.name?.trim() ? vendor.name : 'Unknown' }));
  const jobs = jobsRes?.data ?? [];
  const jobNameById = mergeCurrentJobIntoNameById(buildJobNameById(jobs), job);
  const jobTypeById = mergeCurrentJobIntoTypeById(buildJobTypeById(jobs), job);

  return (
    <RfqsPageClient
      initialData={initialData}
      statusOptions={statusOptions}
      vendorOptions={vendorOptions}
      jobNameById={jobNameById}
      jobTypeById={jobTypeById}
      jobs={mergeCurrentJobIntoOptions(toJobOptions(jobs), job)}
      job={job}
      parentClaim={parentClaim}
    />
  );
}
