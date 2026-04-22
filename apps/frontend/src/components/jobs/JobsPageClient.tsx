'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { JobsListClient } from './JobsListClient';
import { JobFormDrawer } from '@/components/forms/JobFormDrawer';
import type { Job, PaginatedResponse } from '@/types/api';
import type { Claim } from '@/types/api';

export interface JobsPageClientProps {
  initialData: PaginatedResponse<Job>;
  claims: Claim[];
  jobTypes: { id: string; name?: string }[];
  statusOptions: { id: string; name: string }[];
}

export function JobsPageClient({
  initialData,
  claims,
  jobTypes,
  statusOptions,
}: JobsPageClientProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <>
      <JobsListClient
        initialData={initialData}
        statusOptions={statusOptions}
        headerAction={
          <Button onClick={() => setDrawerOpen(true)}>Create Job</Button>
        }
      />
      <JobFormDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        claims={claims}
        jobTypes={jobTypes}
      />
    </>
  );
}
