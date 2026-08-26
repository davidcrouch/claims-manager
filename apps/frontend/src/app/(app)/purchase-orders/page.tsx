import { redirect } from 'next/navigation';
import { getServerApiClient } from '@/lib/server-api';
import { PurchaseOrdersPageClient } from '@/components/purchase-orders/PurchaseOrdersPageClient';
import {buildJobNameById, buildJobTypeById, toJobOptions,
  mergeCurrentJobIntoNameById,
  mergeCurrentJobIntoTypeById,
  mergeCurrentJobIntoOptions } from '@/components/shared/job-label';
import type { Job, PaginatedResponse, PurchaseOrder, Claim } from '@/types/api';

export default async function PurchaseOrdersPage({
  searchParams }: {
  searchParams: Promise<{ page?: string; jobId?: string; status?: string; vendorId?: string; sort?: string; search?: string }>;
}) {
  const api = await getServerApiClient();
  if (!api) redirect('/api/auth/login');

  const params = await searchParams;
  const empty: PaginatedResponse<PurchaseOrder> = { data: [], total: 0 };
  const emptyJobs: PaginatedResponse<Job> = { data: [], total: 0 };
  const [initialPOs, statusLookupsRes, vendorsRes, jobsRes] = await Promise.all([
    api
      .getPurchaseOrders({
        page: parseInt(params.page ?? '1', 10),
        limit: 20,
        jobId: params.jobId,
        status: params.status,
        vendorId: params.vendorId,
        sort: params.sort,
        search: params.search })
      .catch((err: unknown) => {
        console.error(
          'frontend:PurchaseOrdersPage - getPurchaseOrders failed:',
          err instanceof Error ? err.message : err,
        );
        return empty;
      }),
    api.getLookupsByDomain('purchase_order_status').catch(() => []),
    api.getVendors({ limit: 100 }).catch(() => ({ data: [] })),
    api.getJobs({ limit: 100 }).catch((err: unknown) => {
      console.error(
        'frontend:PurchaseOrdersPage - getJobs failed:',
        err instanceof Error ? err.message : err,
      );
      return emptyJobs;
    }),
  ]);

  let job: Job | null = null;
  let parentClaim: Claim | null = null;
  if (params.jobId) {
    job = await api.getJob(params.jobId).catch((err: unknown) => {
      console.error(
        'frontend:PurchaseOrdersPage - getJob failed:',
        err instanceof Error ? err.message : err,
      );
      return null;
    });
    if (job?.claimId) {
      parentClaim = await api.getClaim(job.claimId).catch(() => null);
    }
  }

  const statusOptions = (Array.isArray(statusLookupsRes) ? statusLookupsRes : []).map(
    (row) => ({
      id: row.id,
      name: row.name?.trim() ? row.name : 'Unknown' }),
  );
  const vendorOptions = (vendorsRes.data ?? []).map((vendor) => ({
    id: vendor.id,
    name: vendor.name?.trim() ? vendor.name : 'Unknown' }));
  const jobs = jobsRes?.data ?? [];
  const jobNameById = mergeCurrentJobIntoNameById(buildJobNameById(jobs), job);
  const jobTypeById = mergeCurrentJobIntoTypeById(buildJobTypeById(jobs), job);

  return (
    <PurchaseOrdersPageClient
      initialData={initialPOs}
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
