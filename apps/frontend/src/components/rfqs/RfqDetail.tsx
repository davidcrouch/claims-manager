'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  FileQuestion,
  ExternalLink,
  Building2,
  Calendar,
  FileSignature,
  Layers,
  Package,
  ClipboardList,
  Send,
  MessageSquare,
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
  pick,
  asString,
  type Dict,
} from '@/components/shared/detail';
import type { Rfq, Proposal } from '@/types/api';

// ---------- helpers ---------------------------------------------------------

function getPayload(rfq: Rfq): Dict {
  return (rfq.rfqPayload as Dict | undefined) ?? {};
}

function getParty(rfq: Rfq, key: 'rfqTo' | 'rfqFrom'): Dict {
  return (rfq[key] as Dict | undefined) ?? {};
}

function vendorName(rfq: Rfq): string | undefined {
  const payload = getPayload(rfq);
  const toParty = getParty(rfq, 'rfqTo');
  return (
    asString(rfq.rfqToName) ??
    asString(pick(toParty, 'name')) ??
    asString((payload.vendor as Dict | undefined)?.name) ??
    asString(pick(payload, 'vendorName'))
  );
}

// ---------- header ----------------------------------------------------------

export function RfqPageHeader({ rfq }: { rfq: Rfq }) {
  const title = rfq.rfqNumber ?? rfq.name ?? rfq.id;
  const status = rfq.status?.name ?? 'Unknown';
  const vendor = vendorName(rfq);

  return (
    <div className="flex w-full flex-wrap items-center justify-between gap-x-6 gap-y-2">
      <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
        <BackButton href="/rfqs" label="Back to RFQs" />
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-violet-100">
          <FileQuestion className="h-4 w-4 text-violet-600" />
        </span>
        <h1 className="truncate text-lg font-semibold leading-tight">{title}</h1>
        <StatusBadge status={status} />
        {vendor && (
          <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground">
            <Building2 className="h-3 w-3" />
            {vendor}
          </span>
        )}
        {rfq.jobId && (
          <Link
            href={`/jobs/${rfq.jobId}`}
            className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
          >
            View Job
            <ExternalLink className="h-3 w-3" />
          </Link>
        )}
        {rfq.quoteId && (
          <Link
            href={`/quotes/${rfq.quoteId}`}
            className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
          >
            View Source Estimate
            <ExternalLink className="h-3 w-3" />
          </Link>
        )}
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-x-5 gap-y-1 text-xs">
        <div className="flex items-baseline gap-1">
          <span className="text-muted-foreground">Sent:</span>
          <span className="font-medium">{formatDate(rfq.sentDate)}</span>
        </div>
        <div className="flex items-baseline gap-1">
          <span className="text-muted-foreground">Due:</span>
          <span className="font-medium">{formatDate(rfq.dueDate)}</span>
        </div>
        <div className="flex items-baseline gap-1">
          <span className="text-muted-foreground">Updated:</span>
          <span className="font-medium">{formatDateTime(rfq.updatedAt)}</span>
        </div>
      </div>
    </div>
  );
}

// ---------- tabs ------------------------------------------------------------

function OverviewTab({ rfq }: { rfq: Rfq }) {
  const status = rfq.status?.name ?? 'Unknown';
  const vendor = vendorName(rfq);
  const payload = getPayload(rfq);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <SectionCard
          title="RFQ Details"
          icon={<FileSignature className="h-4 w-4 text-muted-foreground" />}
        >
          <DefRow label="RFQ number" value={rfq.rfqNumber ?? '—'} />
          <DefRow label="Name" value={rfq.name ?? '—'} />
          <DefRow
            label="Status"
            value={<StatusBadge status={status} />}
          />
          <DefRow
            label="Vendor (sub)"
            value={
              rfq.vendorId ? (
                <Link
                  href={`/vendors/${rfq.vendorId}`}
                  className="inline-flex items-center gap-1 text-primary hover:underline"
                >
                  {vendor ?? rfq.vendorId}
                  <ExternalLink className="h-3 w-3" />
                </Link>
              ) : (
                vendor ?? '—'
              )
            }
          />
          <DefRow
            label="Job"
            value={
              rfq.jobId ? (
                <Link
                  href={`/jobs/${rfq.jobId}`}
                  className="inline-flex items-center gap-1 text-primary hover:underline"
                >
                  {rfq.jobId}
                  <ExternalLink className="h-3 w-3" />
                </Link>
              ) : (
                '—'
              )
            }
          />
          <DefRow
            label="Source estimate"
            value={
              rfq.quoteId ? (
                <Link
                  href={`/quotes/${rfq.quoteId}`}
                  className="inline-flex items-center gap-1 text-primary hover:underline"
                >
                  {asString(pick(payload, 'quoteNumber', 'quoteReference')) ?? rfq.quoteId}
                  <ExternalLink className="h-3 w-3" />
                </Link>
              ) : (
                '—'
              )
            }
          />
          <DefRow label="Sent date" value={formatDate(rfq.sentDate)} />
          <DefRow label="Response due" value={formatDate(rfq.dueDate)} />
          <DefRow label="Received date" value={formatDate(rfq.receivedDate)} />
          <DefRow
            label="Include pricing"
            value={rfq.includePricing ? 'Yes' : 'No'}
          />
          <DefRow
            label="Include quantities"
            value={rfq.includeQuantities ? 'Yes' : 'No'}
          />
        </SectionCard>

        <SectionCard
          title="Parties"
          icon={<Building2 className="h-4 w-4 text-muted-foreground" />}
        >
          <DefRow label="RFQ to name" value={rfq.rfqToName ?? '—'} />
          <DefRow label="RFQ to email" value={rfq.rfqToEmail ?? '—'} />
          <DefRow
            label="To contact"
            value={asString(pick(getParty(rfq, 'rfqTo'), 'contactName')) ?? '—'}
          />
          <DefRow
            label="To phone"
            value={asString(pick(getParty(rfq, 'rfqTo'), 'phoneNumber')) ?? '—'}
          />
          <DefRow
            label="From name"
            value={asString(pick(getParty(rfq, 'rfqFrom'), 'name')) ?? '—'}
          />
          <DefRow
            label="From email"
            value={asString(pick(getParty(rfq, 'rfqFrom'), 'email')) ?? '—'}
          />
        </SectionCard>
      </div>

      {rfq.note ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Note / Instructions</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap text-sm">{rfq.note}</p>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <SectionCard
          title="Audit"
          icon={<ClipboardList className="h-4 w-4 text-muted-foreground" />}
        >
          <DefRow label="Created" value={formatDateTime(rfq.createdAt)} />
          <DefRow label="Updated" value={formatDateTime(rfq.updatedAt)} />
          <DefRow label="Deleted" value={rfq.deletedAt ? formatDateTime(rfq.deletedAt) : '—'} />
          <DefRow label="Created by (user id)" value={rfq.createdByUserId ?? '—'} />
          <DefRow label="Updated by (user id)" value={rfq.updatedByUserId ?? '—'} />
        </SectionCard>
      </div>
    </div>
  );
}

function ScopeItemsTab() {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Scope Items</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          Line items selected from the parent estimate will appear here once the
          scope items API is connected. Items include name, category, quantity,
          unit type, unit cost (if pricing is included), and scope status.
        </p>
      </CardContent>
    </Card>
  );
}

function ProposalsTab({
  rfqId,
  fetchProposals,
}: {
  rfqId: string;
  fetchProposals: (rfqId: string) => Promise<Proposal[]>;
}) {
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchProposals(rfqId);
      setProposals(data ?? []);
    } finally {
      setLoading(false);
    }
  }, [rfqId, fetchProposals]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Package className="h-4 w-4 text-muted-foreground" />
          Proposals ({proposals.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="px-0">
        {loading ? (
          <p className="px-4 text-sm text-muted-foreground">Loading...</p>
        ) : proposals.length === 0 ? (
          <p className="px-4 text-sm text-muted-foreground">
            No proposals received for this RFQ.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-2">Proposal #</th>
                  <th className="px-4 py-2">Status</th>
                  <th className="px-4 py-2">Total</th>
                  <th className="px-4 py-2">Received</th>
                  <th className="px-4 py-2">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {proposals.map((p) => {
                  const statusName = p.status?.name ?? 'Unknown';
                  return (
                    <tr key={p.id} className="hover:bg-muted/30">
                      <td className="px-4 py-2 font-medium">
                        {p.proposalNumber ?? p.reference ?? p.id}
                      </td>
                      <td className="px-4 py-2">
                        <StatusBadge status={statusName} />
                      </td>
                      <td className="px-4 py-2">
                        {formatCurrency(p.totalAmount)}
                      </td>
                      <td className="px-4 py-2 text-muted-foreground">
                        {formatDate(p.receivedDate ?? p.proposalDate)}
                      </td>
                      <td className="px-4 py-2">
                        <Link
                          href={`/proposals/${p.id}`}
                          className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                        >
                          View
                          <ExternalLink className="h-3 w-3" />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
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
          Tasks and appointments linked to this RFQ will appear here once the
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
          Emails and messages associated with this RFQ will appear here once the
          communications API is connected.
        </p>
      </CardContent>
    </Card>
  );
}

function TimelineTab({ rfq }: { rfq: Rfq }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <SectionCard
        title="Local audit"
        icon={<Calendar className="h-4 w-4 text-muted-foreground" />}
      >
        <DefRow label="Created" value={formatDateTime(rfq.createdAt)} />
        <DefRow label="Updated" value={formatDateTime(rfq.updatedAt)} />
        <DefRow label="Deleted" value={rfq.deletedAt ? formatDateTime(rfq.deletedAt) : '—'} />
        <DefRow label="Created by (user id)" value={rfq.createdByUserId ?? '—'} />
        <DefRow label="Updated by (user id)" value={rfq.updatedByUserId ?? '—'} />
      </SectionCard>
    </div>
  );
}

// ---------- container -------------------------------------------------------

type RfqTab =
  | 'overview'
  | 'scope-items'
  | 'proposals'
  | 'activities'
  | 'communications'
  | 'timeline';

export function RfqDetail({
  rfq,
  fetchProposals,
}: {
  rfq: Rfq;
  fetchProposals: (rfqId: string) => Promise<Proposal[]>;
}) {
  const [tab, setTab] = useState<RfqTab>('overview');

  const tabs: Array<{ id: RfqTab; label: string; icon: typeof Calendar }> = [
    { id: 'overview', label: 'Overview', icon: FileSignature },
    { id: 'scope-items', label: 'Scope Items', icon: Layers },
    { id: 'proposals', label: 'Proposals', icon: Package },
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
        {tab === 'overview' && <OverviewTab rfq={rfq} />}
        {tab === 'scope-items' && <ScopeItemsTab />}
        {tab === 'proposals' && (
          <ProposalsTab rfqId={rfq.id} fetchProposals={fetchProposals} />
        )}
        {tab === 'activities' && <ActivitiesTab />}
        {tab === 'communications' && <CommunicationsTab />}
        {tab === 'timeline' && <TimelineTab rfq={rfq} />}
      </div>
    </div>
  );
}
