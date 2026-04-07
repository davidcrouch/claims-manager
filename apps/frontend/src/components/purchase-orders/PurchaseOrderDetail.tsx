'use client';

import Link from 'next/link';
import { ShoppingCart } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { StatusBadge } from '@/components/ui/status-badge';
import type { PurchaseOrder } from '@/types/api';

export function PurchaseOrderDetail({ po }: { po: PurchaseOrder }) {
  const title = po.purchaseOrderNumber ?? po.externalId ?? po.id;
  const statusName = (po.status as { name?: string })?.name ?? 'Unknown';
  const totalAmount = po.totalAmount ? `$${po.totalAmount}` : '—';
  const vendorName = (po.vendor as { name?: string })?.name ?? '—';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <ShoppingCart className="h-6 w-6" />
          {title}
        </h1>
        <StatusBadge status={statusName} className="mt-2" />
        {po.jobId && (
          <p className="mt-2 text-sm text-muted-foreground">
            <Link href={`/jobs/${po.jobId}`} className="hover:underline">
              View job
            </Link>
          </p>
        )}
      </div>

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
