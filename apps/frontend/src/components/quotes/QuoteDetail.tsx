'use client';

import { useCallback, useRef, useState } from 'react';
import Link from 'next/link';
import {
  FileSpreadsheet,
  ExternalLink,
  FileSignature,
  Calculator,
  CalendarClock,
  CheckCircle2,
  ShieldCheck,
  Users,
  Building2,
  Layers,
  StickyNote,
  Calendar,
  ClipboardList,
  MessageSquare,
  Paperclip,
  Package,
  Save,
  Send,
  BookOpen,
  Lock,
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
  BoolPill,
  formatDate,
  formatDateTime,
  formatCurrency,
  formatAddress,
  pick,
  asString,
  asBool,
  type Dict,
} from '@/components/shared/detail';
import type {
  Quote,
  Job,
  Claim,
  QuotePartyPayload,
  QuoteScheduleInfo,
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
// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getApi(quote: Quote): Dict {
  return (quote.apiPayload as Dict | undefined) ?? {};
}

function getParty(
  quote: Quote,
  bucket: 'quoteTo' | 'quoteFor' | 'quoteFrom',
): QuotePartyPayload {
  const base = (quote[bucket] as Dict | undefined) ?? {};
  const api = getApi(quote);
  const prefix = bucket === 'quoteTo' ? 'to' : bucket === 'quoteFor' ? 'for' : 'from';
  const prefixed = (key: string): unknown =>
    api[`${prefix}${key[0].toUpperCase()}${key.slice(1)}`];
  const fromApi = (k: string): string | undefined => asString(prefixed(k));
  const fromBucket = (k: string): string | undefined => asString(base[k]);
  return {
    name: fromBucket('name') ?? fromApi('name'),
    companyRegistrationNumber:
      fromBucket('companyRegistrationNumber') ??
      fromApi('companyRegistrationNumber'),
    contactName: fromBucket('contactName') ?? fromApi('contactName'),
    clientReference:
      fromBucket('clientReference') ?? fromApi('clientReference'),
    phoneNumber: fromBucket('phoneNumber') ?? fromApi('phoneNumber'),
    email: fromBucket('email') ?? fromApi('email'),
    unitNumber: fromBucket('unitNumber') ?? fromApi('unitNumber'),
    streetNumber: fromBucket('streetNumber') ?? fromApi('streetNumber'),
    streetName: fromBucket('streetName') ?? fromApi('streetName'),
    suburb: fromBucket('suburb') ?? fromApi('suburb'),
    postCode: fromBucket('postCode') ?? fromApi('postCode'),
    state: fromBucket('state') ?? fromApi('state'),
    country: fromBucket('country') ?? fromApi('country'),
  };
}

function formatPartyAddress(p: QuotePartyPayload): string {
  return formatAddress({
    unitNumber: p.unitNumber,
    streetNumber: p.streetNumber,
    streetName: p.streetName,
    suburb: p.suburb,
    state: p.state,
    postCode: p.postCode,
    country: p.country,
  });
}

function getScheduleInfo(quote: Quote): QuoteScheduleInfo {
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

function getCustomData(quote: Quote): Dict {
  return (quote.customData as Dict | undefined) ?? {};
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
// Overview Tab
// ---------------------------------------------------------------------------

function OverviewTab({ quote }: { quote: Quote }) {
  const approval = getApprovalInfo(quote);
  const statusName = quote.status?.name ?? approval.statusName ?? 'Unknown';
  const quoteTypeName = quote.quoteType?.name ?? approval.quoteTypeName ?? '—';
  const schedule = getScheduleInfo(quote);
  const custom = getCustomData(quote);
  const insurerRef = asString(pick(custom, 'cwExternalReference'));
  const cwCreated = asString(pick(custom, 'cwCreatedAtDate'));
  const cwUpdated = asString(pick(custom, 'cwUpdatedAtDate'));
  const autoApproved = asBool(quote.isAutoApproved) ?? approval.isAutoApproved;

  return (
    <div className="space-y-4">
      {/* KPI Row */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card size="sm">
          <CardContent className="px-4">
            <p className="text-xs text-muted-foreground">Status</p>
            <div className="mt-1">
              <StatusBadge status={statusName} />
            </div>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardContent className="px-4">
            <p className="text-xs text-muted-foreground">Estimate type</p>
            <div className="mt-1">
              <TypeBadge type={quoteTypeName} />
            </div>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardContent className="px-4">
            <p className="text-xs text-muted-foreground">Total</p>
            <p className="mt-1 text-sm font-medium">{formatCurrency(quote.totalAmount)}</p>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardContent className="px-4">
            <p className="text-xs text-muted-foreground">Estimate date</p>
            <p className="mt-1 text-sm font-medium">{formatDate(quote.quoteDate)}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Identifiers */}
        <SectionCard
          title="Identifiers"
          icon={<FileSignature className="h-4 w-4 text-muted-foreground" />}
        >
          <DefRow label="Name" value={quote.name ?? '—'} />
          <DefRow label="Estimate number" value={quote.quoteNumber ?? '—'} />
          <DefRow label="Reference" value={quote.reference ?? '—'} />
          <DefRow
            label="CW ID"
            value={
              quote.externalReference ? (
                <span className="font-mono text-xs">{quote.externalReference}</span>
              ) : (
                '—'
              )
            }
          />
          {insurerRef && <DefRow label="Insurer reference" value={insurerRef} />}
          <DefRow label="Status type" value={approval.statusType ?? '—'} />
          <DefRow label="Created" value={formatDateTime(quote.createdAt)} />
          <DefRow label="Updated" value={formatDateTime(quote.updatedAt)} />
          {cwCreated && <DefRow label="CW created" value={formatDateTime(cwCreated)} />}
          {cwUpdated && <DefRow label="CW updated" value={formatDateTime(cwUpdated)} />}
        </SectionCard>

        {/* Financials */}
        <SectionCard
          title="Financials"
          icon={<Calculator className="h-4 w-4 text-muted-foreground" />}
        >
          <DefRow label="Sub total (ex. tax)" value={formatCurrency(quote.subTotal)} />
          <DefRow label="Total tax" value={formatCurrency(quote.totalTax)} />
          <DefRow label="Total (incl. tax)" value={formatCurrency(quote.totalAmount)} />
          <DefRow
            label="Expires in"
            value={
              typeof quote.expiresInDays === 'number'
                ? `${quote.expiresInDays} day${quote.expiresInDays === 1 ? '' : 's'}`
                : '—'
            }
          />
        </SectionCard>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Schedule */}
        <SectionCard
          title="Schedule"
          icon={<CalendarClock className="h-4 w-4 text-muted-foreground" />}
        >
          <DefRow
            label="Estimated start"
            value={formatDate(quote.estimatedStartDate ?? schedule.estimatedStartDate ?? null)}
          />
          <DefRow
            label="Estimated completion"
            value={formatDate(quote.estimatedCompletionDate ?? schedule.estimatedCompletionDate ?? null)}
          />
          <DefRow label="Reason for variation" value={schedule.reasonForVariation ?? '—'} />
        </SectionCard>

        {/* Approval */}
        <SectionCard
          title="Approval"
          icon={<ShieldCheck className="h-4 w-4 text-muted-foreground" />}
        >
          <DefRow label="Auto-approved" value={<BoolPill value={autoApproved} />} />
          <DefRow label="Status name" value={approval.statusName ?? '—'} />
          <DefRow label="Estimate type" value={<TypeBadge type={approval.quoteTypeName} />} />
          <DefRow
            label="Created by"
            value={
              approval.createdByName
                ? `${approval.createdByName}${approval.createdByExternalReference ? ` (${approval.createdByExternalReference})` : ''}`
                : <OrgUserLabel userId={quote.createdByUserId} />
            }
          />
          <DefRow
            label="Updated by"
            value={
              approval.updatedByName
                ? `${approval.updatedByName}${approval.updatedByExternalReference ? ` (${approval.updatedByExternalReference})` : ''}`
                : <OrgUserLabel userId={quote.updatedByUserId} />
            }
          />
        </SectionCard>
      </div>

      {quote.note ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <StickyNote className="h-4 w-4 text-muted-foreground" />
              Note
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap text-sm">{quote.note}</p>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Parties Tab
// ---------------------------------------------------------------------------

function PartyCard({
  title,
  party,
  icon,
}: {
  title: string;
  party: QuotePartyPayload;
  icon: React.ReactNode;
}) {
  const address = formatPartyAddress(party);
  return (
    <SectionCard title={title} icon={icon}>
      <DefRow label="Name" value={party.name ?? '—'} />
      <DefRow label="Contact" value={party.contactName ?? '—'} />
      <DefRow label="Email" value={party.email ?? '—'} />
      <DefRow label="Phone" value={party.phoneNumber ?? '—'} />
      <DefRow label="Company reg. #" value={party.companyRegistrationNumber ?? '—'} />
      <DefRow label="Client reference" value={party.clientReference ?? '—'} />
      <DefRow label="Address" value={address || '—'} />
    </SectionCard>
  );
}

function PartiesTab({ quote }: { quote: Quote }) {
  const to = getParty(quote, 'quoteTo');
  const forParty = getParty(quote, 'quoteFor');
  const from = getParty(quote, 'quoteFrom');

  return (
    <div className="grid gap-4 md:grid-cols-3">
      <PartyCard
        title="Estimate From (vendor)"
        party={from}
        icon={<Building2 className="h-4 w-4 text-muted-foreground" />}
      />
      <PartyCard
        title="Estimate For (customer)"
        party={forParty}
        icon={<Users className="h-4 w-4 text-muted-foreground" />}
      />
      <PartyCard
        title="Estimate To (recipient)"
        party={to}
        icon={<Users className="h-4 w-4 text-muted-foreground" />}
      />
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
  const [tab, setTab] = useState<QuoteTab>('overview');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [publishWizardOpen, setPublishWizardOpen] = useState(false);
  const [approvalWizardOpen, setApprovalWizardOpen] = useState(false);
  const [lineItemsDirty, setLineItemsDirty] = useState(false);
  const saveLineItemsRef = useRef<(() => void) | null>(null);
  const locked = isEstimateLocked(quote);
  const assignee = resolveDetailAssignee({ job });

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

  const handleLineItemsDirtyChange = useCallback((dirty: boolean, save: () => void) => {
    setLineItemsDirty(dirty);
    saveLineItemsRef.current = save;
  }, []);

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
          assigneeName={assignee.assigneeName}
          assignedToUserId={assignee.assignedToUserId}
          fromJob={assignee.fromJob}
          createdByUserId={quote.createdByUserId}
          updatedByUserId={quote.updatedByUserId}
          provider={job?.provider}
        />
      </div>
      <div className="pt-4">
        {locked && (
          <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
            This estimate has been published and can no longer be edited.
          </div>
        )}
        {tab === 'overview' && <OverviewTab quote={quote} />}
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
        {tab === 'parties' && <PartiesTab quote={quote} />}
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
