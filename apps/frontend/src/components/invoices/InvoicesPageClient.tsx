'use client';

import { useState } from 'react';
import { InvoicesListClient } from './InvoicesListClient';
import { InvoiceFormDrawer } from '@/components/forms/InvoiceFormDrawer';
import { Button } from '@/components/ui/button';
import { SetHeaderActions } from '@/components/layout/SetHeaderActions';
import { PrintButton } from '@/components/shared/PrintButton';
import type { Claim, Invoice, Job, PaginatedResponse, WorkOrder } from '@/types/api';

export interface InvoicesPageClientProps {
  initialData: PaginatedResponse<Invoice>;
  workOrders: WorkOrder[];
  jobNameById: Record<string, string>;
  jobTypeById?: Record<string, string>;
  statusOptions: { id: string; name: string }[];
  job?: Job | null;
  parentClaim?: Claim | null;
}

export function InvoicesPageClient({
  initialData,
  workOrders,
  jobNameById,
  jobTypeById,
  statusOptions,
  job,
  parentClaim,
}: InvoicesPageClientProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <>
      <SetHeaderActions>
        <Button
          size="default"
          onClick={() => setDrawerOpen(true)}
          className="mr-3 h-9 gap-1.5 px-4 bg-blue-600 text-white hover:bg-blue-500"
        >
          Create Invoice
        </Button>
        <PrintButton documentType="invoices_list" entityId="list" />
      </SetHeaderActions>
      <InvoicesListClient
        initialData={initialData}
        statusOptions={statusOptions}
        jobNameById={jobNameById}
        jobTypeById={jobTypeById}
        job={job}
        parentClaim={parentClaim}
      />
      <InvoiceFormDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        workOrders={
          job ? workOrders.filter((wo) => wo.jobId === job.id) : workOrders
        }
        jobNameById={jobNameById}
      />
    </>
  );
}
