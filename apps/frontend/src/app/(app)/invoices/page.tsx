import { redirect } from 'next/navigation';
import { getServerApiClient } from '@/lib/server-api';
import { InvoicesPageClient } from '@/components/invoices/InvoicesPageClient';
import type { Invoice, Job, PaginatedResponse, WorkOrder } from '@/types/api';

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; purchaseOrderId?: string; status?: string; sort?: string }>;
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
  const jobNameById: Record<string, string> = {};
  for (const job of jobsRes?.data ?? []) {
    const label = job.name?.trim() || job.externalReference?.trim() || job.id;
    jobNameById[job.id] = label;
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
    />
  );
}
