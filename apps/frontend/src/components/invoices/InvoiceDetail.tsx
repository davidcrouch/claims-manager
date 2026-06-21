'use client';

import { useState } from 'react';
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
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusBadge } from '@/components/ui/status-badge';
import { BackButton } from '@/components/layout/BackButton';
import {
  DefRow,
  SectionCard,
  formatDate,
  formatDateTime,
  formatCurrency,
} from '@/components/shared/detail';
import type { Invoice } from '@/types/api';
import { JournalList } from '@/components/journals/JournalList';
import { useApiClient } from '@/hooks/useApiClient';

// ---------- header ----------------------------------------------------------

export function InvoicePageHeader({ invoice }: { invoice: Invoice }) {
  const title = invoice.invoiceNumber ?? invoice.id;
  const statusName = invoice.status?.name ?? 'Unknown';

  return (
    <div className="flex w-full flex-wrap items-center justify-between gap-x-6 gap-y-2">
      <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
        <BackButton href="/invoices" label="Back to invoices" />
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
        {invoice.jobId && (
          <Link
            href={`/jobs/${invoice.jobId}`}
            className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
          >
            View Job
            <ExternalLink className="h-3 w-3" />
          </Link>
        )}
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-x-5 gap-y-1 text-xs">
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
  const payload = ((invoice as any).apiPayload ?? (invoice as any).invoicePayload ?? {}) as Record<string, unknown>;
  const lineItems = (payload.lineItems ?? payload.items ?? []) as Array<Record<string, unknown>>;

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

function AttachmentsTab() {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Attachments</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          Supporting documents attached to this invoice will appear here once
          the attachments API is connected.
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
  const journalApi = useApiClient();

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
        {tab === 'attachments' && <AttachmentsTab />}
        {tab === 'journals' && (
          <JournalList parentType="invoice" parentId={invoice.id} api={journalApi} />
        )}
        {tab === 'timeline' && <TimelineTab invoice={invoice} />}
      </div>
    </div>
  );
}
