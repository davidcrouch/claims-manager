import { redirect } from 'next/navigation';
import { getServerApiClient } from '@/lib/server-api';
import { InvoicesPageClient } from '@/components/invoices/InvoicesPageClient';
import { buildJobNameById } from '@/components/shared/job-label';
import type { Claim, Invoice, Job, PaginatedResponse, WorkOrder } from '@/types/api';

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; purchaseOrderId?: string; status?: string; sort?: string; jobId?: string }>;
}) {
  const api = await getServerApiClient();
  if (!api) redirect('/api/auth/login');

  const params = await searchParams;
  const emptyInvoices: PaginatedResponse<Invoice> = { data: [], total: 0 };
  const emptyWorkOrders: PaginatedResponse<WorkOrder> = { data: [], total: 0 };
  const emptyJobs: PaginatedResponse<Job> = { data: [], total: 0 };

  const [initialInvoices, workOrdersRes, jobsRes, statusLookupsRes] = await Promise.all([
    api
      .getInvoices({
        page: parseInt(params.page ?? '1', 10),
        limit: 20,
        purchaseOrderId: params.purchaseOrderId,
        status: params.status,
        sort: params.sort,
        jobId: params.jobId,
      })
      .catch((err: unknown) => {
        console.error(
          'frontend:InvoicesPage - getInvoices failed:',
          err instanceof Error ? err.message : err,
        );
        return emptyInvoices;
      }),
    api.getWorkOrders({ limit: 100 }).catch((err: unknown) => {
      console.error(
        'frontend:InvoicesPage - getWorkOrders failed:',
        err instanceof Error ? err.message : err,
      );
      return emptyWorkOrders;
    }),
    api.getJobs({ limit: 100 }).catch((err: unknown) => {
      console.error(
        'frontend:InvoicesPage - getJobs failed:',
        err instanceof Error ? err.message : err,
      );
      return emptyJobs;
    }),
    api.getLookupsByDomain('invoice_status').catch(() => []),
  ]);

  const workOrders = workOrdersRes?.data ?? [];
  const jobNameById = buildJobNameById(jobsRes?.data ?? []);

  let job: Job | null = null;
  let parentClaim: Claim | null = null;
  if (params.jobId) {
    job = await api.getJob(params.jobId).catch((err: unknown) => {
      console.error(
        'frontend:InvoicesPage - getJob failed:',
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

  return (
    <InvoicesPageClient
      initialData={initialInvoices}
      workOrders={workOrders}
      jobNameById={jobNameById}
      statusOptions={statusOptions}
      job={job}
      parentClaim={parentClaim}
    />
  );
}
