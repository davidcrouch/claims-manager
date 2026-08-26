'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { SetHeaderActions } from '@/components/layout/SetHeaderActions';
import { PrintButton } from '@/components/shared/PrintButton';
import { WorkOrderFormDrawer } from '@/components/forms/WorkOrderFormDrawer';
import type { JobOption } from '@/components/shared/job-label';
import { WorkOrdersListClient } from './WorkOrdersListClient';
import type { PaginatedResponse, WorkOrder, Job, Claim } from '@/types/api';
import type { StatusOption } from '@/components/shared/list-filters';

export interface WorkOrdersPageClientProps {
  initialData: PaginatedResponse<WorkOrder>;
  statusOptions: StatusOption[];
  workOrderTypes: StatusOption[];
  jobNameById?: Record<string, string>;
  jobTypeById?: Record<string, string>;
  jobs: JobOption[];
  job?: Job | null;
  parentClaim?: Claim | null;
}

export function WorkOrdersPageClient({
  initialData,
  statusOptions,
  workOrderTypes,
  jobNameById,
  jobTypeById,
  jobs,
  job,
  parentClaim,
}: WorkOrdersPageClientProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <>
      <SetHeaderActions>
        <Button
          size="default"
          onClick={() => setDrawerOpen(true)}
          className="mr-3 h-9 gap-1.5 px-4 bg-blue-600 text-white hover:bg-blue-500"
        >
          Create Work Order
        </Button>
        <PrintButton documentType="work_orders_list" entityId="list" />
      </SetHeaderActions>
      <WorkOrdersListClient
        initialData={initialData}
        statusOptions={statusOptions}
        workOrderTypes={workOrderTypes}
        jobNameById={jobNameById}
        jobTypeById={jobTypeById}
        job={job}
        parentClaim={parentClaim}
      />
      <WorkOrderFormDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        jobId={job?.id}
        jobs={jobs}
      />
    </>
  );
}
