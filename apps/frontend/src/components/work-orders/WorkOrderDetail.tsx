'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ClipboardCheck,
  ExternalLink,
  Building2,
  Calendar,
  DollarSign,
  FileSignature,
  Hash,
  Layers,
  Package,
  Phone,
  Plus,
  User,
  Users,
  Loader2,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import { BackButton } from '@/components/layout/BackButton';
import { SetHeaderActions } from '@/components/layout/SetHeaderActions';
import {
  DefRow,
  SectionCard,
  formatDate,
  formatDateTime,
  formatCurrency,
  formatAddress,
  pick,
  asString,
  type Dict,
} from '@/components/shared/detail';
import { updateWorkOrderStatusAction } from '@/app/(app)/mutations-status';
import { InvoiceFormDrawer } from '@/components/forms/InvoiceFormDrawer';
import type { WorkOrder, Job } from '@/types/api';
import { PrintButton } from '@/components/shared/PrintButton';
import { ArchiveEntityButton } from '@/components/shared/ArchiveEntityButton';
import { jobDisplayName } from '@/components/shared/job-label';
import { QuoteLineItemsTable } from '@/components/quotes/QuoteLineItemsTable';
import type { ApiGroup } from '@/components/quotes/quote-line-items.types';
import { groupsFromDocumentPayload } from '@/components/quotes/quote-line-items.utils';
import { getWorkOrderLineItemsAction } from '@/app/(app)/work-orders/actions';

// ---------- helpers ---------------------------------------------------------

function getPayload(wo: WorkOrder): Dict {
  return (wo.workOrderPayload as Dict | undefined) ?? {};
}

function getParty(wo: WorkOrder, key: 'woTo' | 'woFor' | 'woFrom'): Dict {
  return (wo[key] as Dict | undefined) ?? {};
}

function getServiceWindow(wo: WorkOrder): Dict {
  return (wo.serviceWindow as Dict | undefined) ?? {};
}

function lookupName(
  joined: WorkOrder['status'] | WorkOrder['workOrderType'],
  payload: Dict,
  payloadKey: string,
): string | undefined {
  const fromJoin = joined?.name;
  if (fromJoin) return fromJoin;
  const block = payload[payloadKey] as Dict | undefined;
  return asString(block?.name) ?? asString(payload[payloadKey]);
}

function sourceOrgName(wo: WorkOrder): string | undefined {
  const payload = getPayload(wo);
  return (
    asString(wo.sourceExternalReference) ??
    asString((payload.sourceOrganisation as Dict | undefined)?.name) ??
    asString(payload.sourceOrganisationName)
  );
}

function partyAddress(party: Dict): string {
  return formatAddress(party);
}

// ---------- header ----------------------------------------------------------

export function WorkOrderPageHeader({ wo, job }: { wo: WorkOrder; job?: Job | null }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [showInvoiceForm, setShowInvoiceForm] = useState(false);
  const payload = getPayload(wo);
  const title = wo.workOrderNumber ?? wo.externalId ?? wo.id;
  const status = lookupName(wo.status, payload, 'status') ?? 'Unknown';
  const woType = lookupName(wo.workOrderType, payload, 'workOrderType');
  const source = sourceOrgName(wo);
  const total = formatCurrency(wo.totalAmount);
  const jobName = job?.name?.trim() || job?.externalReference?.trim() || undefined;
  const jobNameById =
    wo.jobId && jobName ? { [wo.jobId]: jobName } : undefined;

  async function handleStatusChange(newStatus: string) {
    setLoading(true);
    const result = await updateWorkOrderStatusAction(wo.id, newStatus);
    if (!result.success) {
      console.error('[frontend:WorkOrderPageHeader.handleStatusChange]', result.error);
    }
    router.refresh();
    setLoading(false);
  }

  return (
    <>
      <SetHeaderActions>
        {status === 'Issued' && (
          <>
            <Button
              size="default"
              disabled={loading}
              className="h-9 gap-1.5 px-4 bg-blue-600 text-white hover:bg-blue-500"
              onClick={() => handleStatusChange('Accepted')}
            >
              Accept
            </Button>
            <Button
              size="default"
              variant="destructive"
              disabled={loading}
              className="h-9 gap-1.5 px-4"
              onClick={() => handleStatusChange('Rejected')}
            >
              Decline
            </Button>
          </>
        )}
        {status === 'Accepted' && (
          <Button
            size="default"
            disabled={loading}
            className="h-9 gap-1.5 px-4 bg-blue-600 text-white hover:bg-blue-500"
            onClick={() => handleStatusChange('In Progress')}
          >
            Start Work
          </Button>
        )}
        {status === 'In Progress' && (
          <Button
            size="default"
            disabled={loading}
            className="h-9 gap-1.5 px-4 bg-blue-600 text-white hover:bg-blue-500"
            onClick={() => handleStatusChange('Completed')}
          >
            Complete
          </Button>
        )}
        <Button
          size="default"
          onClick={() => setShowInvoiceForm(true)}
          className="h-9 gap-1.5 px-4 bg-blue-600 text-white hover:bg-blue-500"
        >
          <Plus className="h-3.5 w-3.5" />
          Create Invoice
        </Button>
        <PrintButton documentType="work_order" entityId={wo.id} />
        <ArchiveEntityButton
          entityType="work_order"
          entityId={wo.id}
          statusName={status}
          entityLabel={title}
          redirectTo={job ? `/work-orders?jobId=${job.id}` : '/work-orders'}
        />
      </SetHeaderActions>
      <InvoiceFormDrawer
        open={showInvoiceForm}
        onOpenChange={setShowInvoiceForm}
        workOrders={[wo]}
        jobNameById={jobNameById}
        defaultWorkOrderId={wo.id}
      />
      <div className="flex w-full min-w-0 flex-col gap-y-1">
        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
          <BackButton href={job ? `/work-orders?jobId=${job.id}` : '/work-orders'} label="Back to work orders" />
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-100">
            <ClipboardCheck className="h-4 w-4 text-indigo-600" />
          </span>
          <h1 className="truncate text-lg font-semibold leading-tight">{title}</h1>
          {wo.externalId && wo.externalId !== title && (
            <span className="font-mono text-xs text-muted-foreground">· {wo.externalId}</span>
          )}
          <StatusBadge status={status} />
          {woType && (
            <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground">
              <Package className="h-3 w-3" />
              {woType}
            </span>
          )}
          {source && (
            <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground">
              <Building2 className="h-3 w-3" />
              {source}
            </span>
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
          {wo.claimId && (
            <Link
              href={`/claims/${wo.claimId}`}
              className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
            >
              View Claim
              <ExternalLink className="h-3 w-3" />
            </Link>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1 pl-20 text-xs">
          <div className="flex items-baseline gap-1">
            <span className="text-muted-foreground">Total:</span>
            <span className="font-medium">{total}</span>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-muted-foreground">Start:</span>
            <span className="font-medium">{formatDate(wo.startDate)}</span>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-muted-foreground">End:</span>
            <span className="font-medium">{formatDate(wo.endDate)}</span>
          </div>
        </div>
      </div>
    </>
  );
}

// ---------- tabs ------------------------------------------------------------

function OverviewTab({ wo }: { wo: WorkOrder }) {
  const payload = getPayload(wo);
  const status = lookupName(wo.status, payload, 'status') ?? 'Unknown';
  const woType = lookupName(wo.workOrderType, payload, 'workOrderType') ?? '—';
  const service = getServiceWindow(wo);
  const expiresInDays = asString(pick(service, 'expiresInDays'));

  const vendorName =
    asString((payload.vendor as Dict | undefined)?.name) ??
    asString(pick(payload, 'vendorName'));

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
            <p className="text-xs text-muted-foreground">Type</p>
            <p className="mt-1 text-sm font-medium">{woType}</p>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardContent className="px-4">
            <p className="text-xs text-muted-foreground">Total</p>
            <p className="mt-1 text-sm font-medium">{formatCurrency(wo.totalAmount)}</p>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardContent className="px-4">
            <p className="text-xs text-muted-foreground">Adjusted total</p>
            <p className="mt-1 text-sm font-medium">{formatCurrency(wo.adjustedTotal)}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <SectionCard
          title="Identifiers"
          icon={<FileSignature className="h-4 w-4 text-muted-foreground" />}
        >
          <DefRow label="WO / PO number" value={wo.workOrderNumber ?? '—'} />
          <DefRow label="External ID" value={wo.externalId ?? '—'} />
          <DefRow label="Name" value={wo.name ?? '—'} />
          <DefRow label="Status" value={status} />
          <DefRow label="Type" value={woType} />
          <DefRow label="Vendor (this tenant)" value={vendorName ?? '—'} />
        </SectionCard>

        <SectionCard
          title="Linked Entities"
          icon={<Layers className="h-4 w-4 text-muted-foreground" />}
        >
          <DefRow
            label="Job"
            value={
              wo.jobId ? (
                <Link
                  href={`/jobs/${wo.jobId}?tab=work-orders`}
                  className="inline-flex items-center gap-1 text-primary hover:underline"
                >
                  {wo.jobId}
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
              wo.claimId ? (
                <Link
                  href={`/claims/${wo.claimId}`}
                  className="inline-flex items-center gap-1 text-primary hover:underline"
                >
                  {wo.claimId}
                  <ExternalLink className="h-3 w-3" />
                </Link>
              ) : (
                '—'
              )
            }
          />
          <DefRow
            label="Source Estimate"
            value={asString(pick(payload, 'quoteReference', 'quoteId', 'sourceQuoteId')) ?? '—'}
          />
        </SectionCard>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <SectionCard
          title="Service Window"
          icon={<Calendar className="h-4 w-4 text-muted-foreground" />}
        >
          <DefRow label="Start date" value={formatDate(wo.startDate)} />
          <DefRow label="End date" value={formatDate(wo.endDate)} />
          <DefRow label="Start time" value={wo.startTime ?? '—'} />
          <DefRow label="End time" value={wo.endTime ?? '—'} />
          <DefRow label="Expires in (days)" value={expiresInDays ?? '—'} />
        </SectionCard>

        <SectionCard
          title="Financial"
          icon={<DollarSign className="h-4 w-4 text-muted-foreground" />}
        >
          <DefRow label="Total" value={formatCurrency(wo.totalAmount)} />
          <DefRow label="Adjusted total" value={formatCurrency(wo.adjustedTotal)} />
          <DefRow
            label="Adjustment amount"
            value={formatCurrency(pick(payload, 'adjustedTotalAdjustmentAmount'))}
          />
        </SectionCard>
      </div>

      {wo.note ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Note</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap text-sm">{wo.note}</p>
          </CardContent>
        </Card>
      ) : null}

      {wo.scopeOfWork ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Scope of Work</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap text-sm">{wo.scopeOfWork}</p>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function PartyCard({
  title,
  party,
  icon,
}: {
  title: string;
  party: Dict;
  icon: React.ReactNode;
}) {
  const address = partyAddress(party);
  return (
    <SectionCard title={title} icon={icon}>
      <DefRow label="Name" value={asString(pick(party, 'name')) ?? '—'} />
      <DefRow label="Contact name" value={asString(pick(party, 'contactName')) ?? '—'} />
      <DefRow
        label="Company reg. #"
        value={asString(pick(party, 'companyRegistrationNumber')) ?? '—'}
      />
      <DefRow label="Phone" value={asString(pick(party, 'phoneNumber')) ?? '—'} />
      <DefRow label="Email" value={asString(pick(party, 'email')) ?? '—'} />
      <DefRow label="Address" value={address || '—'} />
    </SectionCard>
  );
}

function PartiesTab({ wo }: { wo: WorkOrder }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <PartyCard
        title="WO To (this tenant / vendor)"
        party={getParty(wo, 'woTo')}
        icon={<Building2 className="h-4 w-4 text-muted-foreground" />}
      />
      <PartyCard
        title="WO For (insured / customer)"
        party={getParty(wo, 'woFor')}
        icon={<User className="h-4 w-4 text-muted-foreground" />}
      />
      <PartyCard
        title="WO From (issuing upstream)"
        party={getParty(wo, 'woFrom')}
        icon={<Phone className="h-4 w-4 text-muted-foreground" />}
      />
      <SectionCard
        title="Promoted party columns"
        icon={<Hash className="h-4 w-4 text-muted-foreground" />}
      >
        <DefRow label="WO to email" value={wo.woToEmail ?? '—'} />
        <DefRow label="WO for name" value={wo.woForName ?? '—'} />
      </SectionCard>
    </div>
  );
}

function LineItemsTab({ wo }: { wo: WorkOrder }) {
  const [groups, setGroups] = useState<ApiGroup[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const fallback = groupsFromDocumentPayload(wo.workOrderPayload as Record<string, unknown> | null);
    const result = await getWorkOrderLineItemsAction(wo.id);
    if (result.success && result.groups && result.groups.length > 0) {
      setGroups(result.groups as ApiGroup[]);
      setError(null);
    } else if (fallback.length > 0) {
      setGroups(fallback);
      setError(null);
    } else {
      setGroups([]);
      setError(result.error ?? null);
    }
    setLoading(false);
  }, [wo.id, wo.workOrderPayload]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (error && (!groups || groups.length === 0)) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Line items</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-destructive">{error}</p>
        </CardContent>
      </Card>
    );
  }

  if (!groups || groups.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Line Items</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No line items found for this work order.
          </p>
        </CardContent>
      </Card>
    );
  }

  return <QuoteLineItemsTable groups={groups} readOnly />;
}

function ActivitiesTab() {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Activities</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          Tasks and appointments linked to this work order will appear here once
          the activities API is connected.
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
          Emails and messages associated with this work order will appear here
          once the communications API is connected.
        </p>
      </CardContent>
    </Card>
  );
}

function TimelineTab({ wo }: { wo: WorkOrder }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <SectionCard
        title="Local audit"
        icon={<Calendar className="h-4 w-4 text-muted-foreground" />}
      >
        <DefRow label="Created" value={formatDateTime(wo.createdAt)} />
        <DefRow label="Updated" value={formatDateTime(wo.updatedAt)} />
        <DefRow label="Deleted" value={wo.deletedAt ? formatDateTime(wo.deletedAt) : '—'} />
        <DefRow label="Created by (user id)" value={wo.createdByUserId ?? '—'} />
        <DefRow label="Updated by (user id)" value={wo.updatedByUserId ?? '—'} />
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
          Attachments linked to this work order will appear here once the
          attachments API is connected.
        </p>
      </CardContent>
    </Card>
  );
}

// ---------- container -------------------------------------------------------

type WoTab =
  | 'overview'
  | 'parties'
  | 'line-items'
  | 'activities'
  | 'communications'
  | 'timeline'
  | 'attachments';

export function WorkOrderDetail({ wo }: { wo: WorkOrder }) {
  const [tab, setTab] = useState<WoTab>('overview');

  const tabs: Array<{ id: WoTab; label: string; icon: typeof Calendar }> = [
    { id: 'overview', label: 'Overview', icon: Calendar },
    { id: 'parties', label: 'Parties', icon: Users },
    { id: 'line-items', label: 'Line Items', icon: Package },
    { id: 'activities', label: 'Activities', icon: ClipboardCheck },
    { id: 'communications', label: 'Communications', icon: FileSignature },
    { id: 'timeline', label: 'Timeline', icon: Calendar },
    { id: 'attachments', label: 'Attachments', icon: Layers },
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
                  ? 'border-indigo-600 bg-indigo-50 text-indigo-600'
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
        {tab === 'overview' && <OverviewTab wo={wo} />}
        {tab === 'parties' && <PartiesTab wo={wo} />}
        {tab === 'line-items' && <LineItemsTab wo={wo} />}
        {tab === 'activities' && <ActivitiesTab />}
        {tab === 'communications' && <CommunicationsTab />}
        {tab === 'timeline' && <TimelineTab wo={wo} />}
        {tab === 'attachments' && <AttachmentsTab />}
      </div>
    </div>
  );
}
