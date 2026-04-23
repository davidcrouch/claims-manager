'use client';

import Link from 'next/link';
import { Receipt, ExternalLink } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { StatusBadge } from '@/components/ui/status-badge';
import { BackButton } from '@/components/layout/BackButton';
import type { Invoice } from '@/types/api';

export function InvoicePageHeader({ invoice }: { invoice: Invoice }) {
  const title = invoice.invoiceNumber ?? invoice.id;
  const statusName = (invoice.status as { name?: string })?.name ?? 'Unknown';

  return (
    <div className="flex w-full flex-wrap items-center gap-x-3 gap-y-1">
      <BackButton href="/invoices" label="Back to invoices" />
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-teal-100">
        <Receipt className="h-4 w-4 text-teal-600" />
      </span>
      <h1 className="truncate text-lg font-semibold leading-tight">{title}</h1>
      <StatusBadge status={statusName} />
      {invoice.purchaseOrderId && (
        <Link
          href={`/purchase-orders/${invoice.purchaseOrderId}`}
          className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
        >
          View purchase order
          <ExternalLink className="h-3 w-3" />
        </Link>
      )}
    </div>
  );
}

export function InvoiceDetail({ invoice }: { invoice: Invoice }) {
  const totalAmount = invoice.totalAmount ? `$${invoice.totalAmount}` : '—';
  const issueDate = (invoice as unknown as Record<string, unknown>).issueDate as string | undefined;

  return (
    <div className="space-y-6">
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
