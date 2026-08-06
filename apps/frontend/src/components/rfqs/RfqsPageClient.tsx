'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { SetHeaderActions } from '@/components/layout/SetHeaderActions';
import { PrintButton } from '@/components/shared/PrintButton';
import { RfqFormDrawer } from '@/components/forms/RfqFormDrawer';
import type { JobOption } from '@/components/shared/job-label';
import { RfqsListClient } from './RfqsListClient';
import type { PaginatedResponse, Rfq, Job, Claim } from '@/types/api';
import type { StatusOption } from '@/components/shared/list-filters';

export interface RfqsPageClientProps {
  initialData: PaginatedResponse<Rfq>;
  statusOptions: StatusOption[];
  vendorOptions: StatusOption[];
  jobNameById?: Record<string, string>;
  jobs: JobOption[];
  job?: Job | null;
  parentClaim?: Claim | null;
}

export function RfqsPageClient({
  initialData,
  statusOptions,
  vendorOptions,
  jobNameById,
  jobs,
  job,
  parentClaim,
}: RfqsPageClientProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <>
      <SetHeaderActions>
        <Button
          size="default"
          onClick={() => setDrawerOpen(true)}
          className="mr-3 h-9 gap-1.5 px-4 bg-blue-600 text-white hover:bg-blue-500"
        >
          Create RFQ
        </Button>
        <PrintButton documentType="rfqs_list" entityId="list" />
      </SetHeaderActions>
      <RfqsListClient
        initialData={initialData}
        statusOptions={statusOptions}
        vendorOptions={vendorOptions}
        jobNameById={jobNameById}
        job={job}
        parentClaim={parentClaim}
      />
      <RfqFormDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        jobId={job?.id}
        jobs={jobs}
      />
    </>
  );
}
