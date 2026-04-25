'use client';

import { useCallback } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import {
  Calendar,
  Users,
  FileText,
  FileSignature,
  Receipt,
  ListTodo,
  MessageSquare,
  FileBarChart,
  Paperclip,
  Info,
} from 'lucide-react';
import { JobOverviewTab } from './tabs/JobOverviewTab';
import { JobTypeDetailsTab } from './tabs/JobTypeDetailsTab';
import { JobPartiesTab } from './tabs/JobPartiesTab';
import { JobAppointmentsTab } from './tabs/JobAppointmentsTab';
import { JobQuotesTab } from './tabs/JobQuotesTab';
import { JobPurchaseOrdersTab } from './tabs/JobPurchaseOrdersTab';
import { JobInvoicesTab } from './tabs/JobInvoicesTab';
import { JobTasksTab } from './tabs/JobTasksTab';
import { JobMessagesTab } from './tabs/JobMessagesTab';
import { JobReportsTab } from './tabs/JobReportsTab';
import { JobAttachmentsTab } from './tabs/JobAttachmentsTab';
import { hasTypeDetails } from './util/jobType';
import type { Job, Claim } from '@/types/api';

const VALID_TABS = [
  'overview',
  'type-details',
  'parties',
  'appointments',
  'quotes',
  'purchase-orders',
  'invoices',
  'tasks',
  'messages',
  'reports',
  'attachments',
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

  const tabs: Array<{ id: TabValue; label: string; icon: typeof Calendar }> = [
    { id: 'overview', label: 'Overview', icon: Calendar },
    ...(showTypeDetails
      ? [{ id: 'type-details' as TabValue, label: 'Type Details', icon: Info }]
      : []),
    { id: 'parties', label: 'Parties', icon: Users },
    { id: 'appointments', label: 'Appointments', icon: Calendar },
    { id: 'quotes', label: 'Quotes', icon: FileText },
    { id: 'purchase-orders', label: 'Purchase Orders', icon: FileSignature },
    { id: 'invoices', label: 'Invoices', icon: Receipt },
    { id: 'tasks', label: 'Tasks', icon: ListTodo },
    { id: 'messages', label: 'Messages', icon: MessageSquare },
    { id: 'reports', label: 'Reports', icon: FileBarChart },
    { id: 'attachments', label: 'Attachments', icon: Paperclip },
  ];

  return (
    <div className="flex flex-col">
      <div className="flex flex-wrap gap-0 border-b border-slate-200">
        {tabs.map((t) => {
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
      <div className="pt-4">
        {activeTab === 'overview' && (
          <JobOverviewTab job={job} parentClaim={parentClaim} />
        )}
        {activeTab === 'type-details' && showTypeDetails && (
          <JobTypeDetailsTab job={job} />
        )}
        {activeTab === 'parties' && <JobPartiesTab job={job} />}
        {activeTab === 'appointments' && <JobAppointmentsTab jobId={job.id} />}
        {activeTab === 'quotes' && (
          <JobQuotesTab jobId={job.id} claimId={claimId} />
        )}
        {activeTab === 'purchase-orders' && (
          <JobPurchaseOrdersTab jobId={job.id} />
        )}
        {activeTab === 'invoices' && <JobInvoicesTab jobId={job.id} />}
        {activeTab === 'tasks' && <JobTasksTab jobId={job.id} />}
        {activeTab === 'messages' && (
          <JobMessagesTab jobId={job.id} claimId={claimId} />
        )}
        {activeTab === 'reports' && (
          <JobReportsTab jobId={job.id} claimId={claimId} />
        )}
        {activeTab === 'attachments' && <JobAttachmentsTab jobId={job.id} />}
      </div>
    </div>
  );
}
