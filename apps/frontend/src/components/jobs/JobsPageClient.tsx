'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { JobsListClient } from './JobsListClient';
import { JobFormDrawer } from '@/components/forms/JobFormDrawer';
import type { Job, PaginatedResponse } from '@/types/api';

export interface JobsPageClientProps {
  initialData: PaginatedResponse<Job>;
  jobTypes: { id: string; name?: string; providerCode?: string | null }[];
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
  const [refreshNonce, setRefreshNonce] = useState(0);

  return (
    <>
      <JobsListClient
        initialData={initialData}
        statusOptions={statusOptions}
        jobTypes={jobTypeFilterOptions ?? jobTypes}
        unreadJobIds={unreadJobIds}
        refreshNonce={refreshNonce}
        headerAction={
          <Button onClick={() => setDrawerOpen(true)}>Create Job</Button>
        }
      />
      <JobFormDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        jobTypes={jobTypes}
        onSuccess={() => setRefreshNonce((n) => n + 1)}
      />
    </>
  );
}
