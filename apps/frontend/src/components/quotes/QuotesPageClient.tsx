'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { SetHeaderActions } from '@/components/layout/SetHeaderActions';
import { PrintButton } from '@/components/shared/PrintButton';
import { QuoteFormDrawer } from '@/components/forms/QuoteFormDrawer';
import type { JobOption } from '@/components/shared/job-label';
import { QuotesListClient } from './QuotesListClient';
import type { PaginatedResponse, Quote, Job, Claim } from '@/types/api';
import type { StatusOption } from '@/components/shared/list-filters';

export interface QuotesPageClientProps {
  initialData: PaginatedResponse<Quote>;
  statusOptions: StatusOption[];
  quoteTypes: StatusOption[];
  jobNameById?: Record<string, string>;
  jobTypeById?: Record<string, string>;
  jobAssigneeNameById?: Record<string, string>;
  jobs: JobOption[];
  filterJobs?: { id: string; label: string }[];
  job?: Job | null;
  parentClaim?: Claim | null;
}

export function QuotesPageClient({
  initialData,
  statusOptions,
  quoteTypes,
  jobNameById,
  jobTypeById,
  jobAssigneeNameById,
  jobs,
  filterJobs,
  job,
  parentClaim,
}: QuotesPageClientProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <>
      <SetHeaderActions>
        <Button
          size="default"
          onClick={() => setDrawerOpen(true)}
          className="mr-3 h-9 gap-1.5 px-4 bg-blue-600 text-white hover:bg-blue-500"
        >
          Create Estimate
        </Button>
        <PrintButton documentType="quotes_list" entityId="list" />
      </SetHeaderActions>
      <QuotesListClient
        initialData={initialData}
        statusOptions={statusOptions}
        quoteTypes={quoteTypes}
        jobNameById={jobNameById}
        jobTypeById={jobTypeById}
        jobAssigneeNameById={jobAssigneeNameById}
        filterJobs={filterJobs}
        job={job}
        parentClaim={parentClaim}
      />
      <QuoteFormDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        jobId={job?.id}
        claimId={job?.claimId ?? parentClaim?.id}
        jobs={jobs}
      />
    </>
  );
}
