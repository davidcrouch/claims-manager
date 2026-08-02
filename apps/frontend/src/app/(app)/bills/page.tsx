import { redirect } from 'next/navigation';
import { getServerApiClient } from '@/lib/server-api';
import { BillsPageClient } from '@/components/bills/BillsPageClient';
import { buildJobNameById, toJobOptions } from '@/components/shared/job-label';
import type { Bill, Job, PaginatedResponse } from '@/types/api';

export const metadata = { title: 'Bills — EnsureOS' };

export default async function BillsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; sort?: string; status?: string; vendorId?: string }>;
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
    />
  );
}
