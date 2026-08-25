'use client';

import {
  useEffect,
  useState,
  useImperativeHandle,
  forwardRef,
  type Ref,
} from 'react';
import {
  FileSignature,
  Calculator,
  CalendarClock,
  ShieldCheck,
  StickyNote,
} from 'lucide-react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { TypeBadge } from '@/components/ui/type-badge';
import {
  DefRow,
  SectionCard,
  BoolPill,
  formatDate,
  formatDateTime,
  formatCurrency,
  pick,
  asString,
  asBool,
  type Dict,
} from '@/components/shared/detail';
import { EditText, EditTextarea } from '@/components/jobs/JobEditControls';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { OrgUserLabel } from '@/components/shared/DetailAssignee';
import type { Quote } from '@/types/api';
import {
  QUOTE_TYPES,
  applyPendingToOverviewDraft,
  toInputDate,
  type QuoteEditPending,
  type QuoteOverviewDraft,
} from '@/components/quotes/quote-edit.types';

export interface QuoteOverviewTabHandle {
  getPendingUpdate: () => QuoteEditPending | null;
  getBaseline: () => QuoteOverviewDraft;
  applyDraft: (draft: QuoteOverviewDraft) => void;
  reset: () => void;
  markClean: (saved?: QuoteEditPending | null) => void;
  isDirty: () => boolean;
}

function getApi(quote: Quote): Dict {
  return (quote.apiPayload as Dict | undefined) ?? {};
}

function getScheduleInfo(quote: Quote) {
  const bucket = (quote.scheduleInfo as Dict | undefined) ?? {};
  const api = getApi(quote);
  return {
    estimatedStartDate:
      asString(bucket.estimatedStartDate) ?? asString(api.estimatedStartDate),
    estimatedCompletionDate:
      asString(bucket.estimatedCompletionDate) ??
      asString(api.estimatedCompletionDate),
    reasonForVariation:
      asString(bucket.reasonForVariation) ?? asString(api.reasonForVariation),
  };
}

function getApprovalInfo(quote: Quote) {
  const bucket = (quote.approvalInfo as Dict | undefined) ?? {};
  const api = getApi(quote);
  const apiStatus = (api.status as Dict | undefined) ?? {};
  const apiQuoteType =
    ((api.quoteType as Dict | undefined) ??
      (api.quoteTypeId as Dict | undefined)) ??
    {};
  const apiCreatedBy = (api.createdBy as Dict | undefined) ?? {};
  const apiUpdatedBy = (api.updatedBy as Dict | undefined) ?? {};
  return {
    isAutoApproved:
      asBool(bucket.isAutoApproved) ?? asBool(api.isAutoApproved),
    statusType: asString(bucket.statusType) ?? asString(apiStatus.type),
    statusName: asString(bucket.statusName) ?? asString(apiStatus.name),
    quoteTypeName:
      asString(bucket.quoteTypeName) ?? asString(apiQuoteType.name),
    createdByName:
      asString(bucket.createdByName) ?? asString(apiCreatedBy.name),
    createdByExternalReference:
      asString(bucket.createdByExternalReference) ??
      asString(apiCreatedBy.externalReference),
    updatedByName:
      asString(bucket.updatedByName) ?? asString(apiUpdatedBy.name),
    updatedByExternalReference:
      asString(bucket.updatedByExternalReference) ??
      asString(apiUpdatedBy.externalReference),
  };
}

function resolveQuoteType(quote: Quote): string {
  const approval = getApprovalInfo(quote);
  const custom = (quote.customData as Dict | undefined) ?? {};
  const fromCustom = custom.quoteType;
  if (typeof fromCustom === 'string' && fromCustom) return fromCustom;
  if (fromCustom && typeof fromCustom === 'object') {
    const o = fromCustom as Dict;
    return (
      asString(o.externalReference) ??
      asString(o.name) ??
      ''
    );
  }
  return (
    quote.quoteType?.name ??
    quote.quoteType?.externalReference ??
    approval.quoteTypeName ??
    ''
  );
}

function buildInitialDraft(quote: Quote): QuoteOverviewDraft {
  const schedule = getScheduleInfo(quote);
  return {
    name: quote.name ?? '',
    reference: quote.reference ?? '',
    note: quote.note ?? '',
    quoteType: resolveQuoteType(quote),
    estimateDate: toInputDate(quote.quoteDate),
    expiresInDays:
      typeof quote.expiresInDays === 'number' ? String(quote.expiresInDays) : '',
    estimatedStartDate: toInputDate(
      quote.estimatedStartDate ?? schedule.estimatedStartDate ?? null,
    ),
    estimatedCompletionDate: toInputDate(
      quote.estimatedCompletionDate ?? schedule.estimatedCompletionDate ?? null,
    ),
    reasonForVariation: schedule.reasonForVariation ?? '',
  };
}

export const QuoteOverviewTab = forwardRef(function QuoteOverviewTab(
  {
    quote,
    editing = false,
    saving = false,
    onDirtyChange,
  }: {
    quote: Quote;
    editing?: boolean;
    saving?: boolean;
    onDirtyChange?: (dirty: boolean) => void;
  },
  ref: Ref<QuoteOverviewTabHandle>,
) {
  const approval = getApprovalInfo(quote);
  const statusName = quote.status?.name ?? approval.statusName ?? 'Unknown';
  const custom = (quote.customData as Dict | undefined) ?? {};
  const insurerRef = asString(pick(custom, 'cwExternalReference'));
  const cwCreated = asString(pick(custom, 'cwCreatedAtDate'));
  const cwUpdated = asString(pick(custom, 'cwUpdatedAtDate'));
  const autoApproved = asBool(quote.isAutoApproved) ?? approval.isAutoApproved;

  const [draft, setDraft] = useState<QuoteOverviewDraft>(() =>
    buildInitialDraft(quote),
  );
  const [baseline, setBaseline] = useState<QuoteOverviewDraft>(() =>
    buildInitialDraft(quote),
  );

  useEffect(() => {
    const next = buildInitialDraft(quote);
    setDraft(next);
    setBaseline(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keep drafts across same-quote payload refreshes
  }, [quote.id]);

  const isDirty =
    draft.name !== baseline.name ||
    draft.reference !== baseline.reference ||
    draft.note !== baseline.note ||
    draft.quoteType !== baseline.quoteType ||
    draft.estimateDate !== baseline.estimateDate ||
    draft.expiresInDays !== baseline.expiresInDays ||
    draft.estimatedStartDate !== baseline.estimatedStartDate ||
    draft.estimatedCompletionDate !== baseline.estimatedCompletionDate ||
    draft.reasonForVariation !== baseline.reasonForVariation;

  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange, draft]);

  const patch = <K extends keyof QuoteOverviewDraft>(
    key: K,
    value: QuoteOverviewDraft[K],
  ) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
  };

  const buildPending = (): QuoteEditPending | null => {
    if (!isDirty) return null;
    const pending: QuoteEditPending = {};
    if (draft.name !== baseline.name) pending.name = draft.name || null;
    if (draft.reference !== baseline.reference) {
      pending.reference = draft.reference || null;
    }
    if (draft.note !== baseline.note) pending.note = draft.note || null;
    if (draft.quoteType !== baseline.quoteType) {
      pending.quoteType = draft.quoteType || null;
    }
    if (draft.estimateDate !== baseline.estimateDate) {
      pending.estimateDate = draft.estimateDate || null;
    }
    if (draft.expiresInDays !== baseline.expiresInDays) {
      pending.expiresInDays =
        draft.expiresInDays === '' ? null : Number(draft.expiresInDays);
    }
    if (draft.estimatedStartDate !== baseline.estimatedStartDate) {
      pending.estimatedStartDate = draft.estimatedStartDate || null;
    }
    if (draft.estimatedCompletionDate !== baseline.estimatedCompletionDate) {
      pending.estimatedCompletionDate = draft.estimatedCompletionDate || null;
    }
    if (draft.reasonForVariation !== baseline.reasonForVariation) {
      pending.reasonForVariation = draft.reasonForVariation || null;
    }
    return pending;
  };

  const reset = () => {
    setDraft(baseline);
  };

  const applyDraft = (next: QuoteOverviewDraft) => {
    setDraft(next);
  };

  const markClean = (saved?: QuoteEditPending | null) => {
    if (saved) {
      setBaseline((prev) => applyPendingToOverviewDraft(prev, saved));
      return;
    }
    setBaseline(draft);
  };

  useImperativeHandle(
    ref,
    () => ({
      getPendingUpdate: buildPending,
      getBaseline: () => baseline,
      applyDraft,
      reset,
      markClean,
      isDirty: () => isDirty,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- rebuild when draft/baseline change
    [isDirty, draft, baseline],
  );

  const quoteTypeItems = Object.fromEntries(QUOTE_TYPES.map((t) => [t, t]));

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <SectionCard
          title="Identifiers"
          icon={<FileSignature className="h-4 w-4 text-muted-foreground" />}
        >
          <DefRow
            label="Estimate number"
            value={quote.internalNumber ?? quote.quoteNumber ?? '—'}
          />
          <DefRow
            label="Name"
            value={
              editing ? (
                <EditText
                  value={draft.name}
                  onChange={(v) => patch('name', v)}
                  disabled={saving}
                />
              ) : (
                (quote.name ?? '—')
              )
            }
          />
          <DefRow
            label="Reference"
            value={
              editing ? (
                <EditText
                  value={draft.reference}
                  onChange={(v) => patch('reference', v)}
                  disabled={saving}
                />
              ) : (
                (quote.reference ?? '—')
              )
            }
          />
          {insurerRef && <DefRow label="Insurer reference" value={insurerRef} />}
          <DefRow label="Status type" value={approval.statusType ?? '—'} />
          <DefRow label="Created" value={formatDateTime(quote.createdAt)} />
          <DefRow label="Updated" value={formatDateTime(quote.updatedAt)} />
          {cwCreated && (
            <DefRow label="CW created" value={formatDateTime(cwCreated)} />
          )}
          {cwUpdated && (
            <DefRow label="CW updated" value={formatDateTime(cwUpdated)} />
          )}
        </SectionCard>

        <SectionCard
          title="Financials"
          icon={<Calculator className="h-4 w-4 text-muted-foreground" />}
        >
          <DefRow
            label="Estimate date"
            value={
              editing ? (
                <EditText
                  type="date"
                  value={draft.estimateDate}
                  onChange={(v) => patch('estimateDate', v)}
                  disabled={saving}
                />
              ) : (
                formatDate(quote.quoteDate)
              )
            }
          />
          <DefRow
            label="Sub total (ex. tax)"
            value={formatCurrency(quote.subTotal)}
          />
          <DefRow label="Total tax" value={formatCurrency(quote.totalTax)} />
          <DefRow
            label="Total (incl. tax)"
            value={formatCurrency(quote.totalAmount)}
          />
          <DefRow
            label="Expires in"
            value={
              editing ? (
                <div className="flex items-center gap-2">
                  <EditText
                    type="number"
                    min={0}
                    value={draft.expiresInDays}
                    onChange={(v) => patch('expiresInDays', v)}
                    disabled={saving}
                    className="h-8 w-24 text-sm"
                  />
                  <span className="text-xs text-muted-foreground">days</span>
                </div>
              ) : typeof quote.expiresInDays === 'number' ? (
                `${quote.expiresInDays} day${quote.expiresInDays === 1 ? '' : 's'}`
              ) : (
                '—'
              )
            }
          />
        </SectionCard>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <SectionCard
          title="Schedule"
          icon={<CalendarClock className="h-4 w-4 text-muted-foreground" />}
        >
          <DefRow
            label="Estimated start"
            value={
              editing ? (
                <EditText
                  type="date"
                  value={draft.estimatedStartDate}
                  onChange={(v) => patch('estimatedStartDate', v)}
                  disabled={saving}
                />
              ) : (
                formatDate(
                  quote.estimatedStartDate ??
                    getScheduleInfo(quote).estimatedStartDate ??
                    null,
                )
              )
            }
          />
          <DefRow
            label="Estimated completion"
            value={
              editing ? (
                <EditText
                  type="date"
                  value={draft.estimatedCompletionDate}
                  onChange={(v) => patch('estimatedCompletionDate', v)}
                  disabled={saving}
                />
              ) : (
                formatDate(
                  quote.estimatedCompletionDate ??
                    getScheduleInfo(quote).estimatedCompletionDate ??
                    null,
                )
              )
            }
          />
          <DefRow
            label="Reason for variation"
            value={
              editing ? (
                <EditText
                  value={draft.reasonForVariation}
                  onChange={(v) => patch('reasonForVariation', v)}
                  disabled={saving}
                />
              ) : (
                (getScheduleInfo(quote).reasonForVariation ?? '—')
              )
            }
          />
        </SectionCard>

        <SectionCard
          title="Approval"
          icon={<ShieldCheck className="h-4 w-4 text-muted-foreground" />}
        >
          <DefRow
            label="Auto-approved"
            value={<BoolPill value={autoApproved} />}
          />
          <DefRow label="Status name" value={approval.statusName ?? '—'} />
          <DefRow
            label="Estimate type"
            value={
              editing ? (
                <Select
                  value={draft.quoteType || undefined}
                  onValueChange={(v) => patch('quoteType', v ?? '')}
                  disabled={saving}
                  items={quoteTypeItems}
                >
                  <SelectTrigger className="h-8 w-full max-w-xs text-sm">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    {QUOTE_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <TypeBadge type={approval.quoteTypeName ?? draft.quoteType} />
              )
            }
          />
          <DefRow
            label="Created by"
            value={
              approval.createdByName
                ? `${approval.createdByName}${
                    approval.createdByExternalReference
                      ? ` (${approval.createdByExternalReference})`
                      : ''
                  }`
                : (
                    <OrgUserLabel userId={quote.createdByUserId} />
                  )
            }
          />
          <DefRow
            label="Updated by"
            value={
              approval.updatedByName
                ? `${approval.updatedByName}${
                    approval.updatedByExternalReference
                      ? ` (${approval.updatedByExternalReference})`
                      : ''
                  }`
                : (
                    <OrgUserLabel userId={quote.updatedByUserId} />
                  )
            }
          />
        </SectionCard>
      </div>

      {quote.externalReference && statusName !== 'Draft' && (
        <InsurerReviewCard quote={quote} statusName={statusName} />
      )}

      {(editing || quote.note) && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <StickyNote className="h-4 w-4 text-muted-foreground" />
              Note
            </CardTitle>
          </CardHeader>
          <CardContent>
            {editing ? (
              <EditTextarea
                value={draft.note}
                onChange={(v) => patch('note', v)}
                disabled={saving}
                rows={4}
              />
            ) : (
              <p className="whitespace-pre-wrap text-sm">{quote.note}</p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
});

function InsurerReviewCard({ quote, statusName }: { quote: Quote; statusName: string }) {
  const isApproved = statusName.toLowerCase() === 'approved';
  const isPending = statusName.toLowerCase() === 'pending';

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <ShieldCheck className="h-4 w-4 text-muted-foreground" />
          Insurer Review
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-3">
          <div className={`h-3 w-3 rounded-full ${isApproved ? 'bg-green-500' : isPending ? 'bg-amber-400 animate-pulse' : 'bg-slate-400'}`} />
          <div>
            <p className="text-sm font-medium">
              {isApproved ? 'Approved by insurer' : isPending ? 'Awaiting insurer review' : `Status: ${statusName}`}
            </p>
            <p className="text-xs text-muted-foreground">
              {isPending
                ? 'The estimate has been submitted. Line item decisions will appear in the Take Off tab when the insurer responds.'
                : isApproved
                  ? 'The insurer has approved this estimate. Check the Take Off tab for per-line decisions.'
                  : 'Check the Activities tab for the latest insurer actions.'
              }
            </p>
          </div>
        </div>
        {quote.externalReference && (
          <p className="mt-2 text-xs text-muted-foreground">
            Provider reference: <span className="font-mono">{quote.externalReference}</span>
          </p>
        )}
      </CardContent>
    </Card>
  );
}
