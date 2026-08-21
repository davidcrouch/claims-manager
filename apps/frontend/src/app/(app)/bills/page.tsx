import { redirect } from 'next/navigation';
import { getServerApiClient } from '@/lib/server-api';
import { BillsPageClient } from '@/components/bills/BillsPageClient';
import { buildJobNameById, toJobOptions } from '@/components/shared/job-label';
import type { Bill, Job, Claim, PaginatedResponse } from '@/types/api';

export const metadata = { title: 'Bills — EnsureOS' };

export default async function BillsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; sort?: string; status?: string; vendorId?: string; jobId?: string; search?: string }>;
}) {
  const api = await getServerApiClient();
  if (!api) redirect('/api/auth/login');

  const params = await searchParams;
  const empty: PaginatedResponse<Bill> = { data: [], total: 0 };
  const emptyJobs: PaginatedResponse<Job> = { data: [], total: 0 };
  const [initialData, statusLookupsRes, vendorsRes, jobsRes] = await Promise.all([
    api
      .getBills({
        page: parseInt(params.page ?? '1', 10),
        limit: 20,
        sort: params.sort,
        status: params.status,
        vendorId: params.vendorId,
        jobId: params.jobId,
        search: params.search,
      })
      .catch((err: unknown) => {
        console.error(
          'frontend:BillsPage - getBills failed:',
          err instanceof Error ? err.message : err,
        );
        return empty;
      }),
    api.getLookupsByDomain('bill_status').catch(() => []),
    api.getVendors({ limit: 100 }).catch(() => ({ data: [] })),
    api.getJobs({ limit: 100 }).catch((err: unknown) => {
      console.error(
        'frontend:BillsPage - getJobs failed:',
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
        'frontend:BillsPage - getJob failed:',
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
      name: row.name?.trim() ? row.name : 'Unknown',
    }),
  );
  const vendorOptions = (vendorsRes.data ?? []).map((vendor) => ({
    id: vendor.id,
    name: vendor.name?.trim() ? vendor.name : 'Unknown',
  }));
  const jobs = jobsRes?.data ?? [];
  const jobNameById = buildJobNameById(jobs);

  return (
    <BillsPageClient
      initialData={initialData}
      statusOptions={statusOptions}
      vendorOptions={vendorOptions}
      jobNameById={jobNameById}
      jobs={toJobOptions(jobs)}
      job={job}
      parentClaim={parentClaim}
    />
  );
}
