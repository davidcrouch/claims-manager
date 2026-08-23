'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { SetHeaderActions } from '@/components/layout/SetHeaderActions';
import { PrintButton } from '@/components/shared/PrintButton';
import { ProposalFormDrawer } from '@/components/forms/ProposalFormDrawer';
import type { JobOption } from '@/components/shared/job-label';
import { ProposalsListClient } from './ProposalsListClient';
import type { PaginatedResponse, Proposal, Job, Claim } from '@/types/api';
import type { StatusOption } from '@/components/shared/list-filters';

export interface ProposalsPageClientProps {
  initialData: PaginatedResponse<Proposal>;
  statusOptions: StatusOption[];
  vendorOptions: StatusOption[];
  jobNameById?: Record<string, string>;
  jobs: JobOption[];
  job?: Job | null;
  parentClaim?: Claim | null;
}

export function ProposalsPageClient({
  initialData,
  statusOptions,
  vendorOptions,
  jobNameById,
  jobs,
  job,
  parentClaim,
}: ProposalsPageClientProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <>
      <SetHeaderActions>
        <Button
          size="default"
          onClick={() => setDrawerOpen(true)}
          className="mr-3 h-9 gap-1.5 px-4 bg-blue-600 text-white hover:bg-blue-500"
        >
          Receive Proposal
        </Button>
        <PrintButton documentType="proposals_list" entityId="list" />
      </SetHeaderActions>
      <ProposalsListClient
        initialData={initialData}
        statusOptions={statusOptions}
        vendorOptions={vendorOptions}
        jobNameById={jobNameById}
        job={job}
        parentClaim={parentClaim}
      />
      <ProposalFormDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        jobId={job?.id}
        jobs={jobs}
      />
    </>
  );
}
