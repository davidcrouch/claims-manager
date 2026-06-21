'use client';

import { useCallback } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import {
  Calendar,
  Clock,
  Users,
  Mail,
  FileBarChart,
  Info,
} from 'lucide-react';
import { JobOverviewTab } from './tabs/JobOverviewTab';
import { JobTypeDetailsTab } from './tabs/JobTypeDetailsTab';
import { JobPartiesTab } from './tabs/JobPartiesTab';
import { JobAppointmentsTab } from './tabs/JobAppointmentsTab';
import { JobQuotesTab } from './tabs/JobQuotesTab';
import { JobPurchaseOrdersTab } from './tabs/JobPurchaseOrdersTab';
import { JobInvoicesTab } from './tabs/JobInvoicesTab';
import { JobWorkOrdersTab } from './tabs/JobWorkOrdersTab';
import { JobRfqsTab } from './tabs/JobRfqsTab';
import { JobProposalsTab } from './tabs/JobProposalsTab';
import { JobBillsTab } from './tabs/JobBillsTab';
import { JobTasksTab } from './tabs/JobTasksTab';
import { JobMessagesTab } from './tabs/JobMessagesTab';
import { JobReportsTab } from './tabs/JobReportsTab';
import { JobAttachmentsTab } from './tabs/JobAttachmentsTab';
import { JobCommunicationsTab } from './tabs/JobCommunicationsTab';
import { JobTimelineTab } from './tabs/JobTimelineTab';
import { JobJournalsTab } from './tabs/JobJournalsTab';
import { hasTypeDetails } from './util/jobType';
import type { Job, Claim } from '@/types/api';

const VALID_TABS = [
  'overview',
  'type-details',
  'parties',
  'appointments',
  'quotes',
  'work-orders',
  'purchase-orders',
  'invoices',
  'rfqs',
  'proposals',
  'bills',
  'tasks',
  'messages',
  'communications',
  'reports',
  'attachments',
  'journals',
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

  const claimId = job.claimId ?? '';

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

  const showTabBar = overviewTabs.some((t) => t.id === activeTab);

  return (
    <div className="flex flex-col">
      {showTabBar && (
        <div className="flex flex-wrap gap-0 border-b border-slate-200">
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
      )}
      <div className={showTabBar ? 'pt-4' : undefined}>
        {activeTab === 'overview' && (
          <JobOverviewTab job={job} parentClaim={parentClaim} />
        )}
        {activeTab === 'type-details' && showTypeDetails && (
          <JobTypeDetailsTab job={job} />
        )}
        {activeTab === 'parties' && <JobPartiesTab job={job} />}
        {activeTab === 'appointments' && <JobAppointmentsTab jobId={job.id} job={job} />}
        {activeTab === 'quotes' && (
          <JobQuotesTab jobId={job.id} claimId={claimId} />
        )}
        {activeTab === 'work-orders' && (
          <JobWorkOrdersTab jobId={job.id} />
        )}
        {activeTab === 'purchase-orders' && (
          <JobPurchaseOrdersTab jobId={job.id} />
        )}
        {activeTab === 'invoices' && <JobInvoicesTab jobId={job.id} />}
        {activeTab === 'rfqs' && <JobRfqsTab jobId={job.id} />}
        {activeTab === 'proposals' && <JobProposalsTab jobId={job.id} />}
        {activeTab === 'bills' && <JobBillsTab jobId={job.id} />}
        {activeTab === 'tasks' && <JobTasksTab jobId={job.id} />}
        {activeTab === 'messages' && (
          <JobMessagesTab jobId={job.id} claimId={claimId} />
        )}
        {activeTab === 'reports' && (
          <JobReportsTab jobId={job.id} claimId={claimId} />
        )}
        {activeTab === 'communications' && (
          <JobCommunicationsTab jobId={job.id} />
        )}
        {activeTab === 'attachments' && <JobAttachmentsTab jobId={job.id} />}
        {activeTab === 'journals' && <JobJournalsTab jobId={job.id} />}
        {activeTab === 'timeline' && <JobTimelineTab job={job} />}
      </div>
    </div>
  );
}
