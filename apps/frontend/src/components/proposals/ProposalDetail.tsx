'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  FileInput,
  ExternalLink,
  Building2,
  Calendar,
  DollarSign,
  FileSignature,
  Layers,
  Package,
  ClipboardList,
  MessageSquare,
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
import { updateProposalStatusAction } from '@/app/(app)/mutations-status';
import type { Proposal } from '@/types/api';

// ---------- helpers ---------------------------------------------------------

function getPayload(p: Proposal): Dict {
  return (p.proposalPayload as Dict | undefined) ?? {};
}

function getParty(p: Proposal, key: 'proposalTo' | 'proposalFor' | 'proposalFrom'): Dict {
  return (p[key] as Dict | undefined) ?? {};
}

function vendorFromName(p: Proposal): string | undefined {
  const fromParty = getParty(p, 'proposalFrom');
  const payload = getPayload(p);
  return (
    asString(p.proposalFromName) ??
    asString(pick(fromParty, 'name')) ??
    asString((payload.vendor as Dict | undefined)?.name) ??
    asString(pick(payload, 'vendorName'))
  );
}

// ---------- header ----------------------------------------------------------

export function ProposalPageHeader({ proposal }: { proposal: Proposal }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const title = proposal.proposalNumber ?? proposal.reference ?? proposal.name ?? proposal.id;
  const status = proposal.status?.name ?? 'Unknown';
  const vendor = vendorFromName(proposal);

  async function handleStatusChange(newStatus: string) {
    setLoading(true);
    const result = await updateProposalStatusAction(proposal.id, newStatus);
    if (!result.success) {
      console.error('[frontend:ProposalPageHeader.handleStatusChange]', result.error);
    }
    router.refresh();
    setLoading(false);
  }

  const showActions = status === 'Under Review' || status === 'Received';

  return (
    <div className="flex w-full flex-wrap items-center justify-between gap-x-6 gap-y-2">
      <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
        <BackButton href="/proposals" label="Back to proposals" />
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-violet-100">
          <FileInput className="h-4 w-4 text-violet-600" />
        </span>
        <h1 className="truncate text-lg font-semibold leading-tight">{title}</h1>
        <StatusBadge status={status} />
        {vendor && (
          <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground">
            <Building2 className="h-3 w-3" />
            {vendor}
          </span>
        )}
        {proposal.rfqId && (
          <Link
            href={`/rfqs/${proposal.rfqId}`}
            className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
          >
            View RFQ
            <ExternalLink className="h-3 w-3" />
          </Link>
        )}
        {proposal.jobId && (
          <Link
            href={`/jobs/${proposal.jobId}`}
            className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
          >
            View Job
            <ExternalLink className="h-3 w-3" />
          </Link>
        )}
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-x-5 gap-y-1">
        <div className="flex items-baseline gap-1 text-xs">
          <span className="text-muted-foreground">Total:</span>
          <span className="font-medium">{formatCurrency(proposal.totalAmount)}</span>
        </div>
        <div className="flex items-baseline gap-1 text-xs">
          <span className="text-muted-foreground">Received:</span>
          <span className="font-medium">{formatDate(proposal.receivedDate ?? proposal.proposalDate)}</span>
        </div>
        <div className="flex items-baseline gap-1 text-xs">
          <span className="text-muted-foreground">Updated:</span>
          <span className="font-medium">{formatDateTime(proposal.updatedAt)}</span>
        </div>
        {showActions && (
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              disabled={loading}
              className="bg-green-600 text-white hover:bg-green-700"
              onClick={() => handleStatusChange('Accepted')}
            >
              Accept
            </Button>
            <Button
              size="sm"
              variant="destructive"
              disabled={loading}
              onClick={() => handleStatusChange('Rejected')}
            >
              Reject
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={loading}
              onClick={() => handleStatusChange('Revision Requested')}
            >
              Request Revision
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------- tabs ------------------------------------------------------------

function OverviewTab({ proposal }: { proposal: Proposal }) {
  const payload = getPayload(proposal);
  const status = proposal.status?.name ?? 'Unknown';
  const vendor = vendorFromName(proposal);
  const proposalType = proposal.proposalType?.name;

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
            <p className="text-xs text-muted-foreground">Total</p>
            <p className="mt-1 text-sm font-medium">{formatCurrency(proposal.totalAmount)}</p>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardContent className="px-4">
            <p className="text-xs text-muted-foreground">Sub-total</p>
            <p className="mt-1 text-sm font-medium">{formatCurrency(proposal.subTotal)}</p>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardContent className="px-4">
            <p className="text-xs text-muted-foreground">Tax</p>
            <p className="mt-1 text-sm font-medium">{formatCurrency(proposal.totalTax)}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <SectionCard
          title="Proposal Details"
          icon={<FileSignature className="h-4 w-4 text-muted-foreground" />}
        >
          <DefRow label="Proposal number" value={proposal.proposalNumber ?? proposal.reference ?? '—'} />
          <DefRow label="Name" value={proposal.name ?? '—'} />
          <DefRow label="Status" value={<StatusBadge status={status} />} />
          {proposalType && <DefRow label="Type" value={proposalType} />}
          <DefRow
            label="Vendor (from)"
            value={
              proposal.vendorId ? (
                <Link
                  href={`/vendors/${proposal.vendorId}`}
                  className="inline-flex items-center gap-1 text-primary hover:underline"
                >
                  {vendor ?? proposal.vendorId}
                  <ExternalLink className="h-3 w-3" />
                </Link>
              ) : (
                vendor ?? '—'
              )
            }
          />
          <DefRow
            label="RFQ"
            value={
              proposal.rfqId ? (
                <Link
                  href={`/rfqs/${proposal.rfqId}`}
                  className="inline-flex items-center gap-1 text-primary hover:underline"
                >
                  {proposal.rfqId}
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
              proposal.jobId ? (
                <Link
                  href={`/jobs/${proposal.jobId}`}
                  className="inline-flex items-center gap-1 text-primary hover:underline"
                >
                  {proposal.jobId}
                  <ExternalLink className="h-3 w-3" />
                </Link>
              ) : (
                '—'
              )
            }
          />
          <DefRow label="Received date" value={formatDate(proposal.receivedDate)} />
          <DefRow label="Proposal date" value={formatDate(proposal.proposalDate)} />
          <DefRow
            label="Expires in (days)"
            value={proposal.expiresInDays != null ? String(proposal.expiresInDays) : '—'}
          />
        </SectionCard>

        <SectionCard
          title="Financial"
          icon={<DollarSign className="h-4 w-4 text-muted-foreground" />}
        >
          <DefRow label="Total" value={formatCurrency(proposal.totalAmount)} />
          <DefRow label="Sub-total" value={formatCurrency(proposal.subTotal)} />
          <DefRow label="Total tax" value={formatCurrency(proposal.totalTax)} />
        </SectionCard>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <SectionCard
          title="Parties"
          icon={<Building2 className="h-4 w-4 text-muted-foreground" />}
        >
          <DefRow label="To name" value={proposal.proposalToName ?? asString(pick(getParty(proposal, 'proposalTo'), 'name')) ?? '—'} />
          <DefRow label="To email" value={proposal.proposalToEmail ?? asString(pick(getParty(proposal, 'proposalTo'), 'email')) ?? '—'} />
          <DefRow label="From name" value={proposal.proposalFromName ?? asString(pick(getParty(proposal, 'proposalFrom'), 'name')) ?? '—'} />
          <DefRow label="From email" value={asString(pick(getParty(proposal, 'proposalFrom'), 'email')) ?? '—'} />
          <DefRow label="For name" value={asString(pick(getParty(proposal, 'proposalFor'), 'name')) ?? '—'} />
        </SectionCard>

        <SectionCard
          title="Audit"
          icon={<ClipboardList className="h-4 w-4 text-muted-foreground" />}
        >
          <DefRow label="Created" value={formatDateTime(proposal.createdAt)} />
          <DefRow label="Updated" value={formatDateTime(proposal.updatedAt)} />
          <DefRow label="Deleted" value={proposal.deletedAt ? formatDateTime(proposal.deletedAt) : '—'} />
          <DefRow label="Created by (user id)" value={proposal.createdByUserId ?? '—'} />
          <DefRow label="Updated by (user id)" value={proposal.updatedByUserId ?? '—'} />
        </SectionCard>
      </div>

      {proposal.note ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Note</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap text-sm">{proposal.note}</p>
          </CardContent>
        </Card>
      ) : null}
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
          Proposal line items follow the same group / combo / item hierarchy as
          Estimates/Quotes, showing the sub-contractor&apos;s pricing. They will be
          rendered here once the line items API is connected.
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
          Tasks and appointments linked to this proposal will appear here once
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
          Emails and messages associated with this proposal will appear here
          once the communications API is connected.
        </p>
      </CardContent>
    </Card>
  );
}

function TimelineTab({ proposal }: { proposal: Proposal }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <SectionCard
        title="Local audit"
        icon={<Calendar className="h-4 w-4 text-muted-foreground" />}
      >
        <DefRow label="Created" value={formatDateTime(proposal.createdAt)} />
        <DefRow label="Updated" value={formatDateTime(proposal.updatedAt)} />
        <DefRow label="Deleted" value={proposal.deletedAt ? formatDateTime(proposal.deletedAt) : '—'} />
        <DefRow label="Created by (user id)" value={proposal.createdByUserId ?? '—'} />
        <DefRow label="Updated by (user id)" value={proposal.updatedByUserId ?? '—'} />
      </SectionCard>
    </div>
  );
}

// ---------- container -------------------------------------------------------

type ProposalTab =
  | 'overview'
  | 'line-items'
  | 'activities'
  | 'communications'
  | 'timeline';

export function ProposalDetail({ proposal }: { proposal: Proposal }) {
  const [tab, setTab] = useState<ProposalTab>('overview');

  const tabs: Array<{ id: ProposalTab; label: string; icon: typeof Calendar }> = [
    { id: 'overview', label: 'Overview', icon: FileSignature },
    { id: 'line-items', label: 'Line Items', icon: Package },
    { id: 'activities', label: 'Activities', icon: ClipboardList },
    { id: 'communications', label: 'Communications', icon: MessageSquare },
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
                  ? 'border-violet-600 bg-violet-50 text-violet-600'
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
        {tab === 'overview' && <OverviewTab proposal={proposal} />}
        {tab === 'line-items' && <LineItemsTab />}
        {tab === 'activities' && <ActivitiesTab />}
        {tab === 'communications' && <CommunicationsTab />}
        {tab === 'timeline' && <TimelineTab proposal={proposal} />}
      </div>
    </div>
  );
}
