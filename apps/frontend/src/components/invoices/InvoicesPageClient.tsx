'use client';

import { useState } from 'react';
import { InvoicesListClient } from './InvoicesListClient';
import { InvoiceFormDrawer } from '@/components/forms/InvoiceFormDrawer';
import { Button } from '@/components/ui/button';
import type { Invoice, PaginatedResponse, PurchaseOrder } from '@/types/api';

export interface InvoicesPageClientProps {
  initialData: PaginatedResponse<Invoice>;
  purchaseOrders: PurchaseOrder[];
}

export function InvoicesPageClient({ initialData, purchaseOrders }: InvoicesPageClientProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <>
      <InvoicesListClient
        initialData={initialData}
        headerAction={
          <Button onClick={() => setDrawerOpen(true)}>Submit Invoice</Button>
        }
      />
      <InvoiceFormDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        purchaseOrders={purchaseOrders}
      />
    </>
  );
}
