'use client';

import { useState } from 'react';
import { InvoicesListClient } from './InvoicesListClient';
import { InvoiceFormDrawer } from '@/components/forms/InvoiceFormDrawer';
import { Button } from '@/components/ui/button';
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
      <InvoicesListClient
        initialData={initialData}
        statusOptions={statusOptions}
        jobNameById={jobNameById}
        headerAction={
          <Button onClick={() => setDrawerOpen(true)}>Submit Invoice</Button>
        }
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
