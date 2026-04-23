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
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
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

  return (
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={onTabChange}>
        <TabsList className="flex-wrap">
          <TabsTrigger value="overview">
            <Calendar className="h-3.5 w-3.5" /> Overview
          </TabsTrigger>
          {showTypeDetails && (
            <TabsTrigger value="type-details">
              <Info className="h-3.5 w-3.5" /> Type Details
            </TabsTrigger>
          )}
          <TabsTrigger value="parties">
            <Users className="h-3.5 w-3.5" /> Parties
          </TabsTrigger>
          <TabsTrigger value="appointments">
            <Calendar className="h-3.5 w-3.5" /> Appointments
          </TabsTrigger>
          <TabsTrigger value="quotes">
            <FileText className="h-3.5 w-3.5" /> Quotes
          </TabsTrigger>
          <TabsTrigger value="purchase-orders">
            <FileSignature className="h-3.5 w-3.5" /> Purchase Orders
          </TabsTrigger>
          <TabsTrigger value="invoices">
            <Receipt className="h-3.5 w-3.5" /> Invoices
          </TabsTrigger>
          <TabsTrigger value="tasks">
            <ListTodo className="h-3.5 w-3.5" /> Tasks
          </TabsTrigger>
          <TabsTrigger value="messages">
            <MessageSquare className="h-3.5 w-3.5" /> Messages
          </TabsTrigger>
          <TabsTrigger value="reports">
            <FileBarChart className="h-3.5 w-3.5" /> Reports
          </TabsTrigger>
          <TabsTrigger value="attachments">
            <Paperclip className="h-3.5 w-3.5" /> Attachments
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="pt-4">
          <JobOverviewTab job={job} parentClaim={parentClaim} />
        </TabsContent>
        {showTypeDetails && (
          <TabsContent value="type-details" className="pt-4">
            <JobTypeDetailsTab job={job} />
          </TabsContent>
        )}
        <TabsContent value="parties" className="pt-4">
          <JobPartiesTab job={job} />
        </TabsContent>
        <TabsContent value="appointments" className="pt-4">
          <JobAppointmentsTab jobId={job.id} />
        </TabsContent>
        <TabsContent value="quotes" className="pt-4">
          <JobQuotesTab jobId={job.id} claimId={claimId} />
        </TabsContent>
        <TabsContent value="purchase-orders" className="pt-4">
          <JobPurchaseOrdersTab jobId={job.id} />
        </TabsContent>
        <TabsContent value="invoices" className="pt-4">
          <JobInvoicesTab jobId={job.id} />
        </TabsContent>
        <TabsContent value="tasks" className="pt-4">
          <JobTasksTab jobId={job.id} />
        </TabsContent>
        <TabsContent value="messages" className="pt-4">
          <JobMessagesTab jobId={job.id} claimId={claimId} />
        </TabsContent>
        <TabsContent value="reports" className="pt-4">
          <JobReportsTab jobId={job.id} claimId={claimId} />
        </TabsContent>
        <TabsContent value="attachments" className="pt-4">
          <JobAttachmentsTab jobId={job.id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
