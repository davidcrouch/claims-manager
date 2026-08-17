'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Receipt,
  ExternalLink,
  Calendar,
  DollarSign,
  FileSignature,
  Package,
  ClipboardList,
  MessageSquare,
  Paperclip,
  BookOpen,
  Loader2,
  Send,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusBadge } from '@/components/ui/status-badge';
import { BackButton } from '@/components/layout/BackButton';
import { SetHeaderActions } from '@/components/layout/SetHeaderActions';
import {
  DefRow,
  SectionCard,
  formatDate,
  formatDateTime,
  formatCurrency,
} from '@/components/shared/detail';
import type { Claim, Invoice, Job } from '@/types/api';
import { PrintButton } from '@/components/shared/PrintButton';
import { ArchiveEntityButton } from '@/components/shared/ArchiveEntityButton';
import { jobDisplayName } from '@/components/shared/job-label';
import { JournalList } from '@/components/journals/JournalList';
import {
  fetchJournalsByEntityAction,
  fetchJournalsListAction,
  createJournalAction,
  linkJournalAction,
  unlinkJournalAction,
} from '@/app/(app)/journals/actions';
import { QuoteLineItemsTable } from '@/components/quotes/QuoteLineItemsTable';
import type { ApiGroup } from '@/components/quotes/quote-line-items.types';
import { groupsFromDocumentPayload } from '@/components/quotes/quote-line-items.utils';
import { getPurchaseOrderLineItemsAction } from '@/app/(app)/purchase-orders/actions';
import { getWorkOrderLineItemsAction } from '@/app/(app)/work-orders/actions';
import { EntityAttachmentsTab } from '@/components/shared/EntityAttachmentsTab';
import {
  InvoicePublishWizard,
  type InvoicePublishMode,
} from '@/components/invoices/InvoicePublishWizard';

// ---------- header ----------------------------------------------------------

export function InvoicePageHeader({
  invoice,
  job,
  claim,
}: {
  invoice: Invoice;
  job?: Job | null;
  claim?: Claim | null;
}) {
  const [publishWizardOpen, setPublishWizardOpen] = useState(false);
  const title = invoice.invoiceNumber ?? invoice.id;
  const statusName = invoice.status?.name ?? 'Unknown';
  const canPublish = !invoice.sourceExternalReference;
  const publishMode: InvoicePublishMode =
    job?.provider === 'crunchwork' ? 'external' : 'internal';

  return (
    <>
      <SetHeaderActions>
        {canPublish && (
          <Button
            size="default"
            onClick={() => setPublishWizardOpen(true)}
            className="h-9 gap-1.5 px-4 bg-amber-600 text-white hover:bg-amber-500"
          >
            <Send className="h-3.5 w-3.5" />
            Publish
          </Button>
        )}
        <PrintButton documentType="invoice" entityId={invoice.id} jobId={job?.id} />
        <ArchiveEntityButton
          entityType="invoice"
          entityId={invoice.id}
          statusName={statusName}
          entityLabel={title}
          redirectTo={job ? `/invoices?jobId=${job.id}` : '/invoices'}
        />
      </SetHeaderActions>
      <InvoicePublishWizard
        open={publishWizardOpen}
        onOpenChange={setPublishWizardOpen}
        invoice={invoice}
        job={job}
        claim={claim}
        mode={publishMode}
      />
      <div className="flex w-full min-w-0 flex-col gap-y-1">
        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
          <BackButton href={job ? `/invoices?jobId=${job.id}` : '/invoices'} label="Back to invoices" />
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-teal-100">
            <Receipt className="h-4 w-4 text-teal-600" />
          </span>
          <h1 className="truncate text-lg font-semibold leading-tight">{title}</h1>
          <StatusBadge status={statusName} />
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
        </div>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1 pl-20 text-xs">
          <div className="flex items-baseline gap-1">
            <span className="text-muted-foreground">Amount:</span>
            <span className="font-medium">{formatCurrency(invoice.totalAmount)}</span>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-muted-foreground">Issue date:</span>
            <span className="font-medium">{formatDate(invoice.issueDate)}</span>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-muted-foreground">Updated:</span>
            <span className="font-medium">{formatDateTime(invoice.updatedAt)}</span>
          </div>
        </div>
      </div>
    </>
  );
}

// ---------- tabs ------------------------------------------------------------

function OverviewTab({ invoice }: { invoice: Invoice }) {
  const status = invoice.status?.name ?? 'Unknown';

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-4">
        <Card size="sm">
          <CardContent className="px-4">
            <p className="text-xs text-muted-foreground">Status</p>
            <p className="mt-1 text-sm font-medium">{status}</p>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardContent className="px-4">
            <p className="text-xs text-muted-foreground">Total amount</p>
            <p className="mt-1 text-sm font-medium">{formatCurrency(invoice.totalAmount)}</p>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardContent className="px-4">
            <p className="text-xs text-muted-foreground">Sub-total</p>
            <p className="mt-1 text-sm font-medium">{formatCurrency(invoice.subTotal)}</p>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardContent className="px-4">
            <p className="text-xs text-muted-foreground">Tax</p>
            <p className="mt-1 text-sm font-medium">{formatCurrency(invoice.tax)}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <SectionCard
          title="Invoice Details"
          icon={<FileSignature className="h-4 w-4 text-muted-foreground" />}
        >
          <DefRow label="Invoice number" value={invoice.invoiceNumber ?? '—'} />
          <DefRow label="Status" value={<StatusBadge status={status} />} />
          <DefRow label="Total amount" value={formatCurrency(invoice.totalAmount)} />
          <DefRow label="Sub-total" value={formatCurrency(invoice.subTotal)} />
          <DefRow label="Tax" value={formatCurrency(invoice.tax)} />
          <DefRow label="Excess amount" value={formatCurrency(invoice.excessAmount)} />
          <DefRow label="Issue date" value={formatDate(invoice.issueDate)} />
        </SectionCard>

        <SectionCard
          title="Linked Entities"
          icon={<DollarSign className="h-4 w-4 text-muted-foreground" />}
        >
          <DefRow
            label="Purchase order"
            value={
              invoice.purchaseOrderId ? (
                <Link
                  href={`/purchase-orders/${invoice.purchaseOrderId}`}
                  className="inline-flex items-center gap-1 text-primary hover:underline"
                >
                  {invoice.purchaseOrderId}
                  <ExternalLink className="h-3 w-3" />
                </Link>
              ) : (
                '—'
              )
            }
          />
          <DefRow
            label="Work order"
            value={
              invoice.workOrderId ? (
                <Link
                  href={`/work-orders/${invoice.workOrderId}`}
                  className="inline-flex items-center gap-1 text-primary hover:underline"
                >
                  {invoice.workOrderId}
                  <ExternalLink className="h-3 w-3" />
                </Link>
              ) : (
                '—'
              )
            }
          />
          <DefRow
            label="Job"
            value={
              invoice.jobId ? (
                <Link
                  href={`/jobs/${invoice.jobId}`}
                  className="inline-flex items-center gap-1 text-primary hover:underline"
                >
                  {invoice.jobId}
                  <ExternalLink className="h-3 w-3" />
                </Link>
              ) : (
                '—'
              )
            }
          />
        </SectionCard>
      </div>

      <SectionCard
        title="Audit"
        icon={<ClipboardList className="h-4 w-4 text-muted-foreground" />}
      >
        <DefRow label="Created" value={formatDateTime(invoice.createdAt)} />
        <DefRow label="Updated" value={formatDateTime(invoice.updatedAt)} />
      </SectionCard>
    </div>
  );
}

function LineItemsTab({ invoice }: { invoice: Invoice }) {
  const payload = (invoice.invoicePayload ?? invoice.apiPayload ?? {}) as Record<string, unknown>;
  const payloadGroups = groupsFromDocumentPayload(payload);
  const lineItems = (payload.lineItems ?? payload.items ?? []) as Array<Record<string, unknown>>;
  const [poGroups, setPoGroups] = useState<ApiGroup[] | null>(null);
  const [loading, setLoading] = useState(
    payloadGroups.length === 0 &&
      (!!invoice.purchaseOrderId || !!invoice.workOrderId),
  );

  const loadPo = useCallback(async () => {
    if (payloadGroups.length > 0) {
      setLoading(false);
      return;
    }
    setLoading(true);
    if (invoice.purchaseOrderId) {
      const result = await getPurchaseOrderLineItemsAction(invoice.purchaseOrderId);
      if (result.success && result.groups) {
        setPoGroups(result.groups as ApiGroup[]);
      }
    } else if (invoice.workOrderId) {
      const result = await getWorkOrderLineItemsAction(invoice.workOrderId);
      if (result.success && result.groups) {
        setPoGroups(result.groups as ApiGroup[]);
      }
    }
    setLoading(false);
  }, [invoice.purchaseOrderId, invoice.workOrderId, payloadGroups.length]);

  useEffect(() => {
    void loadPo();
  }, [loadPo]);

  const groups = payloadGroups.length > 0 ? payloadGroups : poGroups;

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (groups && groups.length > 0) {
    return <QuoteLineItemsTable groups={groups} readOnly />;
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

function ActivitiesTab() {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Activities</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          Tasks linked to this invoice will appear here once the activities API
          is connected.
        </p>
      </CardContent>
    </Card>
  );
}

function CommunicationsTab() {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Communications</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          Emails associated with this invoice will appear here once the
          communications API is connected.
        </p>
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

type InvTab =
  | 'overview'
  | 'line-items'
  | 'activities'
  | 'communications'
  | 'attachments'
  | 'journals'
  | 'timeline';

export function InvoiceDetail({ invoice }: { invoice: Invoice }) {
  const [tab, setTab] = useState<InvTab>('overview');

  const tabs: Array<{ id: InvTab; label: string; icon: typeof Calendar }> = [
    { id: 'overview', label: 'Overview', icon: FileSignature },
    { id: 'line-items', label: 'Line Items', icon: Package },
    { id: 'activities', label: 'Activities', icon: ClipboardList },
    { id: 'communications', label: 'Communications', icon: MessageSquare },
    { id: 'attachments', label: 'Attachments', icon: Paperclip },
    { id: 'journals', label: 'Journals', icon: BookOpen },
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
        {tab === 'activities' && <ActivitiesTab />}
        {tab === 'communications' && <CommunicationsTab />}
        {tab === 'attachments' && <EntityAttachmentsTab entityId={invoice.id} relatedRecordType="Invoice" entityLabel="this invoice" />}
        {tab === 'journals' && (
          <JournalList
            entityType="Invoice"
            entityId={invoice.id}
            fetchJournals={() => fetchJournalsByEntityAction('Invoice', invoice.id)}
            fetchAllJournals={() => fetchJournalsListAction()}
            createJournal={(data) => createJournalAction(data)}
            linkJournal={(jId) => linkJournalAction(jId, 'Invoice', invoice.id)}
            unlinkJournal={(jId) => unlinkJournalAction(jId, 'Invoice', invoice.id)}
          />
        )}
        {tab === 'timeline' && <TimelineTab invoice={invoice} />}
      </div>
    </div>
  );
}
