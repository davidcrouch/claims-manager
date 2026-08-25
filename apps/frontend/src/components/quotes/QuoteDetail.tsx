'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  FileSpreadsheet,
  ExternalLink,
  FileSignature,
  Calendar,
  ClipboardList,
  MessageSquare,
  Paperclip,
  Package,
  BookOpen,
  Lock,
  Layers,
  Users,
  CheckCircle2,
} from 'lucide-react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import { TypeBadge } from '@/components/ui/type-badge';
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
  asString,
  asBool,
  type Dict,
} from '@/components/shared/detail';
import { ActivityFeed } from '@/components/shared/ActivityFeed';
import { useActivities } from '@/hooks/useActivities';
import type {
  Quote,
  Job,
  Claim,
  QuoteApprovalInfo,
  CatalogType,
} from '@/types/api';
import { PrintButton } from '@/components/shared/PrintButton';
import { PublishButton } from '@/components/shared/PublishButton';
import { buildEstimateReportTypes } from '@/components/shared/PrintDocumentDrawer';
import { ArchiveEntityButton } from '@/components/shared/ArchiveEntityButton';
import {
  DetailAssignee,
  OrgUserLabel,
  resolveDetailAssignee,
} from '@/components/shared/DetailAssignee';
import { jobDisplayName } from '@/components/shared/job-label';
import { entityArchiveLabel, entityDetailHeaderTitles } from '@/components/shared/EntityDetailTitle';
import { QuoteLineItemsTabV2 as QuoteLineItemsTab, type LineItemEdits, type QuoteLineItemsTabHandle } from '@/components/line-items/QuoteLineItemsTabV2';
import {
  QuoteOverviewTab,
  type QuoteOverviewTabHandle,
} from '@/components/quotes/QuoteOverviewTab';
import {
  QuotePartiesTab,
  type QuotePartiesTabHandle,
} from '@/components/quotes/QuotePartiesTab';
import { JournalList } from '@/components/journals/JournalList';
import {
  fetchJournalsByEntityAction,
  fetchJournalsListAction,
  createJournalAction,
  linkJournalAction,
  unlinkJournalAction,
} from '@/app/(app)/journals/actions';
import { EntityAttachmentsTab } from '@/components/shared/EntityAttachmentsTab';
import {
  EstimatePublishWizard,
  type EstimatePublishMode,
} from '@/components/quotes/EstimatePublishWizard';
import { EstimateApprovalWizard } from '@/components/quotes/EstimateApprovalWizard';
import { WorkOrderFormDrawer } from '@/components/forms/WorkOrderFormDrawer';
import { updateQuoteFieldsAction } from '@/app/(app)/quotes/actions';
import {
  EMPTY_PARTY,
  type QuoteFieldsSnapshot,
  type QuoteOverviewDraft,
  type QuotePartiesSnapshot,
} from '@/components/quotes/quote-edit.types';
import {
  AUTOSAVE_DEBOUNCE_MS,
  MAX_UNDO,
  SAVE_STATUS_CLEAR_MS,
  cloneJson,
  detailSaveStatus,
  pushUndoEntry,
} from '@/components/shared/detail-autosave';
import {
  DetailSaveStatus,
  DetailUndoButton,
} from '@/components/shared/DetailAutosaveActions';

type UndoEntry =
  | { kind: 'fields'; snapshot: QuoteFieldsSnapshot }
  | { kind: 'line-items'; edits: LineItemEdits };

const EMPTY_OVERVIEW: QuoteOverviewDraft = {
  name: '',
  reference: '',
  note: '',
  quoteType: '',
  estimateDate: '',
  expiresInDays: '',
  estimatedStartDate: '',
  estimatedCompletionDate: '',
  reasonForVariation: '',
};

const EMPTY_PARTIES: QuotePartiesSnapshot = {
  quoteTo: { ...EMPTY_PARTY },
  quoteFor: { ...EMPTY_PARTY },
  quoteFrom: { ...EMPTY_PARTY },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getApi(quote: Quote): Dict {
  return (quote.apiPayload as Dict | undefined) ?? {};
}

function getApprovalInfo(quote: Quote): QuoteApprovalInfo {
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

export function getEstimateStatusName(quote: Quote): string {
  const approval = getApprovalInfo(quote);
  return (
    quote.status?.name ??
    approval.statusName ??
    (quote.externalReference ? 'Unknown' : 'Draft')
  );
}

export function isEstimateLocked(quote: Quote): boolean {
  const name = getEstimateStatusName(quote).trim().toLowerCase();
  if (quote.externalReference) return true;
  return name !== '' && name !== 'draft' && name !== 'unknown';
}

// ---------------------------------------------------------------------------
// Header
// ---------------------------------------------------------------------------

export function QuotePageHeader({
  quote,
  job,
}: {
  quote: Quote;
  job?: Job | null;
  claim?: Claim | null;
}) {
  const approval = getApprovalInfo(quote);
  const statusName = getEstimateStatusName(quote);
  const quoteTypeName = quote.quoteType?.name ?? approval.quoteTypeName;
  const locked = isEstimateLocked(quote);

  const titles = entityDetailHeaderTitles({
    internalNumber: quote.internalNumber,
    name: quote.name,
    secondaryLabel: quote.quoteNumber ?? quote.externalReference,
    fallbackId: quote.id,
  });

  return (
    <PageHeaderLayout
      leading={<BackButton href={job ? `/quotes?jobId=${job.id}` : '/quotes'} label="Back to estimates" />}
      icon={
        <PageHeaderIcon
          icon={FileSpreadsheet}
          className="bg-amber-100"
          iconClassName="text-amber-600"
        />
      }
      topTitle={titles.topTitle}
      title={titles.title}
      titleMono={titles.titleMono}
      topRow={
        <>
          <StatusBadge status={statusName} />
          {locked && (
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
              <Lock className="h-3 w-3" />
              Locked
            </span>
          )}
          {quoteTypeName && quoteTypeName !== 'Estimate' && quoteTypeName !== 'Quote' && (
            <TypeBadge type={quoteTypeName} />
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
          {quote.claimId && (
            <Link
              href={`/claims/${quote.claimId}`}
              className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
            >
              View Claim
              <ExternalLink className="h-3 w-3" />
            </Link>
          )}
        </>
      }
      bottomRow={
        <>
          <PageHeaderField label="Total">{formatCurrency(quote.totalAmount)}</PageHeaderField>
          <PageHeaderField label="Estimate date">{formatDate(quote.quoteDate)}</PageHeaderField>
          <PageHeaderField label="Updated">{formatDateTime(quote.updatedAt)}</PageHeaderField>
        </>
      }
    />
  );
}

// ---------------------------------------------------------------------------
// Placeholder Tabs
// ---------------------------------------------------------------------------

function ActivitiesTab({ quoteId }: { quoteId: string }) {
  const { activities, total, loading, error, page, setPage } = useActivities({
    entityType: 'quote',
    entityId: quoteId,
    refreshInterval: 30_000,
  });

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Activities</CardTitle>
      </CardHeader>
      <CardContent>
        {error ? (
          <p className="text-sm text-red-600 mb-3">Failed to load activities: {error}</p>
        ) : null}
        <ActivityFeed
          activities={activities}
          loading={loading}
          total={total}
          page={page}
          onPageChange={setPage}
          emptyMessage="No activity recorded for this estimate yet"
        />
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
          Emails associated with this estimate will appear here once the
          communications API is connected.
        </p>
      </CardContent>
    </Card>
  );
}

function TimelineTab({ quote }: { quote: Quote }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <SectionCard
        title="Local audit"
        icon={<Calendar className="h-4 w-4 text-muted-foreground" />}
      >
        <DefRow label="Created" value={formatDateTime(quote.createdAt)} />
        <DefRow label="Updated" value={formatDateTime(quote.updatedAt)} />
        <DefRow label="Created by" value={<OrgUserLabel userId={quote.createdByUserId} />} />
        <DefRow label="Updated by" value={<OrgUserLabel userId={quote.updatedByUserId} />} />
      </SectionCard>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Container with tabs
// ---------------------------------------------------------------------------

type QuoteTab =
  | 'overview'
  | 'line-items'
  | 'parties'
  | 'activities'
  | 'communications'
  | 'timeline'
  | 'attachments'
  | 'journals';

export function QuoteDetail({
  quote,
  job,
  claim,
  jobProvider,
}: {
  quote: Quote;
  job?: Job | null;
  claim?: Claim | null;
  jobProvider?: CatalogType;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<QuoteTab>('overview');
  const [lineItemsMounted, setLineItemsMounted] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [workOrderDrawerOpen, setWorkOrderDrawerOpen] = useState(false);
  const [publishWizardOpen, setPublishWizardOpen] = useState(false);
  const [approvalWizardOpen, setApprovalWizardOpen] = useState(false);
  const [lineItemsDirty, setLineItemsDirty] = useState(false);
  const [overviewDirty, setOverviewDirty] = useState(false);
  const [partiesDirty, setPartiesDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [lineItemsSaving, setLineItemsSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [fieldEditTick, setFieldEditTick] = useState(0);
  const [lineItemsEditTick, setLineItemsEditTick] = useState(0);
  const [undoStack, setUndoStack] = useState<UndoEntry[]>([]);
  const saveLineItemsRef = useRef<(() => void) | null>(null);
  const overviewRef = useRef<QuoteOverviewTabHandle>(null);
  const partiesRef = useRef<QuotePartiesTabHandle>(null);
  const lineItemsRef = useRef<QuoteLineItemsTabHandle>(null);
  const saveInFlightRef = useRef(false);
  const skipFieldUndoRef = useRef(false);
  const locked = isEstimateLocked(quote);
  const quoteAssigneeId = quote.assignedToUserId ?? '';
  const [assignedToUserId, setAssignedToUserId] = useState(quoteAssigneeId);
  const [committedAssignee, setCommittedAssignee] = useState(quoteAssigneeId);
  const assignedToUserIdRef = useRef(assignedToUserId);
  assignedToUserIdRef.current = assignedToUserId;
  const assigneeDirty = assignedToUserId !== committedAssignee;
  const pageDirty = overviewDirty || partiesDirty || assigneeDirty;
  const anyDirty = pageDirty || lineItemsDirty;
  const anySaving = saving || lineItemsSaving;
  const resolvedAssignee = resolveDetailAssignee({
    entityAssigneeName:
      assignedToUserId && assignedToUserId === quoteAssigneeId
        ? quote.assigneeName
        : null,
    entityAssignedToUserId: assignedToUserId || null,
    job,
  });
  const estimateReportTypes = useMemo(
    () => buildEstimateReportTypes(quote.id),
    [quote.id],
  );

  const pushUndo = useCallback((entry: UndoEntry) => {
    setUndoStack((prev) => pushUndoEntry(prev, entry, MAX_UNDO));
  }, []);

  const captureFieldSnapshot = useCallback((): QuoteFieldsSnapshot => {
    return cloneJson({
      assignedToUserId: committedAssignee,
      overview: overviewRef.current?.getBaseline() ?? EMPTY_OVERVIEW,
      parties: partiesRef.current?.getBaseline() ?? EMPTY_PARTIES,
    });
  }, [committedAssignee]);

  useEffect(() => {
    setAssignedToUserId(quote.assignedToUserId ?? '');
    setCommittedAssignee(quote.assignedToUserId ?? '');
  }, [quote.id, quote.assignedToUserId]);

  useEffect(() => {
    setOverviewDirty(false);
    setPartiesDirty(false);
    setLineItemsDirty(false);
    setSaveError(null);
    setJustSaved(false);
    setUndoStack([]);
    setLineItemsMounted(tab === 'line-items');
    // eslint-disable-next-line react-hooks/exhaustive-deps -- remount take-off for the new estimate
  }, [quote.id]);

  useEffect(() => {
    if (tab === 'line-items') setLineItemsMounted(true);
  }, [tab]);

  const title = entityArchiveLabel(
    quote.internalNumber,
    quote.name,
    quote.quoteNumber ?? quote.externalReference,
    quote.id,
  );
  const statusName = getEstimateStatusName(quote);
  const canPublish = !locked;
  const publishMode: EstimatePublishMode =
    job?.provider === 'crunchwork' ? 'external' : 'internal';
  const isInternal = publishMode === 'internal';
  const canApprove = statusName === 'Pending' && isInternal;
  const showTakeOffActions = tab === 'line-items' && !locked;
  /** Assignment is always editable, including published / locked estimates. */
  const canEditAssignee = true;
  const canUndo = anyDirty || undoStack.length > 0;

  const handleOverviewDirty = useCallback((dirty: boolean) => {
    setOverviewDirty(dirty);
    setFieldEditTick((n) => n + 1);
  }, []);

  const handlePartiesDirty = useCallback((dirty: boolean) => {
    setPartiesDirty(dirty);
    setFieldEditTick((n) => n + 1);
  }, []);

  const handleLineItemsDirtyChange = useCallback((dirty: boolean, save: () => void) => {
    setLineItemsDirty(dirty);
    saveLineItemsRef.current = save;
    setLineItemsEditTick((n) => n + 1);
  }, []);

  const handleLineItemsUndoCapture = useCallback(
    (restoreEdits: LineItemEdits) => {
      pushUndo({ kind: 'line-items', edits: cloneJson(restoreEdits) });
    },
    [pushUndo],
  );

  const handleLineItemsSaveState = useCallback(
    (state: 'saving' | 'saved' | 'error', error?: string) => {
      if (state === 'saving') {
        setLineItemsSaving(true);
        setJustSaved(false);
        setSaveError(null);
        return;
      }
      setLineItemsSaving(false);
      if (state === 'error') {
        setSaveError(error ?? 'Failed to save line items');
        return;
      }
      setJustSaved(true);
    },
    [],
  );

  const persistPending = useCallback(async (): Promise<{
    success: boolean;
    error?: string;
  }> => {
    if (saveInFlightRef.current) {
      return { success: false, error: 'A save is already in progress' };
    }

    const overviewPending = overviewRef.current?.getPendingUpdate() ?? null;
    const partiesPending = partiesRef.current?.getPendingUpdate() ?? null;
    const assigneeSnapshot = assignedToUserIdRef.current;
    const assigneeChanged = assigneeSnapshot !== committedAssignee;

    if (!overviewPending && !partiesPending && !assigneeChanged) {
      setSaveError(null);
      return { success: true };
    }

    const undoSnapshot = skipFieldUndoRef.current ? null : captureFieldSnapshot();
    skipFieldUndoRef.current = false;

    saveInFlightRef.current = true;
    setSaving(true);
    setJustSaved(false);
    setSaveError(null);
    try {
      const result = await updateQuoteFieldsAction(quote.id, {
        ...(overviewPending ?? {}),
        ...(partiesPending ?? {}),
        ...(assigneeChanged
          ? { assignedToUserId: assigneeSnapshot || null }
          : {}),
      });
      if (!result.success) {
        const message = result.error ?? 'Failed to save estimate';
        setSaveError(message);
        return { success: false, error: message };
      }
      if (overviewPending) {
        overviewRef.current?.markClean(overviewPending);
      }
      if (partiesPending) {
        partiesRef.current?.markClean(partiesPending);
      }
      if (assigneeChanged) {
        setCommittedAssignee(assigneeSnapshot);
      }
      if (undoSnapshot) {
        pushUndo({ kind: 'fields', snapshot: undoSnapshot });
      }
      setJustSaved(true);
      router.refresh();
      return { success: true };
    } finally {
      saveInFlightRef.current = false;
      setSaving(false);
    }
  }, [
    quote.id,
    router,
    committedAssignee,
    captureFieldSnapshot,
    pushUndo,
  ]);

  useEffect(() => {
    if (!pageDirty || anySaving) return;
    const timer = setTimeout(() => {
      void persistPending();
    }, AUTOSAVE_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [pageDirty, anySaving, persistPending, fieldEditTick, assignedToUserId]);

  useEffect(() => {
    if (locked || !lineItemsDirty || anySaving) return;
    const timer = setTimeout(() => {
      saveLineItemsRef.current?.();
    }, AUTOSAVE_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [locked, lineItemsDirty, anySaving, lineItemsEditTick]);

  useEffect(() => {
    if (!justSaved || anyDirty || anySaving || saveError) return;
    const timer = setTimeout(() => setJustSaved(false), SAVE_STATUS_CLEAR_MS);
    return () => clearTimeout(timer);
  }, [justSaved, anyDirty, anySaving, saveError]);

  const handleUndo = useCallback(() => {
    if (anySaving) return;

    if (anyDirty) {
      overviewRef.current?.reset();
      partiesRef.current?.reset();
      lineItemsRef.current?.resetEdits();
      setAssignedToUserId(committedAssignee);
      setSaveError(null);
      return;
    }

    const entry = undoStack[undoStack.length - 1];
    if (!entry) return;
    setUndoStack((prev) => prev.slice(0, -1));

    if (entry.kind === 'fields') {
      skipFieldUndoRef.current = true;
      flushSync(() => {
        overviewRef.current?.applyDraft(entry.snapshot.overview);
        partiesRef.current?.applyDraft(entry.snapshot.parties);
        setAssignedToUserId(entry.snapshot.assignedToUserId);
      });
      void persistPending();
      return;
    }

    lineItemsRef.current?.save(entry.edits);
  }, [
    anySaving,
    anyDirty,
    undoStack,
    committedAssignee,
    persistPending,
  ]);

  const { label: saveStatusLabel, tone: saveStatusTone } = detailSaveStatus({
    saving: anySaving,
    saveError,
    justSaved,
    dirty: anyDirty,
  });

  const tabs: Array<{ id: QuoteTab; label: string; icon: typeof Calendar }> = [
    { id: 'overview', label: 'Overview', icon: FileSignature },
    { id: 'line-items', label: 'Take Off', icon: Layers },
    { id: 'parties', label: 'Parties', icon: Users },
    { id: 'activities', label: 'Activities', icon: ClipboardList },
    { id: 'communications', label: 'Communications', icon: MessageSquare },
    { id: 'attachments', label: 'Attachments', icon: Paperclip },
    { id: 'journals', label: 'Journals', icon: BookOpen },
    { id: 'timeline', label: 'Timeline', icon: Calendar },
  ];

  return (
    <div className="flex flex-col">
      <SetHeaderActions>
        <DetailSaveStatus statusLabel={saveStatusLabel} tone={saveStatusTone} />
        {showTakeOffActions && (
          <Button
            size="default"
            variant="outline"
            className="h-9 gap-1.5 px-4"
            onClick={() => setDrawerOpen(true)}
          >
            <Package className="h-3.5 w-3.5" />
            Catalogue
          </Button>
        )}
        {canApprove && (
          <Button
            size="default"
            onClick={() => setApprovalWizardOpen(true)}
            className="h-9 gap-1.5 px-4 bg-emerald-600 text-white hover:bg-emerald-500"
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            Received Approval
          </Button>
        )}
        {locked && (
          <Button
            size="default"
            onClick={() => setWorkOrderDrawerOpen(true)}
            className="h-9 gap-1.5 px-4 bg-blue-600 text-white hover:bg-blue-500"
          >
            Create Work Order
          </Button>
        )}
        <HeaderActionToolbar>
          <DetailUndoButton
            canUndo={canUndo}
            undoDisabled={anySaving}
            onUndo={handleUndo}
          />
          {canPublish && (
            <PublishButton onClick={() => setPublishWizardOpen(true)} />
          )}
          <PrintButton
            documentType="quote"
            entityId={quote.id}
            jobId={job?.id ?? quote.jobId ?? undefined}
            reportTypes={estimateReportTypes}
          />
          <ArchiveEntityButton
            entityType="quote"
            entityId={quote.id}
            statusName={statusName}
            entityLabel={title}
            redirectTo={job ? `/quotes?jobId=${job.id}` : '/quotes'}
          />
        </HeaderActionToolbar>
      </SetHeaderActions>
      <WorkOrderFormDrawer
        open={workOrderDrawerOpen}
        onOpenChange={setWorkOrderDrawerOpen}
        jobId={job?.id ?? quote.jobId ?? undefined}
      />
      <EstimatePublishWizard
        open={publishWizardOpen}
        onOpenChange={setPublishWizardOpen}
        quote={quote}
        job={job}
        claim={claim}
        mode={publishMode}
      />
      <EstimateApprovalWizard
        open={approvalWizardOpen}
        onOpenChange={setApprovalWizardOpen}
        quoteId={quote.id}
      />
      <div className="flex w-full flex-nowrap items-center border-b border-slate-200" data-slot="quote-detail-tabs">
        <div className="flex min-w-0 flex-1 flex-nowrap gap-0">
          {tabs.map((t) => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  if (t.id !== 'line-items') {
                    setDrawerOpen(false);
                  }
                  setTab(t.id);
                }}
                className={`inline-flex items-center gap-1.5 px-4 py-3 text-sm font-medium transition-colors border-b-2 -mb-px rounded-t-md ${
                  active
                    ? 'border-amber-600 bg-amber-50 text-amber-600'
                    : 'border-transparent bg-transparent text-slate-500 hover:bg-slate-50 hover:text-slate-700'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {t.label}
              </button>
            );
          })}
        </div>
        <DetailAssignee
          assigneeName={resolvedAssignee.assigneeName}
          assignedToUserId={assignedToUserId || null}
          fromJob={resolvedAssignee.fromJob}
          editing={canEditAssignee}
          saving={false}
          onChange={(userId) => setAssignedToUserId(userId ?? '')}
          unassignedLabel="Not assigned"
          fallbackAssigneeName={job?.assigneeName}
          fallbackAssignedToUserId={job?.assignedToUserId}
          createdByUserId={quote.createdByUserId}
          updatedByUserId={quote.updatedByUserId}
          provider={job?.provider}
        />
      </div>
      <div className="pt-4">
        {locked && (
          <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
            This estimate has been published and can no longer be edited, except
            for Assigned.
          </div>
        )}
        {saveError && (
          <div className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {saveError}
          </div>
        )}
        {/* Keep editable tabs mounted so draft state survives tab switches. */}
        <div className={tab === 'overview' ? '' : 'hidden'}>
          <QuoteOverviewTab
            ref={overviewRef}
            quote={quote}
            editing={!locked}
            saving={false}
            onDirtyChange={handleOverviewDirty}
          />
        </div>
        {lineItemsMounted && (
          <div className={tab === 'line-items' ? '' : 'hidden'}>
            <QuoteLineItemsTab
              ref={lineItemsRef}
              quote={quote}
              drawerOpen={drawerOpen}
              onDrawerOpenChange={setDrawerOpen}
              catalogType={jobProvider}
              readOnly={locked}
              onDirtyChange={handleLineItemsDirtyChange}
              onUndoCapture={handleLineItemsUndoCapture}
              onSaveStateChange={handleLineItemsSaveState}
              hideToolbarActions
            />
          </div>
        )}
        <div className={tab === 'parties' ? '' : 'hidden'}>
          <QuotePartiesTab
            ref={partiesRef}
            quote={quote}
            editing={!locked}
            saving={false}
            onDirtyChange={handlePartiesDirty}
          />
        </div>
        {tab === 'activities' && <ActivitiesTab quoteId={quote.id} />}
        {tab === 'communications' && <CommunicationsTab />}
        {tab === 'timeline' && <TimelineTab quote={quote} />}
        {tab === 'attachments' && <EntityAttachmentsTab entityId={quote.id} relatedRecordType="Quote" entityLabel="this estimate" />}
        {tab === 'journals' && (
          <JournalList
            entityType="Quote"
            entityId={quote.id}
            fetchJournals={(params) =>
              fetchJournalsByEntityAction('Quote', quote.id, params)
            }
            fetchAllJournals={() => fetchJournalsListAction()}
            createJournal={(data) => createJournalAction(data)}
            linkJournal={(jId) => linkJournalAction(jId, 'Quote', quote.id)}
            unlinkJournal={(jId) => unlinkJournalAction(jId, 'Quote', quote.id)}
          />
        )}
      </div>
    </div>
  );
}
