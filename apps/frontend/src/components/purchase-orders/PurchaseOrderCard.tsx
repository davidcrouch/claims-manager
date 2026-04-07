'use client';

import Link from 'next/link';
import { ShoppingCart } from 'lucide-react';
import { EntityCard } from '@/components/ui/entity-card';
import type { PurchaseOrder } from '@/types/api';

export function PurchaseOrderCard({ po }: { po: PurchaseOrder }) {
  const title = po.purchaseOrderNumber ?? po.externalId ?? po.id;
  const jobRef = (po as { job?: { externalReference?: string } }).job?.externalReference ?? po.jobId ?? '';
  const statusName = (po.status as { name?: string })?.name ?? 'Unknown';
  const totalAmount = po.totalAmount ? `$${po.totalAmount}` : '';
  const vendorName = (po.vendor as { name?: string })?.name ?? '';

  return (
    <EntityCard
      href={`/purchase-orders/${po.id}`}
      icon={ShoppingCart}
      accentColor="border-l-violet-500"
      title={title}
      subtitle={jobRef ? `Job: ${jobRef}` : undefined}
      badge={statusName}
      footer={
        <>
          {totalAmount}
          {vendorName && ` • ${vendorName}`}
          {po.jobId && (
            <>
              {' • '}
              <Link href={`/jobs/${po.jobId}`} className="hover:underline">
                Job
              </Link>
            </>
          )}
        </>
      }
    />
  );
}
