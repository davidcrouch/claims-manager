import { redirect } from 'next/navigation';
import { getServerApiClient } from '@/lib/server-api';
import { loadClaim, loadJob } from '@/lib/cached-entity-loaders';
import { InvoicesPageClient } from '@/components/invoices/InvoicesPageClient';
import { buildJobNameById, jobDisplayName } from '@/components/shared/job-label';
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

  const jobScoped = Boolean(params.jobId);

  const [initialInvoices, workOrdersRes, jobsRes, statusLookupsRes, job] =
    await Promise.all([
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
      api
        .getWorkOrders({
          limit: jobScoped ? 50 : 100,
          ...(params.jobId ? { jobId: params.jobId } : {}),
        })
        .catch((err: unknown) => {
          console.error(
            'frontend:InvoicesPage - getWorkOrders failed:',
            err instanceof Error ? err.message : err,
          );
          return emptyWorkOrders;
        }),
      jobScoped
        ? Promise.resolve({ data: [] as Job[], total: 0 })
        : api.getJobs({ limit: 100 }).catch((err: unknown) => {
            console.error(
              'frontend:InvoicesPage - getJobs failed:',
              err instanceof Error ? err.message : err,
            );
            return { data: [] as Job[], total: 0 };
          }),
      api.getLookupsByDomain('invoice_status').catch(() => []),
      params.jobId ? loadJob(params.jobId) : Promise.resolve(null),
    ]);

  const workOrders = workOrdersRes?.data ?? [];
  const jobNameById = job
    ? { [job.id]: jobDisplayName(job) }
    : buildJobNameById(jobsRes?.data ?? []);

  let parentClaim: Claim | null = null;
  if (job?.claimId) {
    parentClaim = await loadClaim(job.claimId);
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
