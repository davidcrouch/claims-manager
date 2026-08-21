'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import {
  Calendar,
  Clock,
  Users,
  FileBarChart,
  Info,
  Paperclip,
  Plus,
  Send,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SetHeaderActions } from '@/components/layout/SetHeaderActions';
import { ArchiveEntityButton } from '@/components/shared/ArchiveEntityButton';
import { DetailAssignee } from '@/components/shared/DetailAssignee';
import { AddJobContactsDrawer } from '@/components/forms/AddJobContactsDrawer';
import { PrintButton } from '@/components/shared/PrintButton';
import { JOB_REPORT_TYPES } from '@/components/shared/PrintDocumentDrawer';
import { QuoteFormDrawer } from '@/components/forms/QuoteFormDrawer';
import {
  AppointmentFormDrawer,
  type AppointmentCreateDefaults,
  type JobParty,
} from '@/components/forms/AppointmentFormDrawer';
import { JobOverviewTab, type JobOverviewTabHandle } from './tabs/JobOverviewTab';
import { JobTypeDetailsTab, type JobTypeDetailsTabHandle } from './tabs/JobTypeDetailsTab';
import { JobPartiesTab } from './tabs/JobPartiesTab';
import { JobReportsTab } from './tabs/JobReportsTab';
import { JobTimelineTab } from './tabs/JobTimelineTab';
import { JobPublishWizard } from './JobPublishWizard';
import { EntityAttachmentsTab } from '@/components/shared/EntityAttachmentsTab';
import { hasTypeDetails } from './util/jobType';
import { updateJobFieldsAction } from '@/app/(app)/jobs/[id]/actions';
import { formatAddress, asString, pick } from '@/components/shared/detail';
import type { LookupOption } from './job-edit.types';
import type { Job, Claim } from '@/types/api';

const VALID_TABS = [
  'overview',
  'type-details',
  'parties',
  'reports',
  'attachments',
  'timeline',
] as const;

type TabValue = (typeof VALID_TABS)[number];

const AUTOSAVE_DEBOUNCE_MS = 600;

type Dict = Record<string, unknown>;

function jobAddressSource(job: Job): Dict {
  const addr = (job.address as Dict | undefined) ?? {};
  const apiAddr =
    ((job.apiPayload as Dict | undefined)?.address as Dict | undefined) ?? {};
  return Object.keys(addr).length > 0 ? addr : apiAddr;
}

function formatJobAddress(job: Job): string {
  return formatAddress(jobAddressSource(job), {
    full: true,
    fallback: {
      suburb: job.addressSuburb ?? asString(jobAddressSource(job).suburb),
      state: job.addressState ?? asString(jobAddressSource(job).state),
      postcode: job.addressPostcode ?? asString(jobAddressSource(job).postcode),
      country: job.addressCountry ?? asString(jobAddressSource(job).country),
    },
  }).trim();
}

function stripHtmlToText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function timezoneFromState(state?: string | null): string {
  const s = (state ?? '').toUpperCase();
  if (s === 'WA') return 'Australia/Perth';
  if (s === 'SA') return 'Australia/Adelaide';
  if (s === 'NT') return 'Australia/Darwin';
  if (s === 'TAS') return 'Australia/Hobart';
  if (s === 'NSW' || s === 'ACT') return 'Australia/Sydney';
  if (s === 'VIC') return 'Australia/Melbourne';
  return 'Australia/Brisbane';
}

function oneHourLater(time: string): string {
  const [h, m] = time.split(':').map(Number);
  const next = ((h || 0) + 1) % 24;
  return `${String(next).padStart(2, '0')}:${String(m || 0).padStart(2, '0')}`;
}

function datePartsFromIso(iso?: string | null): { date: string; time: string } | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    const dateOnly = iso.slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateOnly)) {
      return { date: dateOnly, time: '09:00' };
    }
    return null;
  }
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return { date: `${yyyy}-${mm}-${dd}`, time: `${hh}:${min}` };
}

function todayDateString() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function appointmentCreateDefaultsFromJob(job: Job): AppointmentCreateDefaults {
  const custom = (job.customData as Dict | undefined) ?? {};
  const api = (job.apiPayload as Dict | undefined) ?? {};
  const bookedRaw = asString(pick(custom, 'bookedDate') ?? pick(api, 'bookedDate'));
  const start = datePartsFromIso(bookedRaw) ?? {
    date: todayDateString(),
    time: '09:00',
  };
  const endTime = oneHourLater(start.time);
  const address = formatJobAddress(job);
  const jobTypeName = job.jobType?.name;
  const name =
    job.name?.trim() ||
    (jobTypeName
      ? `${jobTypeName} appointment`
      : job.externalReference
        ? `Appointment — ${job.externalReference}`
        : 'Site appointment');
  const description = stripHtmlToText(job.jobInstructions ?? '');
  const state =
    job.addressState ?? asString(jobAddressSource(job).state) ?? null;

  return {
    name,
    appointmentType: 'Inspection',
    location: 'ONSITE',
    timezone: timezoneFromState(state),
    startDate: start.date,
    startTime: start.time === '00:00' ? '09:00' : start.time,
    endDate: start.date,
    endTime: start.time === '00:00' ? '10:00' : endTime,
    address,
    description: description || undefined,
  };
}

function jobPartiesFromJob(job: Job): JobParty[] {
  const contacts =
    ((job.apiPayload as Dict | undefined)?.contacts as JobParty[] | undefined) ?? [];
  return contacts.filter((c) => c && (c.id || c.name || c.firstName || c.email));
}

function normaliseTab(raw: string | null, showTypeDetails: boolean): TabValue {
  if (!raw) return 'overview';
  const found = VALID_TABS.find((t) => t === raw);
  if (!found) return 'overview';
  if (found === 'type-details' && !showTypeDetails) return 'overview';
  return found;
}

export function JobDetail({
  job,
  parentClaim,
  statusOptions = [],
  jobTypeOptions = [],
  contactTypeOptions = [],
  reportStatusOptions = [],
  reportTypeOptions = [],
}: {
  job: Job;
  parentClaim?: Claim | null;
  statusOptions?: LookupOption[];
  jobTypeOptions?: LookupOption[];
  contactTypeOptions?: LookupOption[];
  reportStatusOptions?: LookupOption[];
  reportTypeOptions?: LookupOption[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const showTypeDetails = hasTypeDetails(job);
  const isCrunchwork = job.provider === 'crunchwork';
  const activeTab = normaliseTab(searchParams.get('tab'), showTypeDetails);
  const overviewRef = useRef<JobOverviewTabHandle>(null);
  const typeDetailsRef = useRef<JobTypeDetailsTabHandle>(null);
  const saveInFlightRef = useRef(false);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState(false);
  const [justPublished, setJustPublished] = useState(false);
  const [contactDrawerOpen, setContactDrawerOpen] = useState(false);
  const [reportDrawerOpen, setReportDrawerOpen] = useState(false);
  const [estimateDrawerOpen, setEstimateDrawerOpen] = useState(false);
  const [appointmentDrawerOpen, setAppointmentDrawerOpen] = useState(false);
  const [appointmentCreateDefaults, setAppointmentCreateDefaults] =
    useState<AppointmentCreateDefaults | undefined>(undefined);
  const [appointmentJobParties, setAppointmentJobParties] = useState<JobParty[]>([]);
  const [appointmentDefaultAddress, setAppointmentDefaultAddress] = useState('');
  const [publishWizardOpen, setPublishWizardOpen] = useState(false);
  const [assignedToUserId, setAssignedToUserId] = useState(job.assignedToUserId ?? '');
  const [committedAssignee, setCommittedAssignee] = useState(job.assignedToUserId ?? '');
  const [overviewDirty, setOverviewDirty] = useState(false);
  const [typeDetailsDirty, setTypeDetailsDirty] = useState(false);
  /** Sticky: CW field edits enable Publish until the user clicks Publish (survives autosave). */
  const [cwPublishPending, setCwPublishPending] = useState(false);

  const assigneeDirty = assignedToUserId !== committedAssignee;
  const pageDirty = overviewDirty || typeDetailsDirty || assigneeDirty;
  /** Overview + type-details drafts are the CW-bound fields (not assignee). */
  const cwFieldsDirty = overviewDirty || typeDetailsDirty;

  useEffect(() => {
    setAssignedToUserId(job.assignedToUserId ?? '');
    setCommittedAssignee(job.assignedToUserId ?? '');
  }, [job.id, job.assignedToUserId]);

  useEffect(() => {
    setOverviewDirty(false);
    setTypeDetailsDirty(false);
    setSaveError(null);
    setJustSaved(false);
    setJustPublished(false);
    setCwPublishPending(false);
  }, [job.id]);

  useEffect(() => {
    if (activeTab !== 'parties') setContactDrawerOpen(false);
    if (activeTab !== 'reports') setReportDrawerOpen(false);
  }, [activeTab]);

  useEffect(() => {
    if (isCrunchwork && cwFieldsDirty) {
      setCwPublishPending(true);
      setJustPublished(false);
    }
  }, [isCrunchwork, cwFieldsDirty]);

  const onTabChange = useCallback(
    (value: string | null) => {
      if (!value) return;
      const sp = new URLSearchParams(searchParams.toString());
      if (value === 'overview') {
        sp.delete('tab');
      } else {
        sp.set('tab', value);
      }
      const qs = sp.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const persistPending = useCallback(async (): Promise<{
    success: boolean;
    error?: string;
  }> => {
    if (saveInFlightRef.current) {
      return { success: false, error: 'A save is already in progress' };
    }

    const overviewPending = overviewRef.current?.getPendingUpdate() ?? null;
    const typePending =
      isCrunchwork && showTypeDetails
        ? typeDetailsRef.current?.getPendingUpdate() ?? null
        : null;
    const assigneeSnapshot = assignedToUserId;
    const assigneeChanged = assigneeSnapshot !== committedAssignee;

    if (!overviewPending && !typePending && !assigneeChanged) {
      setSaveError(null);
      return { success: true };
    }

    const typeSnapshot = JSON.stringify(typePending);

    saveInFlightRef.current = true;
    setSaving(true);
    setJustSaved(false);
    setSaveError(null);
    try {
      const mergedTypeDetails = {
        ...(overviewPending?.typeDetails ?? {}),
        ...(typePending?.typeDetails ?? {}),
      };
      const result = await updateJobFieldsAction(job.id, {
        ...(overviewPending ?? {}),
        ...(typePending ?? {}),
        ...(assigneeChanged
          ? { assignedToUserId: assigneeSnapshot || null }
          : {}),
        ...(Object.keys(mergedTypeDetails).length > 0
          ? { typeDetails: mergedTypeDetails }
          : { typeDetails: undefined }),
      });
      if (!result.success) {
        const message = result.error ?? 'Failed to save job';
        setSaveError(message);
        return { success: false, error: message };
      }
      if (overviewPending) {
        overviewRef.current?.markClean(overviewPending);
      }
      const typeNow = JSON.stringify(
        isCrunchwork && showTypeDetails
          ? typeDetailsRef.current?.getPendingUpdate() ?? null
          : null,
      );
      if (typePending && typeNow === typeSnapshot) {
        typeDetailsRef.current?.markClean();
      }
      if (assigneeChanged) {
        setCommittedAssignee(assigneeSnapshot);
      }
      setJustSaved(true);
      router.refresh();
      return { success: true };
    } finally {
      saveInFlightRef.current = false;
      setSaving(false);
    }
  }, [
    job.id,
    router,
    isCrunchwork,
    showTypeDetails,
    assignedToUserId,
    committedAssignee,
  ]);

  // Debounced autosave for local draft changes.
  useEffect(() => {
    if (!pageDirty || saving || publishing) return;
    const timer = setTimeout(() => {
      void persistPending();
    }, AUTOSAVE_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [
    pageDirty,
    saving,
    publishing,
    persistPending,
    overviewDirty,
    typeDetailsDirty,
    assignedToUserId,
  ]);

  useEffect(() => {
    if (!justSaved || pageDirty || saving || saveError) return;
    const timer = setTimeout(() => setJustSaved(false), 2000);
    return () => clearTimeout(timer);
  }, [justSaved, pageDirty, saving, saveError]);

  useEffect(() => {
    if (!justPublished || cwPublishPending) return;
    const timer = setTimeout(() => setJustPublished(false), 2000);
    return () => clearTimeout(timer);
  }, [justPublished, cwPublishPending]);

  const handlePublishConfirm = useCallback(async (): Promise<{
    success: boolean;
    error?: string;
  }> => {
    if (!isCrunchwork || !cwPublishPending) {
      return { success: false, error: 'No Crunchwork changes to publish' };
    }
    setPublishing(true);
    setSaveError(null);
    try {
      const result = await persistPending();
      if (!result.success) {
        return {
          success: false,
          error: result.error ?? 'Failed to save job before publishing',
        };
      }
      setCwPublishPending(false);
      setJustPublished(true);
      router.refresh();
      return { success: true };
    } finally {
      setPublishing(false);
    }
  }, [isCrunchwork, cwPublishPending, persistPending, router]);

  const claimId = job.claimId ?? undefined;
  const existingContacts = (
    ((job.apiPayload as Record<string, unknown> | undefined)?.contacts as
      | Array<{
          id?: string;
          firstName?: string;
          lastName?: string;
          name?: string;
          email?: string;
          mobilePhone?: string;
        }>
      | undefined) ?? []
  );

  const openAppointmentDrawer = useCallback(() => {
    const defaults = appointmentCreateDefaultsFromJob(job);
    const parties = jobPartiesFromJob(job);
    setAppointmentCreateDefaults(defaults);
    setAppointmentJobParties(parties);
    setAppointmentDefaultAddress(defaults.address ?? '');
    setAppointmentDrawerOpen(true);
  }, [job]);

  const overviewTabs: Array<{ id: TabValue; label: string; icon: typeof Calendar }> = [
    { id: 'overview', label: 'Overview', icon: Calendar },
    ...(showTypeDetails
      ? [{ id: 'type-details' as TabValue, label: 'Type Details', icon: Info }]
      : []),
    { id: 'parties', label: 'Parties', icon: Users },
    { id: 'reports', label: 'Reports', icon: FileBarChart },
    { id: 'attachments', label: 'Attachments', icon: Paperclip },
    { id: 'timeline', label: 'Timeline', icon: Clock },
  ];

  const printButton = (
    <PrintButton
      documentType="job_details"
      entityId={job.id}
      jobId={job.id}
      reportTypes={JOB_REPORT_TYPES}
    />
  );

  const archiveButton = (
    <ArchiveEntityButton
      entityType="job"
      entityId={job.id}
      statusName={job.status?.name}
      entityLabel={job.name ?? job.externalReference ?? undefined}
      redirectTo="/jobs"
      className="mr-3"
    />
  );

  const showEditActions =
    activeTab === 'overview' || (isCrunchwork && activeTab === 'type-details');

  const canPublish =
    isCrunchwork && cwPublishPending && !saving && !publishing && !saveError;

  const saveStatusLabel = publishing
    ? 'Publishing…'
    : saving
      ? 'Saving…'
      : saveError
        ? 'Save failed'
        : justPublished
          ? 'Published'
          : justSaved
            ? 'Saved'
            : pageDirty
              ? 'Unsaved changes'
              : null;

  let tabActions: ReactNode = null;
  if (showEditActions) {
    tabActions = (
      <>
        {saveStatusLabel && (
          <span
            className={`mr-2 text-sm ${
              saveError
                ? 'text-red-600'
                : saving || publishing || pageDirty
                  ? 'text-slate-500'
                  : 'text-emerald-600'
            }`}
            aria-live="polite"
          >
            {saveStatusLabel}
          </span>
        )}
        {isCrunchwork && (
          <Button
            size="default"
            onClick={() => setPublishWizardOpen(true)}
            disabled={!canPublish}
            className="mr-2 h-9 gap-1.5 px-4 bg-amber-600 text-white hover:bg-amber-500 disabled:bg-slate-300 disabled:text-slate-500"
            title={
              cwPublishPending
                ? 'Review and publish Crunchwork field changes to the insurer'
                : 'Enter Crunchwork fields (e.g. booked or attendance date) to enable Publish'
            }
          >
            <Send className="h-3.5 w-3.5" />
            Publish
          </Button>
        )}
        {printButton}
      </>
    );
  } else if (activeTab === 'parties') {
    tabActions = (
      <Button
        size="default"
        onClick={() => setContactDrawerOpen(true)}
        className="mr-3 h-9 gap-1.5 px-4 bg-blue-600 text-white hover:bg-blue-500"
      >
        <Plus className="h-3.5 w-3.5" />
        Add Contact
      </Button>
    );
  } else if (activeTab === 'reports') {
    tabActions = (
      <Button
        size="default"
        onClick={() => setReportDrawerOpen(true)}
        className="mr-3 h-9 gap-1.5 px-4 bg-blue-600 text-white hover:bg-blue-500"
      >
        <Plus className="h-3.5 w-3.5" />
        Add Report
      </Button>
    );
  }

  const headerActions = (
    <>
      <Button
        size="default"
        onClick={() => setEstimateDrawerOpen(true)}
        className="mr-3 h-9 gap-1.5 px-4 bg-blue-600 text-white hover:bg-blue-500"
      >
        Create Estimate
      </Button>
      {tabActions}
      {archiveButton}
    </>
  );

  // Keep editable tabs mounted so draft state survives tab switches.
  const keepOverviewMounted = true;
  const keepTypeDetailsMounted = showTypeDetails;

  return (
    <div className="flex flex-col">
      <SetHeaderActions>{headerActions}</SetHeaderActions>
      <div className="flex w-full flex-wrap items-center gap-x-4 border-b border-slate-200">
        <div className="flex min-w-0 flex-1 flex-wrap gap-0">
          {overviewTabs.map((t) => {
            const Icon = t.icon;
            const active = activeTab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => onTabChange(t.id)}
                className={`inline-flex items-center gap-1.5 px-4 py-3 text-sm font-medium transition-colors border-b-2 -mb-px rounded-t-md ${
                  active
                    ? 'border-emerald-600 bg-emerald-50 text-emerald-600'
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
          assigneeName={job.assigneeName}
          assignedToUserId={assignedToUserId || null}
          editing={showEditActions}
          saving={false}
          onChange={(userId) => setAssignedToUserId(userId ?? '')}
          provider={job.provider}
        />
      </div>
      <div className="pt-4">
        {saveError && (
          <div className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {saveError}
          </div>
        )}
        {keepOverviewMounted && (
          <div className={activeTab === 'overview' ? '' : 'hidden'}>
            <JobOverviewTab
              ref={overviewRef}
              job={job}
              parentClaim={parentClaim}
              saving={false}
              editing
              statusOptions={statusOptions}
              onDirtyChange={setOverviewDirty}
              onAddAppointment={openAppointmentDrawer}
            />
          </div>
        )}
        {keepTypeDetailsMounted && (
          <div className={activeTab === 'type-details' ? '' : 'hidden'}>
            <JobTypeDetailsTab
              ref={typeDetailsRef}
              job={job}
              editing={isCrunchwork}
              saving={false}
              jobTypeOptions={jobTypeOptions}
              onDirtyChange={setTypeDetailsDirty}
            />
          </div>
        )}
        {activeTab === 'parties' && (
          <JobPartiesTab job={job} typeOptions={contactTypeOptions} />
        )}
        {activeTab === 'reports' && (
          <JobReportsTab
            jobId={job.id}
            claimId={claimId}
            drawerOpen={reportDrawerOpen}
            onDrawerOpenChange={setReportDrawerOpen}
            statusOptions={reportStatusOptions}
            reportTypes={reportTypeOptions}
          />
        )}
        {activeTab === 'attachments' && (
          <EntityAttachmentsTab
            entityId={job.id}
            relatedRecordType="Job"
            entityLabel="this job"
          />
        )}
        {activeTab === 'timeline' && <JobTimelineTab job={job} />}
      </div>

      <AddJobContactsDrawer
        open={contactDrawerOpen}
        onOpenChange={setContactDrawerOpen}
        jobId={job.id}
        existingContacts={existingContacts}
        aiAssistEnabled
      />
      <QuoteFormDrawer
        open={estimateDrawerOpen}
        onOpenChange={setEstimateDrawerOpen}
        jobId={job.id}
        claimId={claimId ?? parentClaim?.id}
      />
      <AppointmentFormDrawer
        open={appointmentDrawerOpen}
        onOpenChange={setAppointmentDrawerOpen}
        jobId={job.id}
        jobParties={appointmentJobParties}
        defaultSelectedParties={appointmentJobParties}
        defaultAddress={appointmentDefaultAddress}
        createDefaults={appointmentCreateDefaults}
        onSuccess={() => router.refresh()}
      />
      {isCrunchwork && (
        <JobPublishWizard
          open={publishWizardOpen}
          onOpenChange={setPublishWizardOpen}
          job={job}
          claim={parentClaim}
          onPublish={handlePublishConfirm}
        />
      )}
    </div>
  );
}
