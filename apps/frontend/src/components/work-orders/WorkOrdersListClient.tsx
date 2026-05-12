'use client';

import { useRouter } from 'next/navigation';
import type { PaginatedResponse, WorkOrder } from '@/types/api';

interface Props {
  initialData: PaginatedResponse<WorkOrder>;
  statusOptions: { id: string; name: string }[];
}

export function WorkOrdersListClient({ initialData, statusOptions }: Props) {
  const router = useRouter();
  const items = initialData?.data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Work Orders</h1>
      </div>
      {items.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">No work orders found.</p>
      ) : (
        <div className="rounded-md border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-left font-medium">WO #</th>
                <th className="px-4 py-3 text-left font-medium">Name</th>
                <th className="px-4 py-3 text-left font-medium">Total</th>
                <th className="px-4 py-3 text-left font-medium">Updated</th>
              </tr>
            </thead>
            <tbody>
              {items.map((wo) => (
                <tr
                  key={wo.id}
                  className="border-b cursor-pointer hover:bg-muted/30 transition-colors"
                  onClick={() => router.push(`/work-orders/${wo.id}`)}
                >
                  <td className="px-4 py-3 font-medium">{wo.workOrderNumber ?? '—'}</td>
                  <td className="px-4 py-3">{wo.name ?? '—'}</td>
                  <td className="px-4 py-3">{wo.totalAmount ? `$${Number(wo.totalAmount).toLocaleString()}` : '—'}</td>
                  <td className="px-4 py-3 text-muted-foreground">{wo.updatedAt ? new Date(wo.updatedAt).toLocaleDateString() : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
