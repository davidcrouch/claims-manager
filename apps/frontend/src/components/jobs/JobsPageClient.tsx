'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { JobsListClient } from './JobsListClient';
import { JobFormDrawer } from '@/components/forms/JobFormDrawer';
import type { Job, PaginatedResponse } from '@/types/api';

export interface JobsPageClientProps {
  initialData: PaginatedResponse<Job>;
  jobTypes: { id: string; name?: string }[];
  /** All job_type lookups for list filtering (any provider). Falls back to jobTypes. */
  jobTypeFilterOptions?: { id: string; name: string }[];
  statusOptions: { id: string; name: string }[];
  unreadJobIds?: string[];
}

export function JobsPageClient({
  initialData,
  jobTypes,
  jobTypeFilterOptions,
  statusOptions,
  unreadJobIds,
}: JobsPageClientProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <>
      <JobsListClient
        initialData={initialData}
        statusOptions={statusOptions}
        jobTypes={jobTypeFilterOptions ?? jobTypes}
        unreadJobIds={unreadJobIds}
        headerAction={
          <Button onClick={() => setDrawerOpen(true)}>Create Job</Button>
        }
      />
      <JobFormDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        jobTypes={jobTypes}
      />
    </>
  );
}
