'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { SetHeaderActions } from '@/components/layout/SetHeaderActions';
import { PrintButton } from '@/components/shared/PrintButton';
import { BillFormDrawer } from '@/components/forms/BillFormDrawer';
import type { JobOption } from '@/components/shared/job-label';
import { BillsListClient } from './BillsListClient';
import type { Bill, Job, Claim, PaginatedResponse } from '@/types/api';
import type { StatusOption } from '@/components/shared/list-filters';

export interface BillsPageClientProps {
  initialData: PaginatedResponse<Bill>;
  statusOptions: StatusOption[];
  vendorOptions: StatusOption[];
  jobNameById?: Record<string, string>;
  jobTypeById?: Record<string, string>;
  jobs: JobOption[];
  job?: Job | null;
  parentClaim?: Claim | null;
}

export function BillsPageClient({
  initialData,
  statusOptions,
  vendorOptions,
  jobNameById,
  jobTypeById,
  jobs,
  job,
  parentClaim,
}: BillsPageClientProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <>
      <SetHeaderActions>
        <Button
          size="default"
          onClick={() => setDrawerOpen(true)}
          className="mr-3 h-9 gap-1.5 px-4 bg-blue-600 text-white hover:bg-blue-500"
        >
          Create Bill
        </Button>
        <PrintButton documentType="bills_list" entityId="list" />
      </SetHeaderActions>
      <BillsListClient
        initialData={initialData}
        statusOptions={statusOptions}
        vendorOptions={vendorOptions}
        jobNameById={jobNameById}
        jobTypeById={jobTypeById}
        job={job}
        parentClaim={parentClaim}
      />
      <BillFormDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        jobId={job?.id}
        jobs={jobs}
      />
    </>
  );
}
