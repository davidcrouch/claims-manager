'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ReceiptText,
  ExternalLink,
  Building2,
  Calendar,
  DollarSign,
  FileSignature,
  Layers,
  Package,
  ClipboardList,
  MessageSquare,
  Paperclip,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import { BackButton } from '@/components/layout/BackButton';
import {
  DefRow,
  SectionCard,
  formatDate,
  formatDateTime,
  formatCurrency,
  pick,
  asString,
  type Dict,
} from '@/components/shared/detail';
import { updateBillStatusAction } from '@/app/(app)/mutations-status';
import type { Bill } from '@/types/api';

// ---------- helpers ---------------------------------------------------------

function getPayload(bill: Bill): Dict {
  return (bill.billPayload as Dict | undefined) ?? {};
}

function vendorName(bill: Bill): string | undefined {
  const payload = getPayload(bill);
  return (
    asString((payload.vendor as Dict | undefined)?.name) ??
    asString(pick(payload, 'vendorName'))
  );
}

// ---------- header ----------------------------------------------------------

export function BillPageHeader({ bill }: { bill: Bill }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const title = bill.billNumber ?? bill.externalReference ?? bill.id;
  const status = bill.status?.name ?? 'Unknown';
  const vendor = vendorName(bill);

  async function handleStatusChange(newStatus: string) {
    setLoading(true);
    const result = await updateBillStatusAction(bill.id, newStatus);
    if (!result.success) {
      console.error('[frontend:BillPageHeader.handleStatusChange]', result.error);
    }
    router.refresh();
    setLoading(false);
  }

  return (
    <div className="flex w-full flex-wrap items-center justify-between gap-x-6 gap-y-2">
      <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
        <BackButton href="/bills" label="Back to bills" />
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-rose-100">
          <ReceiptText className="h-4 w-4 text-rose-600" />
        </span>
        <h1 className="truncate text-lg font-semibold leading-tight">{title}</h1>
        <StatusBadge status={status} />
        {vendor && (
          <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground">
            <Building2 className="h-3 w-3" />
            {vendor}
          </span>
        )}
        {bill.purchaseOrderId && (
          <Link
            href={`/purchase-orders/${bill.purchaseOrderId}`}
            className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
          >
            View PO
            <ExternalLink className="h-3 w-3" />
          </Link>
        )}
        {bill.jobId && (
          <Link
            href={`/jobs/${bill.jobId}`}
            className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
          >
            View Job
            <ExternalLink className="h-3 w-3" />
          </Link>
        )}
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-x-5 gap-y-1">
        <div className="flex items-baseline gap-1 text-xs">
          <span className="text-muted-foreground">Amount:</span>
          <span className="font-medium">{formatCurrency(bill.totalAmount)}</span>
        </div>
        <div className="flex items-baseline gap-1 text-xs">
          <span className="text-muted-foreground">Received:</span>
          <span className="font-medium">{formatDate(bill.receivedDate)}</span>
        </div>
        <div className="flex items-baseline gap-1 text-xs">
          <span className="text-muted-foreground">Due:</span>
          <span className="font-medium">{formatDate(bill.dueDate)}</span>
        </div>
        <div className="flex items-center gap-2">
          {status === 'Received' && (
            <>
              <Button
                size="sm"
                disabled={loading}
                className="bg-green-600 text-white hover:bg-green-700"
                onClick={() => handleStatusChange('Approved')}
              >
                Approve
              </Button>
              <Button
                size="sm"
                variant="destructive"
                disabled={loading}
                onClick={() => handleStatusChange('Rejected')}
              >
                Reject
              </Button>
            </>
          )}
          {status === 'Approved' && (
            <Button
              size="sm"
              disabled={loading}
              className="bg-green-600 text-white hover:bg-green-700"
              onClick={() => handleStatusChange('Paid')}
            >
              Mark Paid
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------- tabs ------------------------------------------------------------

function OverviewTab({ bill }: { bill: Bill }) {
  const status = bill.status?.name ?? 'Unknown';
  const paymentStatus = bill.paymentStatus?.name;
  const vendor = vendorName(bill);

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
            <p className="text-xs text-muted-foreground">Payment status</p>
            <p className="mt-1 text-sm font-medium">{paymentStatus ?? '—'}</p>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardContent className="px-4">
            <p className="text-xs text-muted-foreground">Amount</p>
            <p className="mt-1 text-sm font-medium">{formatCurrency(bill.totalAmount)}</p>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardContent className="px-4">
            <p className="text-xs text-muted-foreground">Tax</p>
            <p className="mt-1 text-sm font-medium">{formatCurrency(bill.totalTax)}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <SectionCard
          title="Bill Details"
          icon={<FileSignature className="h-4 w-4 text-muted-foreground" />}
        >
          <DefRow label="Bill number" value={bill.billNumber ?? '—'} />
          <DefRow label="External reference" value={bill.externalReference ?? '—'} />
          <DefRow label="Status" value={<StatusBadge status={status} />} />
          {paymentStatus && (
            <DefRow label="Payment status" value={<StatusBadge status={paymentStatus} />} />
          )}
          <DefRow
            label="Vendor (from)"
            value={
              bill.vendorId ? (
                <Link
                  href={`/vendors/${bill.vendorId}`}
                  className="inline-flex items-center gap-1 text-primary hover:underline"
                >
                  {vendor ?? bill.vendorId}
                  <ExternalLink className="h-3 w-3" />
                </Link>
              ) : (
                vendor ?? '—'
              )
            }
          />
          <DefRow
            label="PO"
            value={
              bill.purchaseOrderId ? (
                <Link
                  href={`/purchase-orders/${bill.purchaseOrderId}`}
                  className="inline-flex items-center gap-1 text-primary hover:underline"
                >
                  {bill.purchaseOrderId}
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
              bill.jobId ? (
                <Link
                  href={`/jobs/${bill.jobId}`}
                  className="inline-flex items-center gap-1 text-primary hover:underline"
                >
                  {bill.jobId}
                  <ExternalLink className="h-3 w-3" />
                </Link>
              ) : (
                '—'
              )
            }
          />
          <DefRow
            label="Claim"
            value={
              bill.claimId ? (
                <Link
                  href={`/claims/${bill.claimId}`}
                  className="inline-flex items-center gap-1 text-primary hover:underline"
                >
                  {bill.claimId}
                  <ExternalLink className="h-3 w-3" />
                </Link>
              ) : (
                '—'
              )
            }
          />
        </SectionCard>

        <SectionCard
          title="Financial & Dates"
          icon={<DollarSign className="h-4 w-4 text-muted-foreground" />}
        >
          <DefRow label="Amount" value={formatCurrency(bill.totalAmount)} />
          <DefRow label="Sub-total" value={formatCurrency(bill.subTotal)} />
          <DefRow label="Total tax" value={formatCurrency(bill.totalTax)} />
          <DefRow label="Issue date" value={formatDate(bill.issueDate)} />
          <DefRow label="Received date" value={formatDate(bill.receivedDate)} />
          <DefRow label="Due date" value={formatDate(bill.dueDate)} />
          <DefRow label="Payment date" value={formatDate(bill.paymentDate)} />
        </SectionCard>
      </div>

      {(bill.comments || bill.declinedReason) && (
        <div className="grid gap-4 md:grid-cols-2">
          {bill.comments ? (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Comments</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-wrap text-sm">{bill.comments}</p>
              </CardContent>
            </Card>
          ) : null}
          {bill.declinedReason ? (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Declined Reason</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-wrap text-sm">{bill.declinedReason}</p>
              </CardContent>
            </Card>
          ) : null}
        </div>
      )}
    </div>
  );
}

function LineItemsTab() {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Line Items</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          Items from the linked PO that this bill covers will appear here once
          the line items API is connected.
        </p>
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
          Tasks and appointments linked to this bill will appear here once the
          activities API is connected.
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
          Emails and messages associated with this bill will appear here once
          the communications API is connected.
        </p>
      </CardContent>
    </Card>
  );
}

function TimelineTab({ bill }: { bill: Bill }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <SectionCard
        title="Local audit"
        icon={<Calendar className="h-4 w-4 text-muted-foreground" />}
      >
        <DefRow label="Created" value={formatDateTime(bill.createdAt)} />
        <DefRow label="Updated" value={formatDateTime(bill.updatedAt)} />
        <DefRow label="Created by (user id)" value={bill.createdByUserId ?? '—'} />
        <DefRow label="Updated by (user id)" value={bill.updatedByUserId ?? '—'} />
      </SectionCard>
    </div>
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
          Attachments linked to this bill will appear here once the attachments
          API is connected.
        </p>
      </CardContent>
    </Card>
  );
}

// ---------- container -------------------------------------------------------

type BillTab =
  | 'overview'
  | 'line-items'
  | 'activities'
  | 'communications'
  | 'timeline'
  | 'attachments';

export function BillDetail({ bill }: { bill: Bill }) {
  const [tab, setTab] = useState<BillTab>('overview');

  const tabs: Array<{ id: BillTab; label: string; icon: typeof Calendar }> = [
    { id: 'overview', label: 'Overview', icon: FileSignature },
    { id: 'line-items', label: 'Line Items', icon: Package },
    { id: 'activities', label: 'Activities', icon: ClipboardList },
    { id: 'communications', label: 'Communications', icon: MessageSquare },
    { id: 'timeline', label: 'Timeline', icon: Calendar },
    { id: 'attachments', label: 'Attachments', icon: Paperclip },
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
                  ? 'border-rose-600 bg-rose-50 text-rose-600'
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
        {tab === 'overview' && <OverviewTab bill={bill} />}
        {tab === 'line-items' && <LineItemsTab />}
        {tab === 'activities' && <ActivitiesTab />}
        {tab === 'communications' && <CommunicationsTab />}
        {tab === 'timeline' && <TimelineTab bill={bill} />}
        {tab === 'attachments' && <AttachmentsTab />}
      </div>
    </div>
  );
}
