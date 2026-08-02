'use client';

import { useState } from 'react';
import { InvoicesListClient } from './InvoicesListClient';
import { InvoiceFormDrawer } from '@/components/forms/InvoiceFormDrawer';
import { Button } from '@/components/ui/button';
import { SetHeaderActions } from '@/components/layout/SetHeaderActions';
import type { Invoice, PaginatedResponse, WorkOrder } from '@/types/api';

export interface InvoicesPageClientProps {
  initialData: PaginatedResponse<Invoice>;
  workOrders: WorkOrder[];
  jobNameById: Record<string, string>;
  statusOptions: { id: string; name: string }[];
}

export function InvoicesPageClient({
  initialData,
  workOrders,
  jobNameById,
  statusOptions,
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
      </SetHeaderActions>
      <InvoicesListClient
        initialData={initialData}
        statusOptions={statusOptions}
        jobNameById={jobNameById}
      />
      <InvoiceFormDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        workOrders={workOrders}
        jobNameById={jobNameById}
      />
    </>
  );
}
