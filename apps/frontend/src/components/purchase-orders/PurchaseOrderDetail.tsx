'use client';

import Link from 'next/link';
import { ShoppingCart, ExternalLink } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { StatusBadge } from '@/components/ui/status-badge';
import { BackButton } from '@/components/layout/BackButton';
import type { PurchaseOrder } from '@/types/api';

export function PurchaseOrderPageHeader({ po }: { po: PurchaseOrder }) {
  const title = po.purchaseOrderNumber ?? po.externalId ?? po.id;
  const statusName = (po.status as { name?: string })?.name ?? 'Unknown';

  return (
    <div className="flex w-full flex-wrap items-center gap-x-3 gap-y-1">
      <BackButton href="/purchase-orders" label="Back to purchase orders" />
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-orange-100">
        <ShoppingCart className="h-4 w-4 text-orange-600" />
      </span>
      <h1 className="truncate text-lg font-semibold leading-tight">{title}</h1>
      <StatusBadge status={statusName} />
      {po.jobId && (
        <Link
          href={`/jobs/${po.jobId}`}
          className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
        >
          View job
          <ExternalLink className="h-3 w-3" />
        </Link>
      )}
    </div>
  );
}

export function PurchaseOrderDetail({ po }: { po: PurchaseOrder }) {
  const totalAmount = po.totalAmount ? `$${po.totalAmount}` : '—';
  const vendorName = (po.vendor as { name?: string })?.name ?? '—';

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <h2 className="text-sm font-medium">Details</h2>
          </CardHeader>
          <CardContent className="text-sm space-y-1">
            <p><span className="text-muted-foreground">Total:</span> {totalAmount}</p>
            <p><span className="text-muted-foreground">Vendor:</span> {vendorName}</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
