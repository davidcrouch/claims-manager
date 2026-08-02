'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { SetHeaderActions } from '@/components/layout/SetHeaderActions';
import { QuoteFormDrawer } from '@/components/forms/QuoteFormDrawer';
import type { JobOption } from '@/components/shared/job-label';
import { QuotesListClient } from './QuotesListClient';
import type { PaginatedResponse, Quote } from '@/types/api';
import type { StatusOption } from '@/components/shared/list-filters';

export interface QuotesPageClientProps {
  initialData: PaginatedResponse<Quote>;
  statusOptions: StatusOption[];
  quoteTypes: StatusOption[];
  jobNameById?: Record<string, string>;
  jobs: JobOption[];
}

export function QuotesPageClient({
  initialData,
  statusOptions,
  quoteTypes,
  jobNameById,
  jobs,
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
      </SetHeaderActions>
      <QuotesListClient
        initialData={initialData}
        statusOptions={statusOptions}
        quoteTypes={quoteTypes}
        jobNameById={jobNameById}
      />
      <QuoteFormDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        jobs={jobs}
      />
    </>
  );
}
