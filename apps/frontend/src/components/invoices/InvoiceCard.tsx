'use client';

import Link from 'next/link';
import { Receipt } from 'lucide-react';
import { EntityCard } from '@/components/ui/entity-card';
import type { Invoice } from '@/types/api';

export function InvoiceCard({ invoice }: { invoice: Invoice }) {
  const title = invoice.invoiceNumber ?? invoice.id;
  const poRef = (invoice as { purchaseOrder?: { purchaseOrderNumber?: string } }).purchaseOrder?.purchaseOrderNumber ?? invoice.purchaseOrderId ?? '';
  const statusName = (invoice.status as { name?: string })?.name ?? 'Unknown';
  const totalAmount = invoice.totalAmount ? `$${invoice.totalAmount}` : '';

  return (
    <EntityCard
      href={`/invoices/${invoice.id}`}
      icon={Receipt}
      accentColor="border-l-rose-500"
      title={title}
      subtitle={poRef ? `PO: ${poRef}` : undefined}
      badge={statusName}
      footer={
        <>
          {totalAmount}
          {' • '}
          <Link href={`/purchase-orders/${invoice.purchaseOrderId}`} className="hover:underline">
            PO
          </Link>
        </>
      }
    />
  );
}
