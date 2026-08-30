import { redirect, notFound } from 'next/navigation';
import { getServerApiClient } from '@/lib/server-api';
import {
  loadClaim,
  loadInvoice,
  loadJob,
  loadPurchaseOrder,
  loadWorkOrder,
} from '@/lib/cached-entity-loaders';
import { SetPageHeader } from '@/components/layout/SetPageHeader';
import { InvoiceDetail, InvoicePageHeader } from '@/components/invoices/InvoiceDetail';
import type { Metadata } from 'next';
import type { Claim } from '@/types/api';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const invoice = await loadInvoice(id);
  const title = invoice?.invoiceNumber ?? id;
  return { title: `${title} | EnsureOS` };
}

export default async function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const api = await getServerApiClient();
  if (!api) redirect('/api/auth/login');

  const invoice = await loadInvoice(id);
  if (!invoice) notFound();

  const job = invoice.jobId ? await loadJob(invoice.jobId) : null;
  const workOrder = invoice.workOrderId
    ? await loadWorkOrder(invoice.workOrderId)
    : null;
  const purchaseOrderId = invoice.purchaseOrderId ?? workOrder?.purchaseOrderId ?? null;
  const purchaseOrder = purchaseOrderId
    ? await loadPurchaseOrder(purchaseOrderId)
    : null;

  let claim: Claim | null = job?.claim ?? null;
  const claimId = job?.claimId ?? job?.parentClaimId ?? null;
  if (!claim && claimId) {
    claim = await loadClaim(claimId);
  }

  return (
    <>
      <SetPageHeader>
        <InvoicePageHeader
          invoice={invoice}
          job={job}
          claim={claim}
          workOrder={workOrder}
          purchaseOrder={purchaseOrder}
        />
      </SetPageHeader>
      <InvoiceDetail invoice={invoice} />
    </>
  );
}
