'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { SetHeaderActions } from '@/components/layout/SetHeaderActions';
import { PurchaseOrderFormDrawer } from '@/components/forms/PurchaseOrderFormDrawer';
import type { JobOption } from '@/components/shared/job-label';
import { PurchaseOrdersListClient } from './PurchaseOrdersListClient';
import type { PaginatedResponse, PurchaseOrder } from '@/types/api';
import type { StatusOption } from '@/components/shared/list-filters';

export interface PurchaseOrdersPageClientProps {
  initialData: PaginatedResponse<PurchaseOrder>;
  statusOptions: StatusOption[];
  vendorOptions: StatusOption[];
  jobNameById?: Record<string, string>;
  jobs: JobOption[];
}

export function PurchaseOrdersPageClient({
  initialData,
  statusOptions,
  vendorOptions,
  jobNameById,
  jobs,
}: PurchaseOrdersPageClientProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <>
      <SetHeaderActions>
        <Button
          size="default"
          onClick={() => setDrawerOpen(true)}
          className="mr-3 h-9 gap-1.5 px-4 bg-blue-600 text-white hover:bg-blue-500"
        >
          Create PO
        </Button>
      </SetHeaderActions>
      <PurchaseOrdersListClient
        initialData={initialData}
        statusOptions={statusOptions}
        vendorOptions={vendorOptions}
        jobNameById={jobNameById}
      />
      <PurchaseOrderFormDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        jobs={jobs}
      />
    </>
  );
}
