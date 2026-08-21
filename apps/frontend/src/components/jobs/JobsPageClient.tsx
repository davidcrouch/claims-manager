'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { SetHeaderActions } from '@/components/layout/SetHeaderActions';
import { PrintButton } from '@/components/shared/PrintButton';
import { JobsListClient } from './JobsListClient';
import { JobFormDrawer } from '@/components/forms/JobFormDrawer';
import type { JobFormClaimOption } from '@/components/forms/job-form-claim';
import type { Job, PaginatedResponse } from '@/types/api';

export interface JobsPageClientProps {
  initialData: PaginatedResponse<Job>;
  jobTypes: { id: string; name?: string; providerCode?: string | null }[];
  /** All job_type lookups for list filtering (any provider). Falls back to jobTypes. */
  jobTypeFilterOptions?: { id: string; name: string }[];
  /** Claims for the Create Job claim dropdown. */
  claims?: JobFormClaimOption[];
  statusOptions: { id: string; name: string }[];
  unreadJobIds?: string[];
  currentUserId?: string | null;
}

export function JobsPageClient({
  initialData,
  jobTypes,
  jobTypeFilterOptions,
  claims = [],
  statusOptions,
  unreadJobIds,
  currentUserId,
}: JobsPageClientProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [refreshNonce, setRefreshNonce] = useState(0);

  return (
    <>
      <SetHeaderActions>
        <Button
          size="default"
          onClick={() => setDrawerOpen(true)}
          className="mr-3 h-9 gap-1.5 px-4 bg-blue-600 text-white hover:bg-blue-500"
        >
          Create Job
        </Button>
        <PrintButton documentType="jobs_list" entityId="list" />
      </SetHeaderActions>
      <JobsListClient
        initialData={initialData}
        statusOptions={statusOptions}
        jobTypes={jobTypeFilterOptions ?? jobTypes}
        unreadJobIds={unreadJobIds}
        refreshNonce={refreshNonce}
      />
      <JobFormDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        jobTypes={jobTypes}
        claims={claims}
        currentUserId={currentUserId}
        onSuccess={() => {
          // Force the list to refetch when we return from the new job page.
          setRefreshNonce((n) => n + 1);
        }}
      />
    </>
  );
}
