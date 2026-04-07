'use client';

import Link from 'next/link';
import { Receipt } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { StatusBadge } from '@/components/ui/status-badge';
import type { Invoice } from '@/types/api';

export function InvoiceDetail({ invoice }: { invoice: Invoice }) {
  const title = invoice.invoiceNumber ?? invoice.id;
  const statusName = (invoice.status as { name?: string })?.name ?? 'Unknown';
  const totalAmount = invoice.totalAmount ? `$${invoice.totalAmount}` : '—';
  const issueDate = (invoice as unknown as Record<string, unknown>).issueDate as string | undefined;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <Receipt className="h-6 w-6" />
          {title}
        </h1>
        <StatusBadge status={statusName} className="mt-2" />
        {invoice.purchaseOrderId && (
          <p className="mt-2 text-sm text-muted-foreground">
            <Link href={`/purchase-orders/${invoice.purchaseOrderId}`} className="hover:underline">
              View purchase order
            </Link>
          </p>
        )}
      </div>

      <Card>
        <CardHeader className="pb-2">
          <h2 className="text-sm font-medium">Details</h2>
        </CardHeader>
        <CardContent className="text-sm space-y-1">
          <p><span className="text-muted-foreground">Total amount:</span> {totalAmount}</p>
          <p><span className="text-muted-foreground">Issue date:</span> {issueDate ? new Date(issueDate).toLocaleDateString() : '—'}</p>
        </CardContent>
      </Card>
    </div>
  );
}
