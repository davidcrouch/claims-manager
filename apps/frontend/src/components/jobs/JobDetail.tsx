'use client';

import Link from 'next/link';
import { Briefcase } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { StatusBadge } from '@/components/ui/status-badge';
import { JobOverviewTab } from './JobOverviewTab';
import { JobQuotesTab } from './JobQuotesTab';
import { JobPurchaseOrdersTab } from './JobPurchaseOrdersTab';
import { JobMessagesTab } from './JobMessagesTab';
import { JobReportsTab } from './JobReportsTab';
import type { Job } from '@/types/api';

export function JobDetail({ job }: { job: Job }) {
  const title = job.externalReference ?? job.id;
  const statusName = (job.status as { name?: string })?.name ?? 'Unknown';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <Briefcase className="h-6 w-6" />
          {title}
        </h1>
        <StatusBadge status={statusName} className="mt-2" />
        {job.claimId && (
          <p className="mt-2 text-sm text-muted-foreground">
            <Link href={`/claims/${job.claimId}`} className="hover:underline">
              View claim
            </Link>
          </p>
        )}
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="quotes">Quotes</TabsTrigger>
          <TabsTrigger value="pos">Purchase Orders</TabsTrigger>
          <TabsTrigger value="messages">Messages</TabsTrigger>
          <TabsTrigger value="reports">Reports</TabsTrigger>
        </TabsList>
        <TabsContent value="overview">
          <JobOverviewTab job={job} />
        </TabsContent>
        <TabsContent value="quotes">
          <JobQuotesTab jobId={job.id} claimId={job.claimId ?? ''} />
        </TabsContent>
        <TabsContent value="pos">
          <JobPurchaseOrdersTab jobId={job.id} />
        </TabsContent>
        <TabsContent value="messages">
          <JobMessagesTab jobId={job.id} claimId={job.claimId ?? ''} />
        </TabsContent>
        <TabsContent value="reports">
          <JobReportsTab jobId={job.id} claimId={job.claimId ?? ''} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
