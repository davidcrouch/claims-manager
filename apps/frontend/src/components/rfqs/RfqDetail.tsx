'use client';

import { useState, useEffect, useCallback, useMemo, useRef, type MutableRefObject } from 'react';
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
  MessageSquare,
  Loader2,
  Save,
  Pencil,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusBadge } from '@/components/ui/status-badge';
import { BackButton } from '@/components/layout/BackButton';
import { SetHeaderActions } from '@/components/layout/SetHeaderActions';
import { Button } from '@/components/ui/button';
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
import type { Rfq, Proposal, Job, Quote } from '@/types/api';
import { PrintButton } from '@/components/shared/PrintButton';
import { ArchiveEntityButton } from '@/components/shared/ArchiveEntityButton';
import { jobDisplayName } from '@/components/shared/job-label';
import type { ApiGroup } from '@/components/quotes/quote-line-items.types';
import { QuoteLineItemsTable } from '@/components/quotes/QuoteLineItemsTable';
import {
  fetchRfqLineItemsAction,
  replaceRfqLineItemsAction,
} from '@/app/(app)/rfqs/[id]/actions';
import { getQuoteLineItemsAction } from '@/app/(app)/quotes/actions';

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

export function RfqPageHeader({ rfq, job }: { rfq: Rfq; job?: Job | null }) {
  const title = rfq.rfqNumber ?? rfq.name ?? rfq.id;
  const status = rfq.status?.name ?? 'Unknown';
  const vendor = vendorName(rfq);

  return (
    <div className="flex w-full min-w-0 flex-col gap-y-1">
      <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
        <BackButton href={job ? `/rfqs?jobId=${job.id}` : '/rfqs'} label="Back to RFQs" />
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
        {job && (
          <Link
            href={`/jobs/${job.id}`}
            className="inline-flex items-center gap-1 text-xs uppercase text-primary hover:underline"
          >
            {jobDisplayName(job)}
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
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 pl-20 text-xs">
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

function quoteDisplayName(quote: Quote): string {
  return (
    quote.name?.trim() ||
    quote.quoteNumber?.trim() ||
    quote.reference?.trim() ||
    quote.id
  );
}

function OverviewTab({
  rfq,
  job,
  quote,
}: {
  rfq: Rfq;
  job?: Job | null;
  quote?: Quote | null;
}) {
  const status = rfq.status?.name ?? 'Unknown';
  const vendor = vendorName(rfq);
  const payload = getPayload(rfq);
  const jobLabel = job ? jobDisplayName(job) : rfq.jobId;
  const estimateLabel =
    quote
      ? quoteDisplayName(quote)
      : asString(pick(payload, 'quoteNumber', 'quoteReference', 'quoteName')) ?? rfq.quoteId;

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
                  {jobLabel}
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
                  {estimateLabel}
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

type ScopeSaveControls = {
  canSave: boolean;
  saving: boolean;
  estimateLoading: boolean;
  canEdit: boolean;
};

function ScopeItemsTab({
  rfqId,
  quoteId,
  editing,
  onSaveControlsChange,
  onSaveSuccess,
  saveRef,
  cancelRef,
}: {
  rfqId: string;
  quoteId: string | null;
  editing: boolean;
  onSaveControlsChange?: (controls: ScopeSaveControls | null) => void;
  onSaveSuccess?: () => void;
  saveRef?: MutableRefObject<(() => void) | null>;
  cancelRef?: MutableRefObject<(() => void) | null>;
}) {
  const [rfqGroups, setRfqGroups] = useState<ApiGroup[] | null>(null);
  const [estimateGroups, setEstimateGroups] = useState<ApiGroup[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [estimateLoading, setEstimateLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchRfqLineItemsAction(rfqId);
      if (result.success && result.groups) {
        setRfqGroups(result.groups as unknown as ApiGroup[]);
      } else {
        setError(result.error ?? 'Failed to load scope items');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load scope items');
    } finally {
      setLoading(false);
    }
  }, [rfqId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!editing || !quoteId || estimateGroups) return;
    let cancelled = false;
    setEstimateLoading(true);
    getQuoteLineItemsAction(quoteId)
      .then((result) => {
        if (cancelled) return;
        if (result.success && result.groups) {
          setEstimateGroups(result.groups as unknown as ApiGroup[]);
        }
      })
      .finally(() => { if (!cancelled) setEstimateLoading(false); });
    return () => { cancelled = true; };
  }, [editing, quoteId, estimateGroups]);

  const rfqSourceIds = useMemo(() => {
    if (!rfqGroups) return new Set<string>();
    return collectSourceQuoteIds(rfqGroups);
  }, [rfqGroups]);

  useEffect(() => {
    setSelectedIds(new Set(rfqSourceIds));
  }, [rfqSourceIds]);

  const displayGroups = useMemo(() => {
    if (!estimateGroups) return rfqGroups;
    if (editing) return estimateGroups;
    return filterGroupsBySelectedIds(estimateGroups, selectedIds);
  }, [editing, estimateGroups, rfqGroups, selectedIds]);

  const selectionDirty = useMemo(() => {
    if (selectedIds.size !== rfqSourceIds.size) return true;
    for (const id of selectedIds) {
      if (!rfqSourceIds.has(id)) return true;
    }
    return false;
  }, [selectedIds, rfqSourceIds]);

  const handleSaveScope = useCallback(async () => {
    if (selectedIds.size === 0) {
      setSaveError('Select at least one scope item');
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      const result = await replaceRfqLineItemsAction(rfqId, Array.from(selectedIds));
      if (!result.success) {
        setSaveError(result.error ?? 'Failed to update scope items');
        return;
      }
      setRfqGroups((result.groups as unknown as ApiGroup[]) ?? []);
      onSaveSuccess?.();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to update scope items');
    } finally {
      setSaving(false);
    }
  }, [rfqId, selectedIds, onSaveSuccess]);

  const handleCancelEdit = useCallback(() => {
    setSelectedIds(new Set(rfqSourceIds));
    setSaveError(null);
  }, [rfqSourceIds]);

  const canSave = selectionDirty && !saving && selectedIds.size > 0;
  const canEdit = !!quoteId && !!rfqGroups && rfqGroups.length > 0 && !loading && !error;

  useEffect(() => {
    if (saveRef) {
      saveRef.current = quoteId ? () => void handleSaveScope() : null;
    }
  }, [saveRef, quoteId, handleSaveScope]);

  useEffect(() => {
    if (cancelRef) {
      cancelRef.current = handleCancelEdit;
    }
  }, [cancelRef, handleCancelEdit]);

  useEffect(() => {
    if (!onSaveControlsChange) return;
    onSaveControlsChange({
      canSave,
      saving,
      estimateLoading,
      canEdit,
    });
  }, [onSaveControlsChange, canSave, saving, estimateLoading, canEdit]);

  useEffect(() => {
    return () => {
      onSaveControlsChange?.(null);
      if (saveRef) saveRef.current = null;
      if (cancelRef) cancelRef.current = null;
    };
  }, [onSaveControlsChange, saveRef, cancelRef]);

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Scope Items</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-destructive">{error}</p>
        </CardContent>
      </Card>
    );
  }

  if (!rfqGroups || rfqGroups.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Scope Items</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No scope items have been added to this RFQ.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {saveError && (
        <p className="text-sm text-destructive">{saveError}</p>
      )}
      {estimateLoading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Loading estimate line items...
        </div>
      )}
      <QuoteLineItemsTable
        groups={displayGroups ?? []}
        readOnly
        selection={
          editing && estimateGroups
            ? { selectedIds, onChange: setSelectedIds }
            : undefined
        }
      />
    </div>
  );
}

/**
 * Collect source quote IDs from RFQ scope items.
 * The API returns `sourceQuoteItemId` / `sourceQuoteComboId` on each RFQ item/combo
 * which reference the original estimate item IDs.
 */
function collectSourceQuoteIds(groups: ApiGroup[]): Set<string> {
  const ids = new Set<string>();
  const collectCombo = (combo: NonNullable<ApiGroup['combos']>[number]) => {
    const comboSrc = (combo as Record<string, unknown>).sourceQuoteComboId;
    if (typeof comboSrc === 'string') ids.add(comboSrc);
    else if (combo.id) ids.add(combo.id);
    for (const item of combo.items ?? []) {
      const src = (item as Record<string, unknown>).sourceQuoteItemId;
      if (typeof src === 'string') ids.add(src);
      else if (item.id) ids.add(item.id);
    }
  };
  for (const group of groups) {
    for (const item of group.items ?? []) {
      const src = (item as Record<string, unknown>).sourceQuoteItemId;
      if (typeof src === 'string') ids.add(src);
      else if (item.id) ids.add(item.id);
    }
    for (const combo of group.combos ?? []) collectCombo(combo);
    for (const scope of group.scopes ?? []) {
      const scopeSrc = (scope as Record<string, unknown>).sourceQuoteComboId;
      if (typeof scopeSrc === 'string') ids.add(scopeSrc);
      else if (scope.id) ids.add(scope.id);
      for (const item of scope.items ?? []) {
        const src = (item as Record<string, unknown>).sourceQuoteItemId;
        if (typeof src === 'string') ids.add(src);
        else if (item.id) ids.add(item.id);
      }
      for (const combo of scope.combos ?? []) collectCombo(combo);
    }
  }
  return ids;
}

/** Keep only selected items/combos; drop empty groups. */
function filterGroupsBySelectedIds(groups: ApiGroup[], selectedIds: Set<string>): ApiGroup[] {
  return groups
    .map((group) => {
      const items = (group.items ?? []).filter((item) => item.id && selectedIds.has(item.id));
      const combos = (group.combos ?? [])
        .map((combo) => {
          const childItems = (combo.items ?? []).filter(
            (item) => item.id && selectedIds.has(item.id),
          );
          const comboSelected = !!combo.id && selectedIds.has(combo.id);
          if (!comboSelected && childItems.length === 0) return null;
          return { ...combo, items: childItems };
        })
        .filter(Boolean) as NonNullable<ApiGroup['combos']>;
      const scopes = (group.scopes ?? [])
        .map((scope) => {
          const childItems = (scope.items ?? []).filter(
            (item) => item.id && selectedIds.has(item.id),
          );
          const childCombos = (scope.combos ?? [])
            .map((combo) => {
              const comboItems = (combo.items ?? []).filter(
                (item) => item.id && selectedIds.has(item.id),
              );
              const comboSelected = !!combo.id && selectedIds.has(combo.id);
              if (!comboSelected && comboItems.length === 0) return null;
              return { ...combo, items: comboItems };
            })
            .filter(Boolean) as NonNullable<ApiGroup['combos']>;
          const scopeSelected = !!scope.id && selectedIds.has(scope.id);
          if (!scopeSelected && childItems.length === 0 && childCombos.length === 0) return null;
          return { ...scope, items: childItems, combos: childCombos };
        })
        .filter(Boolean) as NonNullable<ApiGroup['scopes']>;
      if (items.length === 0 && combos.length === 0 && scopes.length === 0) return null;
      return { ...group, items, combos, scopes };
    })
    .filter(Boolean) as ApiGroup[];
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
  job,
  quote,
  fetchProposals,
}: {
  rfq: Rfq;
  job?: Job | null;
  quote?: Quote | null;
  fetchProposals: (rfqId: string) => Promise<Proposal[]>;
}) {
  const [tab, setTab] = useState<RfqTab>('overview');
  const [editing, setEditing] = useState(false);
  const [scopeSave, setScopeSave] = useState<ScopeSaveControls | null>(null);
  const scopeSaveRef = useRef<(() => void) | null>(null);
  const scopeCancelRef = useRef<(() => void) | null>(null);

  const handleScopeSaveControls = useCallback((controls: ScopeSaveControls | null) => {
    setScopeSave((prev) => {
      if (
        prev?.canSave === controls?.canSave &&
        prev?.saving === controls?.saving &&
        prev?.estimateLoading === controls?.estimateLoading &&
        prev?.canEdit === controls?.canEdit
      ) {
        return prev;
      }
      return controls;
    });
  }, []);

  useEffect(() => {
    if (tab !== 'scope-items') setEditing(false);
  }, [tab]);

  const handleCancel = useCallback(() => {
    scopeCancelRef.current?.();
    setEditing(false);
  }, []);

  const handleSaveSuccess = useCallback(() => {
    setEditing(false);
  }, []);

  const handleTabChange = useCallback((next: RfqTab) => {
    if (editing) {
      scopeCancelRef.current?.();
      setEditing(false);
    }
    setTab(next);
  }, [editing]);

  const tabs: Array<{ id: RfqTab; label: string; icon: typeof Calendar }> = [
    { id: 'overview', label: 'Overview', icon: FileSignature },
    { id: 'scope-items', label: 'Scope Items', icon: Layers },
    { id: 'proposals', label: 'Proposals', icon: Package },
    { id: 'activities', label: 'Activities', icon: ClipboardList },
    { id: 'communications', label: 'Communications', icon: MessageSquare },
    { id: 'timeline', label: 'Timeline', icon: Calendar },
  ];

  const showScopeActions = tab === 'scope-items' && (scopeSave?.canEdit ?? !!rfq.quoteId);

  return (
    <div className="flex flex-col">
      <SetHeaderActions>
        {showScopeActions && (
          editing ? (
            <>
              <Button
                size="default"
                variant="outline"
                onClick={handleCancel}
                disabled={scopeSave?.saving}
                className="h-9 gap-1.5 px-4"
              >
                Cancel
              </Button>
              <Button
                size="default"
                onClick={() => scopeSaveRef.current?.()}
                disabled={!scopeSave?.canSave}
                className="h-9 gap-1.5 px-4 bg-blue-600 text-white hover:bg-blue-500"
              >
                {scopeSave?.saving ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Save className="h-3.5 w-3.5" />
                )}
                {scopeSave?.saving ? 'Saving...' : 'Save Scope'}
              </Button>
            </>
          ) : (
            <Button
              size="default"
              onClick={() => setEditing(true)}
              className="h-9 gap-1.5 px-4 bg-blue-600 text-white hover:bg-blue-500"
            >
              <Pencil className="h-3.5 w-3.5" />
              Edit
            </Button>
          )
        )}
        <PrintButton documentType="rfq" entityId={rfq.id} jobId={job?.id} />
        <ArchiveEntityButton
          entityType="rfq"
          entityId={rfq.id}
          statusName={rfq.status?.name}
          entityLabel={rfq.rfqNumber ?? rfq.name ?? undefined}
          redirectTo="/rfqs"
        />
      </SetHeaderActions>
      <div className="flex flex-wrap gap-0 border-b border-slate-200">
        {tabs.map((t) => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => handleTabChange(t.id)}
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
        {tab === 'overview' && <OverviewTab rfq={rfq} job={job} quote={quote} />}
        {tab === 'scope-items' && (
          <ScopeItemsTab
            rfqId={rfq.id}
            quoteId={rfq.quoteId ?? null}
            editing={editing}
            onSaveControlsChange={handleScopeSaveControls}
            onSaveSuccess={handleSaveSuccess}
            saveRef={scopeSaveRef}
            cancelRef={scopeCancelRef}
          />
        )}
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
