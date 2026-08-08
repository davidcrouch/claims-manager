'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import {
  Calendar,
  Clock,
  Users,
  Mail,
  FileBarChart,
  Info,
  Save,
  Pencil,
  Plus,
  Printer,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SetHeaderActions } from '@/components/layout/SetHeaderActions';
import { ArchiveEntityButton } from '@/components/shared/ArchiveEntityButton';
import { AddJobContactsDrawer } from '@/components/forms/AddJobContactsDrawer';
import { JobReportWizard } from '@/components/jobs/JobReportWizard';
import { JobOverviewTab, type JobOverviewTabHandle } from './tabs/JobOverviewTab';
import { JobTypeDetailsTab } from './tabs/JobTypeDetailsTab';
import { JobPartiesTab } from './tabs/JobPartiesTab';
import { JobCommunicationsTab } from './tabs/JobCommunicationsTab';
import { JobReportsTab } from './tabs/JobReportsTab';
import { JobTimelineTab } from './tabs/JobTimelineTab';
import { hasTypeDetails } from './util/jobType';
import { updateJobDatesAction } from '@/app/(app)/jobs/[id]/actions';
import type { Job, Claim } from '@/types/api';

const VALID_TABS = [
  'overview',
  'type-details',
  'parties',
  'communications',
  'reports',
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
}: {
  job: Job;
  parentClaim?: Claim | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const showTypeDetails = hasTypeDetails(job);
  const activeTab = normaliseTab(searchParams.get('tab'), showTypeDetails);
  const overviewRef = useRef<JobOverviewTabHandle>(null);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [contactDrawerOpen, setContactDrawerOpen] = useState(false);
  const [reportDrawerOpen, setReportDrawerOpen] = useState(false);
  const [printWizardOpen, setPrintWizardOpen] = useState(false);

  useEffect(() => {
    if (activeTab !== 'overview') setEditing(false);
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
    const pending = overviewRef.current?.getPendingDates();
    if (!pending) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      await updateJobDatesAction(job.id, pending);
      router.refresh();
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }, [job.id, router]);

  const handleCancel = useCallback(() => {
    overviewRef.current?.resetDates();
    setEditing(false);
  }, []);

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
    { id: 'communications', label: 'Communications', icon: Mail },
    { id: 'reports', label: 'Reports', icon: FileBarChart },
    { id: 'timeline', label: 'Timeline', icon: Clock },
  ];

  const printButton = (
    <Button
      size="default"
      onClick={() => setPrintWizardOpen(true)}
      className="h-9 w-9 px-0 bg-blue-600 text-white hover:bg-blue-500"
      title="Print report"
      aria-label="Print report"
    >
      <Printer className="h-4 w-4" />
    </Button>
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

  let tabActions: ReactNode = null;
  if (activeTab === 'overview') {
    tabActions = editing ? (
      <>
        <Button
          size="default"
          variant="outline"
          onClick={handleCancel}
          disabled={saving}
          className="h-9 gap-1.5 px-4"
        >
          Cancel
        </Button>
        <Button
          size="default"
          onClick={handleSave}
          disabled={saving}
          className="h-9 gap-1.5 px-4 bg-blue-600 text-white hover:bg-blue-500"
        >
          <Save className="h-3.5 w-3.5" />
          {saving ? 'Saving...' : 'Save'}
        </Button>
        {printButton}
      </>
    ) : (
      <>
        <Button
          size="default"
          onClick={() => setEditing(true)}
          className="h-9 gap-1.5 px-4 bg-blue-600 text-white hover:bg-blue-500"
        >
          <Pencil className="h-3.5 w-3.5" />
          Edit
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

  return (
    <div className="flex flex-col">
      <SetHeaderActions>{headerActions}</SetHeaderActions>
      <div className="flex items-center border-b border-slate-200">
        <div className="flex flex-wrap gap-0">
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
      </div>
      <div className="pt-4">
        {activeTab === 'overview' && (
          <JobOverviewTab
            ref={overviewRef}
            job={job}
            parentClaim={parentClaim}
            saving={saving}
            editing={editing}
          />
        )}
        {activeTab === 'type-details' && showTypeDetails && (
          <JobTypeDetailsTab job={job} />
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
        {activeTab === 'communications' && (
          <JobCommunicationsTab jobId={job.id} />
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
      <JobReportWizard
        open={printWizardOpen}
        onOpenChange={setPrintWizardOpen}
        jobId={job.id}
      />
    </div>
  );
}
