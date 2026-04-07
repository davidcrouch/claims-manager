'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { fetchJobPurchaseOrdersAction } from '@/app/(app)/jobs/[id]/actions';
import { Card, CardContent } from '@/components/ui/card';
import type { PurchaseOrder } from '@/types/api';

export function JobPurchaseOrdersTab({ jobId }: { jobId: string }) {
  const [pos, setPos] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchJobPurchaseOrdersAction(jobId).then((data) => {
      setPos(data ?? []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [jobId]);

  if (loading) return <p className="text-sm text-muted-foreground">Loading...</p>;
  if (pos.length === 0) return <p className="text-sm text-muted-foreground">No purchase orders.</p>;

  return (
    <div className="space-y-2">
      {pos.map((po) => (
        <Card key={po.id}>
          <CardContent className="py-3">
            <Link href={`/purchase-orders/${po.id}`} className="font-medium hover:underline">
              {po.purchaseOrderNumber ?? po.externalId ?? po.id}
            </Link>
            <p className="text-sm text-muted-foreground mt-1">
              {po.totalAmount ? `$${po.totalAmount}` : ''} • {(po.status as { name?: string })?.name ?? '—'}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
