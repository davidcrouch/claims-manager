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
  Save,
  Plus,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SetHeaderActions } from '@/components/layout/SetHeaderActions';
import { ArchiveEntityButton } from '@/components/shared/ArchiveEntityButton';
import { DetailAssignee } from '@/components/shared/DetailAssignee';
import { AddJobContactsDrawer } from '@/components/forms/AddJobContactsDrawer';
import { PrintButton } from '@/components/shared/PrintButton';
import { JOB_REPORT_TYPES } from '@/components/shared/PrintDocumentDrawer';
import { JobOverviewTab, type JobOverviewTabHandle } from './tabs/JobOverviewTab';
import { JobTypeDetailsTab, type JobTypeDetailsTabHandle } from './tabs/JobTypeDetailsTab';
import { JobPartiesTab } from './tabs/JobPartiesTab';
import { JobReportsTab } from './tabs/JobReportsTab';
import { JobTimelineTab } from './tabs/JobTimelineTab';
import { EntityAttachmentsTab } from '@/components/shared/EntityAttachmentsTab';
import { hasTypeDetails } from './util/jobType';
import { updateJobFieldsAction } from '@/app/(app)/jobs/[id]/actions';
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
}: {
  job: Job;
  parentClaim?: Claim | null;
  statusOptions?: LookupOption[];
  jobTypeOptions?: LookupOption[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const showTypeDetails = hasTypeDetails(job);
  const isCrunchwork = job.provider === 'crunchwork';
  const activeTab = normaliseTab(searchParams.get('tab'), showTypeDetails);
  const overviewRef = useRef<JobOverviewTabHandle>(null);
  const typeDetailsRef = useRef<JobTypeDetailsTabHandle>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [contactDrawerOpen, setContactDrawerOpen] = useState(false);
  const [reportDrawerOpen, setReportDrawerOpen] = useState(false);
  const [assignedToUserId, setAssignedToUserId] = useState(job.assignedToUserId ?? '');
  const [overviewDirty, setOverviewDirty] = useState(false);
  const [typeDetailsDirty, setTypeDetailsDirty] = useState(false);

  const assigneeDirty = assignedToUserId !== (job.assignedToUserId ?? '');
  const pageDirty = overviewDirty || typeDetailsDirty || assigneeDirty;

  useEffect(() => {
    setAssignedToUserId(job.assignedToUserId ?? '');
  }, [job.id, job.assignedToUserId]);

  useEffect(() => {
    setOverviewDirty(false);
    setTypeDetailsDirty(false);
  }, [job.id]);

  useEffect(() => {
    if (activeTab !== 'parties') setContactDrawerOpen(false);
    if (activeTab !== 'reports') setReportDrawerOpen(false);
  }, [activeTab]);

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

  const handleSave = useCallback(async () => {
    const overviewPending = overviewRef.current?.getPendingUpdate() ?? null;
    const typePending =
      isCrunchwork && showTypeDetails
        ? typeDetailsRef.current?.getPendingUpdate() ?? null
        : null;
    const assigneeChanged = assignedToUserId !== (job.assignedToUserId ?? '');

    if (!overviewPending && !typePending && !assigneeChanged) {
      setSaveError(null);
      return;
    }

    setSaving(true);
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
          ? { assignedToUserId: assignedToUserId || null }
          : {}),
        ...(Object.keys(mergedTypeDetails).length > 0
          ? { typeDetails: mergedTypeDetails }
          : { typeDetails: undefined }),
      });
      if (!result.success) {
        setSaveError(result.error ?? 'Failed to save job');
        return;
      }
      typeDetailsRef.current?.markClean();
      router.refresh();
    } finally {
      setSaving(false);
    }
  }, [
    job.id,
    job.assignedToUserId,
    router,
    isCrunchwork,
    showTypeDetails,
    assignedToUserId,
  ]);

  const handleCancel = useCallback(() => {
    overviewRef.current?.reset();
    typeDetailsRef.current?.reset();
    setAssignedToUserId(job.assignedToUserId ?? '');
    setSaveError(null);
  }, [job.assignedToUserId]);

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

  let tabActions: ReactNode = null;
  if (showEditActions) {
    tabActions = (
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
          saving={saving}
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
              saving={saving}
              editing
              statusOptions={statusOptions}
              onDirtyChange={setOverviewDirty}
            />
          </div>
        )}
        {keepTypeDetailsMounted && (
          <div className={activeTab === 'type-details' ? '' : 'hidden'}>
            <JobTypeDetailsTab
              ref={typeDetailsRef}
              job={job}
              editing={isCrunchwork}
              saving={saving}
              jobTypeOptions={jobTypeOptions}
              onDirtyChange={setTypeDetailsDirty}
            />
          </div>
        )}
        {activeTab === 'parties' && <JobPartiesTab job={job} />}
        {activeTab === 'reports' && (
          <JobReportsTab
            jobId={job.id}
            claimId={claimId}
            drawerOpen={reportDrawerOpen}
            onDrawerOpenChange={setReportDrawerOpen}
          />
        )}
        {activeTab === 'attachments' && (
          <EntityAttachmentsTab entityId={job.id} relatedRecordType="Job" entityLabel="this job" />
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
    </div>
  );
}
