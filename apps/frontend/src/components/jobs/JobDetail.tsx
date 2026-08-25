'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { flushSync } from 'react-dom';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import {
  Calendar,
  Clock,
  Users,
  FileBarChart,
  Info,
  Paperclip,
  Plus,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { HeaderActionToolbar } from '@/components/layout/HeaderActionToolbar';
import { SetHeaderActions } from '@/components/layout/SetHeaderActions';
import { ArchiveEntityButton } from '@/components/shared/ArchiveEntityButton';
import { DetailAssignee } from '@/components/shared/DetailAssignee';
import { AddJobContactsDrawer } from '@/components/forms/AddJobContactsDrawer';
import { PrintButton } from '@/components/shared/PrintButton';
import { PublishButton } from '@/components/shared/PublishButton';
import { buildJobReportTypes } from '@/components/shared/PrintDocumentDrawer';
import { QuoteFormDrawer } from '@/components/forms/QuoteFormDrawer';
import {
  AppointmentFormDrawer,
  type AppointmentCreateDefaults,
  type JobParty,
} from '@/components/forms/AppointmentFormDrawer';
import type { AddressParts } from '@/components/shared/AddressAutocompleteInput';
import { JobOverviewTab, type JobOverviewTabHandle } from './tabs/JobOverviewTab';
import { JobTypeDetailsTab, type JobTypeDetailsSnapshot, type JobTypeDetailsTabHandle } from './tabs/JobTypeDetailsTab';
import { JobPartiesTab } from './tabs/JobPartiesTab';
import { JobReportsTab } from './tabs/JobReportsTab';
import { JobTimelineTab } from './tabs/JobTimelineTab';
import { JobPublishWizard } from './JobPublishWizard';
import { JobCreateMakeSafeDrawer } from './JobCreateMakeSafeDrawer';
import { EntityAttachmentsTab } from '@/components/shared/EntityAttachmentsTab';
import { hasTypeDetails } from './util/jobType';
import { updateJobFieldsAction } from '@/app/(app)/jobs/[id]/actions';
import { formatAddress, asString, pick } from '@/components/shared/detail';
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
import type { JobOverviewDraft, LookupOption } from './job-edit.types';
import type { Job, Claim, Assessment } from '@/types/api';

const BUILDER_MAKE_SAFE_TYPE_NAME = 'builder make safe';

const VALID_TABS = [
  'overview',
  'type-details',
  'parties',
  'reports',
  'attachments',
  'timeline',
] as const;

type TabValue = (typeof VALID_TABS)[number];

type JobFieldsSnapshot = {
  assignedToUserId: string;
  overview: JobOverviewDraft;
  typeDetails: JobTypeDetailsSnapshot | null;
};

const EMPTY_OVERVIEW: JobOverviewDraft = {
  bookedDate: '',
  attendanceDate: '',
  statusLookupId: '',
  statusExternalReference: '',
  jobInstructions: '',
  vendorExtRef: '',
};

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

function jobAddressParts(job: Job): AddressParts | undefined {
  const src = jobAddressSource(job);
  const parts: AddressParts = {
    unitNumber: asString(src.unitNumber) ?? undefined,
    streetNumber: asString(src.streetNumber) ?? undefined,
    streetName: asString(src.streetName) ?? undefined,
    suburb: job.addressSuburb ?? asString(src.suburb) ?? undefined,
    state: job.addressState ?? asString(src.state) ?? undefined,
    postcode: job.addressPostcode ?? asString(src.postcode) ?? undefined,
    country: job.addressCountry ?? asString(src.country) ?? undefined,
  };
  return Object.values(parts).some((value) => value?.trim()) ? parts : undefined;
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
  const addressParts = jobAddressParts(job);
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
    addressParts,
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
  assessments = [],
  makeSafeJobType,
}: {
  job: Job;
  parentClaim?: Claim | null;
  statusOptions?: LookupOption[];
  jobTypeOptions?: LookupOption[];
  contactTypeOptions?: LookupOption[];
  reportStatusOptions?: LookupOption[];
  reportTypeOptions?: LookupOption[];
  assessments?: Assessment[];
  /** Builder Make Safe lookup used by Create Make-Safe. */
  makeSafeJobType?: LookupOption | null;
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
  const skipFieldUndoRef = useRef(false);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState(false);
  const [justPublished, setJustPublished] = useState(false);
  const [fieldEditTick, setFieldEditTick] = useState(0);
  const [undoStack, setUndoStack] = useState<JobFieldsSnapshot[]>([]);
  const [contactDrawerOpen, setContactDrawerOpen] = useState(false);
  const [reportDrawerOpen, setReportDrawerOpen] = useState(false);
  const [estimateDrawerOpen, setEstimateDrawerOpen] = useState(false);
  const [appointmentDrawerOpen, setAppointmentDrawerOpen] = useState(false);
  const [appointmentCreateDefaults, setAppointmentCreateDefaults] =
    useState<AppointmentCreateDefaults | undefined>(undefined);
  const [appointmentJobParties, setAppointmentJobParties] = useState<JobParty[]>([]);
  const [appointmentDefaultAddress, setAppointmentDefaultAddress] = useState('');
  const [publishWizardOpen, setPublishWizardOpen] = useState(false);
  const [makeSafeDrawerOpen, setMakeSafeDrawerOpen] = useState(false);
  const [assignedToUserId, setAssignedToUserId] = useState(job.assignedToUserId ?? '');
  const [committedAssignee, setCommittedAssignee] = useState(job.assignedToUserId ?? '');
  const assignedToUserIdRef = useRef(assignedToUserId);
  assignedToUserIdRef.current = assignedToUserId;
  const [overviewDirty, setOverviewDirty] = useState(false);
  const [typeDetailsDirty, setTypeDetailsDirty] = useState(false);
  /** Sticky: CW field edits enable Publish until the user clicks Publish (survives autosave). */
  const [cwPublishPending, setCwPublishPending] = useState(false);

  const assigneeDirty = assignedToUserId !== committedAssignee;
  const pageDirty = overviewDirty || typeDetailsDirty || assigneeDirty;
  const anySaving = saving || publishing;
  const canUndo = pageDirty || undoStack.length > 0;
  /** Overview + type-details drafts are the CW-bound fields (not assignee). */
  const cwFieldsDirty = overviewDirty || typeDetailsDirty;

  const pushUndo = useCallback((entry: JobFieldsSnapshot) => {
    setUndoStack((prev) => pushUndoEntry(prev, entry, MAX_UNDO));
  }, []);

  const captureFieldSnapshot = useCallback((): JobFieldsSnapshot => {
    return cloneJson({
      assignedToUserId: committedAssignee,
      overview: overviewRef.current?.getBaseline() ?? EMPTY_OVERVIEW,
      typeDetails:
        isCrunchwork && showTypeDetails
          ? typeDetailsRef.current?.getBaseline() ?? null
          : null,
    });
  }, [committedAssignee, isCrunchwork, showTypeDetails]);

  const handleOverviewDirty = useCallback((dirty: boolean) => {
    setOverviewDirty(dirty);
    setFieldEditTick((n) => n + 1);
  }, []);

  const handleTypeDetailsDirty = useCallback((dirty: boolean) => {
    setTypeDetailsDirty(dirty);
    setFieldEditTick((n) => n + 1);
  }, []);

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
    setUndoStack([]);
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

  const persistPending = useCallback(async (opts?: {
    forceDates?: boolean;
  }): Promise<{
    success: boolean;
    error?: string;
  }> => {
    if (saveInFlightRef.current) {
      return { success: false, error: 'A save is already in progress' };
    }

    const overviewPending = overviewRef.current?.getPendingUpdate() ?? null;
    const publishDates = opts?.forceDates
      ? overviewRef.current?.getCurrentDates() ?? null
      : null;
    const hasPublishDates = Boolean(
      publishDates?.bookedDate || publishDates?.attendanceDate,
    );
    const typePending =
      isCrunchwork && showTypeDetails
        ? typeDetailsRef.current?.getPendingUpdate() ?? null
        : null;
    const assigneeSnapshot = assignedToUserIdRef.current;
    const assigneeChanged = assigneeSnapshot !== committedAssignee;

    if (!overviewPending && !typePending && !assigneeChanged && !hasPublishDates) {
      setSaveError(null);
      return { success: true };
    }

    const undoSnapshot = skipFieldUndoRef.current ? null : captureFieldSnapshot();
    skipFieldUndoRef.current = false;

    const typeSnapshot = JSON.stringify(typePending);
    const overviewPayload = {
      ...(overviewPending ?? {}),
      ...(hasPublishDates
        ? {
            bookedDate: publishDates?.bookedDate ?? null,
            attendanceDate: publishDates?.attendanceDate ?? null,
          }
        : {}),
    };

    saveInFlightRef.current = true;
    setSaving(true);
    setJustSaved(false);
    setSaveError(null);
    try {
      const mergedTypeDetails = {
        ...(overviewPayload.typeDetails ?? {}),
        ...(typePending?.typeDetails ?? {}),
      };
      const result = await updateJobFieldsAction(job.id, {
        ...overviewPayload,
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
      if (overviewPending || hasPublishDates) {
        overviewRef.current?.markClean(overviewPayload);
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
      if (undoSnapshot) {
        pushUndo(undoSnapshot);
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
    committedAssignee,
    captureFieldSnapshot,
    pushUndo,
  ]);

  // Debounced autosave for local draft changes.
  useEffect(() => {
    if (!pageDirty || anySaving) return;
    const timer = setTimeout(() => {
      void persistPending();
    }, AUTOSAVE_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [
    pageDirty,
    anySaving,
    persistPending,
    fieldEditTick,
    assignedToUserId,
  ]);

  useEffect(() => {
    if (!justSaved || pageDirty || anySaving || saveError) return;
    const timer = setTimeout(() => setJustSaved(false), SAVE_STATUS_CLEAR_MS);
    return () => clearTimeout(timer);
  }, [justSaved, pageDirty, anySaving, saveError]);

  useEffect(() => {
    if (!justPublished || cwPublishPending) return;
    const timer = setTimeout(() => setJustPublished(false), SAVE_STATUS_CLEAR_MS);
    return () => clearTimeout(timer);
  }, [justPublished, cwPublishPending]);

  const handleUndo = useCallback(() => {
    if (anySaving) return;

    if (pageDirty) {
      overviewRef.current?.reset();
      typeDetailsRef.current?.reset();
      setAssignedToUserId(committedAssignee);
      setSaveError(null);
      return;
    }

    const entry = undoStack[undoStack.length - 1];
    if (!entry) return;
    setUndoStack((prev) => prev.slice(0, -1));

    skipFieldUndoRef.current = true;
    flushSync(() => {
      overviewRef.current?.applyDraft(entry.overview);
      if (entry.typeDetails) {
        typeDetailsRef.current?.applyDraft(entry.typeDetails);
      }
      setAssignedToUserId(entry.assignedToUserId);
    });
    void persistPending();
  }, [anySaving, pageDirty, undoStack, committedAssignee, persistPending]);

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
      const result = await persistPending({ forceDates: true });
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
  const isAlreadyMakeSafe =
    (job.jobType?.name ?? '').trim().toLowerCase() === BUILDER_MAKE_SAFE_TYPE_NAME;
  const canCreateMakeSafe =
    Boolean(claimId) &&
    Boolean(makeSafeJobType?.id) &&
    !isAlreadyMakeSafe;
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

  const jobReportTypes = useMemo(
    () => buildJobReportTypes(job.id, assessments),
    [job.id, assessments],
  );

  const printButton = (
    <PrintButton
      documentType="job_details"
      entityId={job.id}
      jobId={job.id}
      reportTypes={jobReportTypes}
    />
  );

  const archiveButton = (
    <ArchiveEntityButton
      entityType="job"
      entityId={job.id}
      statusName={job.status?.name}
      entityLabel={job.name ?? job.externalReference ?? undefined}
      redirectTo="/jobs"
    />
  );

  const canPublish =
    isCrunchwork && cwPublishPending && !saving && !publishing && !saveError;

  const showEditActions =
    activeTab === 'overview' || (isCrunchwork && activeTab === 'type-details');

  const { label: saveStatusLabel, tone: saveStatusTone } = detailSaveStatus({
    saving,
    publishing,
    saveError,
    justSaved,
    justPublished,
    dirty: pageDirty,
  });

  let tabActions: ReactNode = null;
  if (activeTab === 'parties') {
    tabActions = (
      <Button
        size="default"
        onClick={() => setContactDrawerOpen(true)}
        className="h-9 gap-1.5 px-4 bg-blue-600 text-white hover:bg-blue-500"
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
        className="h-9 gap-1.5 px-4 bg-blue-600 text-white hover:bg-blue-500"
      >
        <Plus className="h-3.5 w-3.5" />
        Add Report
      </Button>
    );
  }

  const headerActions = (
    <>
      {canCreateMakeSafe && (
        <Button
          size="default"
          onClick={() => setMakeSafeDrawerOpen(true)}
          className="h-9 gap-1.5 px-4 bg-blue-600 text-white hover:bg-blue-500"
        >
          Create Make-Safe
        </Button>
      )}
      <Button
        size="default"
        onClick={() => setEstimateDrawerOpen(true)}
        className="h-9 gap-1.5 px-4 bg-blue-600 text-white hover:bg-blue-500"
      >
        Create Estimate
      </Button>
      {tabActions}
      <DetailSaveStatus statusLabel={saveStatusLabel} tone={saveStatusTone} />
      <HeaderActionToolbar>
        <DetailUndoButton
          canUndo={canUndo}
          undoDisabled={anySaving}
          onUndo={handleUndo}
        />
        {isCrunchwork && (
          <PublishButton
            onClick={() => setPublishWizardOpen(true)}
            disabled={!canPublish}
            title={
              cwPublishPending
                ? 'Review and publish Crunchwork field changes to the insurer'
                : 'Enter Crunchwork fields (e.g. booked or attendance date) to enable Publish'
            }
          />
        )}
        {printButton}
        {archiveButton}
      </HeaderActionToolbar>
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
              onDirtyChange={handleOverviewDirty}
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
              onDirtyChange={handleTypeDetailsDirty}
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
      {canCreateMakeSafe && makeSafeJobType?.id && (
        <JobCreateMakeSafeDrawer
          open={makeSafeDrawerOpen}
          onOpenChange={setMakeSafeDrawerOpen}
          job={job}
          claim={parentClaim}
          makeSafeJobTypeId={makeSafeJobType.id}
          makeSafeJobTypeName={makeSafeJobType.name ?? 'Builder Make Safe'}
        />
      )}
    </div>
  );
}
