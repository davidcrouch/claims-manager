'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Receipt,
  ExternalLink,
  Calendar,
  FileSignature,
  Package,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusBadge } from '@/components/ui/status-badge';
import { BackButton } from '@/components/layout/BackButton';
import {
  PageHeaderField,
  PageHeaderIcon,
  PageHeaderLayout,
} from '@/components/layout/PageHeaderLayout';
import { HeaderActionToolbar } from '@/components/layout/HeaderActionToolbar';
import { SetHeaderActions } from '@/components/layout/SetHeaderActions';
import {
  DefRow,
  SectionCard,
  formatDate,
  formatDateTime,
  formatCurrency,
} from '@/components/shared/detail';
import type { Claim, Invoice, Job, PurchaseOrder, WorkOrder } from '@/types/api';
import { PrintButton } from '@/components/shared/PrintButton';
import { PublishButton } from '@/components/shared/PublishButton';
import { ArchiveEntityButton } from '@/components/shared/ArchiveEntityButton';
import { jobDisplayName } from '@/components/shared/job-label';
import { entityArchiveLabel, entityDetailHeaderTitles } from '@/components/shared/EntityDetailTitle';
import { invoiceInsurerRef } from '@/components/invoices/invoice-label';
import { LineItemsProvider, LineItemsTable } from '@/components/line-items';
import { PagedLineItemsTable } from '@/components/quotes/PagedLineItemsTable';
import { groupsFromDocumentPayload } from '@/components/line-items';
import { getPurchaseOrderLineItemsAction } from '@/app/(app)/purchase-orders/actions';
import { getWorkOrderLineItemsAction } from '@/app/(app)/work-orders/actions';
import {
  InvoicePublishWizard,
  type InvoicePublishMode,
} from '@/components/invoices/InvoicePublishWizard';
import { SyncStatusIndicator } from '@/components/shared/SyncStatusIndicator';

// ---------- header ----------------------------------------------------------

export function InvoicePageHeader({
  invoice,
  job,
  claim,
  workOrder,
  purchaseOrder,
}: {
  invoice: Invoice;
  job?: Job | null;
  claim?: Claim | null;
  workOrder?: WorkOrder | null;
  purchaseOrder?: PurchaseOrder | null;
}) {
  const [publishWizardOpen, setPublishWizardOpen] = useState(false);
  const statusName = invoice.status?.name ?? 'Unknown';
  const canPublish = !invoice.sourceExternalReference;
  const publishMode: InvoicePublishMode =
    job?.provider === 'crunchwork' ? 'external' : 'internal';
  const titles = entityDetailHeaderTitles({
    internalNumber: invoice.internalNumber,
    secondaryLabel: invoice.invoiceNumber,
    fallbackId: invoice.id,
  });

  return (
    <>
      <SetHeaderActions>
        <HeaderActionToolbar>
          {canPublish && (
            <PublishButton onClick={() => setPublishWizardOpen(true)} />
          )}
          <PrintButton documentType="invoice" entityId={invoice.id} jobId={job?.id} />
          <ArchiveEntityButton
            entityType="invoice"
            entityId={invoice.id}
            statusName={statusName}
            entityLabel={entityArchiveLabel(
              invoice.internalNumber,
              null,
              invoice.invoiceNumber,
              invoice.id,
            )}
            redirectTo={job ? `/invoices?jobId=${job.id}` : '/invoices'}
          />
        </HeaderActionToolbar>
      </SetHeaderActions>
      <InvoicePublishWizard
        open={publishWizardOpen}
        onOpenChange={setPublishWizardOpen}
        invoice={invoice}
        job={job}
        claim={claim}
        workOrder={workOrder}
        purchaseOrder={purchaseOrder}
        mode={publishMode}
      />
      <PageHeaderLayout
        leading={<BackButton href={job ? `/invoices?jobId=${job.id}` : '/invoices'} label="Back to invoices" />}
        icon={
          <PageHeaderIcon
            icon={Receipt}
            className="bg-teal-100"
            iconClassName="text-teal-600"
          />
        }
        topTitle={titles.topTitle}
        title={titles.title}
        titleMono={titles.titleMono}
        topRow={
          <>
            <StatusBadge status={statusName} />
            {(invoice as any).syncStatus && (
              <SyncStatusIndicator syncStatus={(invoice as any).syncStatus} compact />
            )}
            {invoice.purchaseOrderId && (
              <Link
                href={`/purchase-orders/${invoice.purchaseOrderId}`}
                className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
              >
                View PO
                <ExternalLink className="h-3 w-3" />
              </Link>
            )}
            {!invoice.purchaseOrderId && invoice.workOrderId && (
              <Link
                href={`/work-orders/${invoice.workOrderId}`}
                className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
              >
                View work order
                <ExternalLink className="h-3 w-3" />
              </Link>
            )}
            {job && (
              <Link
                href={`/jobs/${job.id}`}
                className="inline-flex items-center gap-1 text-xs uppercase text-primary hover:underline"
              >
                {jobDisplayName(job)}
                <ExternalLink className="h-3 w-3" />
              </Link>
            )}
          </>
        }
        bottomRow={
          <>
            <PageHeaderField label="Amount">{formatCurrency(invoice.totalAmount)}</PageHeaderField>
            <PageHeaderField label="Issue date">{formatDate(invoice.issueDate)}</PageHeaderField>
            <PageHeaderField label="Updated">{formatDateTime(invoice.updatedAt)}</PageHeaderField>
          </>
        }
      />
    </>
  );
}

// ---------- tabs ------------------------------------------------------------

function OverviewTab({ invoice }: { invoice: Invoice }) {
  const status = invoice.status?.name ?? 'Unknown';

  return (
    <SectionCard
      title="Invoice Details"
      icon={<FileSignature className="h-4 w-4 text-muted-foreground" />}
    >
      <DefRow label="Invoice number" value={invoice.invoiceNumber ?? '—'} />
      <DefRow label="Insurer Ref" value={invoiceInsurerRef(invoice) ?? '—'} />
      <DefRow label="Status" value={<StatusBadge status={status} />} />
      <DefRow label="Total amount" value={formatCurrency(invoice.totalAmount)} />
      <DefRow label="Sub-total" value={formatCurrency(invoice.subTotal)} />
      <DefRow label="Tax" value={formatCurrency(invoice.tax)} />
      <DefRow label="Excess amount" value={formatCurrency(invoice.excessAmount)} />
      <DefRow label="Issue date" value={formatDate(invoice.issueDate)} />
    </SectionCard>
  );
}

function LineItemsTab({ invoice }: { invoice: Invoice }) {
  const payload = (invoice.invoicePayload ?? invoice.apiPayload ?? {}) as Record<string, unknown>;
  const payloadGroups = groupsFromDocumentPayload(payload);
  const lineItems = (payload.lineItems ?? payload.items ?? []) as Array<Record<string, unknown>>;

  // CW create-invoice responses include groups, but they zero unit costs and send
  // tax/markup as percentage points. Prefer the linked WO/PO line items.
  if (invoice.purchaseOrderId) {
    return (
      <PagedLineItemsTable
        documentId={invoice.purchaseOrderId}
        loadAction={getPurchaseOrderLineItemsAction}
        fallbackGroups={payloadGroups}
        emptyLabel="No line items found in this invoice payload."
        readOnly
      />
    );
  }

  if (invoice.workOrderId) {
    return (
      <PagedLineItemsTable
        documentId={invoice.workOrderId}
        loadAction={getWorkOrderLineItemsAction}
        fallbackGroups={payloadGroups}
        emptyLabel="No line items found in this invoice payload."
        readOnly
      />
    );
  }

  if (payloadGroups.length > 0) {
    return (
      <LineItemsProvider groups={payloadGroups} mode="readonly">
        <LineItemsTable />
      </LineItemsProvider>
    );
  }

  if (lineItems.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Line Items</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No line items found in this invoice payload.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Line Items</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="pb-2 pr-4 font-medium">Item Name</th>
                <th className="pb-2 pr-4 text-right font-medium">Quantity</th>
                <th className="pb-2 pr-4 text-right font-medium">Unit Cost</th>
                <th className="pb-2 text-right font-medium">Total</th>
              </tr>
            </thead>
            <tbody>
              {lineItems.map((item, idx) => (
                <tr key={idx} className="border-b last:border-0">
                  <td className="py-2 pr-4">{String(item.name ?? item.itemName ?? '—')}</td>
                  <td className="py-2 pr-4 text-right">{item.quantity != null ? String(item.quantity) : '—'}</td>
                  <td className="py-2 pr-4 text-right">{formatCurrency(item.unitCost ?? item.unitPrice ?? item.rate)}</td>
                  <td className="py-2 text-right">{formatCurrency(item.total ?? item.amount ?? item.lineTotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

function TimelineTab({ invoice }: { invoice: Invoice }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <SectionCard
        title="Local audit"
        icon={<Calendar className="h-4 w-4 text-muted-foreground" />}
      >
        <DefRow label="Created" value={formatDateTime(invoice.createdAt)} />
        <DefRow label="Updated" value={formatDateTime(invoice.updatedAt)} />
      </SectionCard>
    </div>
  );
}

// ---------- container -------------------------------------------------------

type InvTab = 'overview' | 'line-items' | 'timeline';

export function InvoiceDetail({ invoice }: { invoice: Invoice }) {
  const [tab, setTab] = useState<InvTab>('overview');

  const tabs: Array<{ id: InvTab; label: string; icon: typeof Calendar }> = [
    { id: 'overview', label: 'Overview', icon: FileSignature },
    { id: 'line-items', label: 'Line Items', icon: Package },
    { id: 'timeline', label: 'Timeline', icon: Calendar },
  ];

  return (
    <div className="flex flex-col">
      <div className="flex flex-wrap gap-0 border-b border-slate-200">
        {tabs.map((t) => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`inline-flex items-center gap-1.5 px-4 py-3 text-sm font-medium transition-colors border-b-2 -mb-px rounded-t-md ${
                active
                  ? 'border-teal-600 bg-teal-50 text-teal-600'
                  : 'border-transparent bg-transparent text-slate-500 hover:bg-slate-50 hover:text-slate-700'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {t.label}
            </button>
          );
        })}
      </div>
      <div className="pt-4">
        {tab === 'overview' && <OverviewTab invoice={invoice} />}
        {tab === 'line-items' && <LineItemsTab invoice={invoice} />}
        {tab === 'timeline' && <TimelineTab invoice={invoice} />}
      </div>
    </div>
  );
}
