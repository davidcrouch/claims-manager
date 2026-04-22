'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { FileSignature, ExternalLink } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusBadge } from '@/components/ui/status-badge';
import { fetchJobPurchaseOrdersAction } from '@/app/(app)/jobs/[id]/actions';
import { formatDate, formatCurrency } from '@/components/shared/detail';
import type { PurchaseOrder } from '@/types/api';

export function JobPurchaseOrdersTab({ jobId }: { jobId: string }) {
  const [pos, setPos] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetchJobPurchaseOrdersAction(jobId)
      .then((data) => {
        if (cancelled) return;
        setPos(data ?? []);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [jobId]);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <FileSignature className="h-4 w-4 text-muted-foreground" />
          Purchase Orders ({pos.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="px-0">
        {loading ? (
          <p className="px-4 text-sm text-muted-foreground">Loading...</p>
        ) : pos.length === 0 ? (
          <p className="px-4 text-sm text-muted-foreground">
            No purchase orders.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-2">PO #</th>
                  <th className="px-4 py-2">External ref</th>
                  <th className="px-4 py-2">Status</th>
                  <th className="px-4 py-2">Vendor</th>
                  <th className="px-4 py-2">Updated</th>
                  <th className="px-4 py-2 text-right">Total</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {pos.map((po) => {
                  const statusName = po.status?.name ?? 'Unknown';
                  return (
                    <tr key={po.id} className="hover:bg-muted/30">
                      <td className="px-4 py-2 font-medium">
                        {po.purchaseOrderNumber ?? po.id}
                      </td>
                      <td className="px-4 py-2 text-muted-foreground">
                        {po.externalId ?? '—'}
                      </td>
                      <td className="px-4 py-2">
                        <StatusBadge status={statusName} />
                      </td>
                      <td className="px-4 py-2 text-muted-foreground">
                        {po.vendor?.name ?? '—'}
                      </td>
                      <td className="px-4 py-2 text-muted-foreground">
                        {formatDate(po.updatedAt)}
                      </td>
                      <td className="px-4 py-2 text-right font-medium">
                        {formatCurrency(po.totalAmount)}
                      </td>
                      <td className="px-4 py-2 text-right">
                        <Link
                          href={`/purchase-orders/${po.id}`}
                          className="inline-flex items-center gap-1 text-primary hover:underline"
                        >
                          Open <ExternalLink className="h-3 w-3" />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
