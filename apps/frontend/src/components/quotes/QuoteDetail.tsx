'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
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
  Save,
  Send,
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
import type {
  Quote,
  Job,
  Claim,
  QuoteApprovalInfo,
  CatalogType,
} from '@/types/api';
import { PrintButton } from '@/components/shared/PrintButton';
import { ArchiveEntityButton } from '@/components/shared/ArchiveEntityButton';
import {
  DetailAssignee,
  OrgUserLabel,
  resolveDetailAssignee,
} from '@/components/shared/DetailAssignee';
import { jobDisplayName } from '@/components/shared/job-label';
import { QuoteLineItemsTab } from '@/components/quotes/QuoteLineItemsTab';
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
import { QuoteAttachmentsTab } from '@/components/quotes/QuoteAttachmentsTab';
import {
  EstimatePublishWizard,
  type EstimatePublishMode,
} from '@/components/quotes/EstimatePublishWizard';
import { EstimateApprovalWizard } from '@/components/quotes/EstimateApprovalWizard';
import { updateQuoteFieldsAction } from '@/app/(app)/quotes/actions';

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
  const title =
    quote.name ??
    quote.quoteNumber ??
    quote.externalReference ??
    quote.id;
  const statusName = getEstimateStatusName(quote);
  const quoteTypeName = quote.quoteType?.name ?? approval.quoteTypeName;
  const locked = isEstimateLocked(quote);

  return (
    <div className="flex w-full min-w-0 flex-col gap-y-1">
      <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
        <BackButton href={job ? `/quotes?jobId=${job.id}` : '/quotes'} label="Back to estimates" />
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-100">
          <FileSpreadsheet className="h-4 w-4 text-amber-600" />
        </span>
        <h1 className="truncate text-lg font-semibold leading-tight">{title}</h1>
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
      </div>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 pl-20 text-xs">
        <div className="flex items-baseline gap-1">
          <span className="text-muted-foreground">Total:</span>
          <span className="font-medium">{formatCurrency(quote.totalAmount)}</span>
        </div>
        <div className="flex items-baseline gap-1">
          <span className="text-muted-foreground">Estimate date:</span>
          <span className="font-medium">{formatDate(quote.quoteDate)}</span>
        </div>
        <div className="flex items-baseline gap-1">
          <span className="text-muted-foreground">Updated:</span>
          <span className="font-medium">{formatDateTime(quote.updatedAt)}</span>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Placeholder Tabs
// ---------------------------------------------------------------------------

function ActivitiesTab() {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Activities</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          Tasks and appointments linked to this estimate will appear here once the
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
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [publishWizardOpen, setPublishWizardOpen] = useState(false);
  const [approvalWizardOpen, setApprovalWizardOpen] = useState(false);
  const [lineItemsDirty, setLineItemsDirty] = useState(false);
  const [overviewDirty, setOverviewDirty] = useState(false);
  const [partiesDirty, setPartiesDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const saveLineItemsRef = useRef<(() => void) | null>(null);
  const overviewRef = useRef<QuoteOverviewTabHandle>(null);
  const partiesRef = useRef<QuotePartiesTabHandle>(null);
  const locked = isEstimateLocked(quote);
  const quoteAssigneeId = quote.assignedToUserId ?? '';
  const [assignedToUserId, setAssignedToUserId] = useState(quoteAssigneeId);
  const assigneeDirty = assignedToUserId !== quoteAssigneeId;
  const pageDirty = overviewDirty || partiesDirty || assigneeDirty;
  const resolvedAssignee = resolveDetailAssignee({
    entityAssigneeName:
      assignedToUserId && assignedToUserId === quoteAssigneeId
        ? quote.assigneeName
        : null,
    entityAssignedToUserId: assignedToUserId || null,
    job,
  });

  useEffect(() => {
    setAssignedToUserId(quote.assignedToUserId ?? '');
  }, [quote.id, quote.assignedToUserId]);

  const title =
    quote.name ??
    quote.quoteNumber ??
    quote.externalReference ??
    quote.id;
  const statusName = getEstimateStatusName(quote);
  const canPublish = !locked;
  const publishMode: EstimatePublishMode =
    job?.provider === 'crunchwork' ? 'external' : 'internal';
  const isInternal = publishMode === 'internal';
  const canApprove = statusName === 'Pending' && isInternal;
  const showTakeOffActions = tab === 'line-items' && !locked;
  const showFieldEditActions =
    !locked && (tab === 'overview' || tab === 'parties');
  /** Assignment is always editable, including published / locked estimates. */
  const canEditAssignee = true;
  const showAssigneeSaveActions = assigneeDirty;

  const handleLineItemsDirtyChange = useCallback((dirty: boolean, save: () => void) => {
    setLineItemsDirty(dirty);
    saveLineItemsRef.current = save;
  }, []);

  const handleCancel = useCallback(() => {
    overviewRef.current?.reset();
    partiesRef.current?.reset();
    setAssignedToUserId(quote.assignedToUserId ?? '');
    setSaveError(null);
  }, [quote.assignedToUserId]);

  const handleSave = useCallback(async () => {
    const overviewPending = overviewRef.current?.getPendingUpdate() ?? null;
    const partiesPending = partiesRef.current?.getPendingUpdate() ?? null;
    const assigneeChanged = assignedToUserId !== (quote.assignedToUserId ?? '');

    if (!overviewPending && !partiesPending && !assigneeChanged) {
      setSaveError(null);
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      const result = await updateQuoteFieldsAction(quote.id, {
        ...(overviewPending ?? {}),
        ...(partiesPending ?? {}),
        ...(assigneeChanged
          ? { assignedToUserId: assignedToUserId || null }
          : {}),
      });
      if (!result.success) {
        setSaveError(result.error ?? 'Failed to save estimate');
        return;
      }
      overviewRef.current?.markClean();
      partiesRef.current?.markClean();
      router.refresh();
    } finally {
      setSaving(false);
    }
  }, [quote.id, quote.assignedToUserId, assignedToUserId, router]);

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
        {(showFieldEditActions || showAssigneeSaveActions) && (
          <>
            <Button
              size="default"
              variant="outline"
              onClick={handleCancel}
              disabled={saving || !pageDirty}
              className="h-9 gap-1.5 px-4"
            >
              Cancel
            </Button>
            <Button
              size="default"
              onClick={handleSave}
              disabled={saving || !pageDirty}
              className="h-9 gap-1.5 px-4 bg-blue-600 text-white hover:bg-blue-500"
            >
              <Save className="h-3.5 w-3.5" />
              {saving ? 'Saving...' : 'Save'}
            </Button>
          </>
        )}
        {showTakeOffActions && (
          <>
            <Button
              size="default"
              variant="outline"
              className="h-9 gap-1.5 px-4"
              onClick={() => setDrawerOpen(true)}
            >
              <Package className="h-3.5 w-3.5" />
              Catalogue
            </Button>
            <Button
              size="default"
              variant="outline"
              disabled={!lineItemsDirty}
              className="h-9 gap-1.5 px-4"
              onClick={() => saveLineItemsRef.current?.()}
            >
              <Save className="h-3.5 w-3.5" />
              Save
            </Button>
          </>
        )}
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
        <PrintButton documentType="quote" entityId={quote.id} jobId={job?.id} />
        <ArchiveEntityButton
          entityType="quote"
          entityId={quote.id}
          statusName={statusName}
          entityLabel={title}
          redirectTo={job ? `/quotes?jobId=${job.id}` : '/quotes'}
        />
      </SetHeaderActions>
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
      <div className="flex w-full flex-wrap items-center gap-x-4 border-b border-slate-200" data-slot="quote-detail-tabs">
        <div className="flex min-w-0 flex-1 flex-wrap gap-0">
          {tabs.map((t) => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  if (t.id !== 'line-items') {
                    setLineItemsDirty(false);
                    saveLineItemsRef.current = null;
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
          saving={saving}
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
            saving={saving}
            onDirtyChange={setOverviewDirty}
          />
        </div>
        {tab === 'line-items' && (
          <QuoteLineItemsTab
            quote={quote}
            drawerOpen={drawerOpen}
            onDrawerOpenChange={setDrawerOpen}
            catalogType={jobProvider}
            readOnly={locked}
            onDirtyChange={handleLineItemsDirtyChange}
            hideToolbarActions
          />
        )}
        <div className={tab === 'parties' ? '' : 'hidden'}>
          <QuotePartiesTab
            ref={partiesRef}
            quote={quote}
            editing={!locked}
            saving={saving}
            onDirtyChange={setPartiesDirty}
          />
        </div>
        {tab === 'activities' && <ActivitiesTab />}
        {tab === 'communications' && <CommunicationsTab />}
        {tab === 'timeline' && <TimelineTab quote={quote} />}
        {tab === 'attachments' && <QuoteAttachmentsTab quoteId={quote.id} />}
        {tab === 'journals' && (
          <JournalList
            entityType="Quote"
            entityId={quote.id}
            fetchJournals={() => fetchJournalsByEntityAction('Quote', quote.id)}
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
