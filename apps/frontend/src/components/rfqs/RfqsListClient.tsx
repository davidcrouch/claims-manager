'use client';

import { useRouter } from 'next/navigation';
import type { PaginatedResponse, Rfq } from '@/types/api';

interface Props {
  initialData: PaginatedResponse<Rfq>;
  statusOptions: { id: string; name: string }[];
}

export function RfqsListClient({ initialData, statusOptions }: Props) {
  const router = useRouter();
  const items = initialData?.data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">RFQs</h1>
      </div>
      {items.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">No RFQs found.</p>
      ) : (
        <div className="rounded-md border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-left font-medium">RFQ #</th>
                <th className="px-4 py-3 text-left font-medium">Name</th>
                <th className="px-4 py-3 text-left font-medium">Vendor ID</th>
                <th className="px-4 py-3 text-left font-medium">Due Date</th>
                <th className="px-4 py-3 text-left font-medium">Include Pricing</th>
                <th className="px-4 py-3 text-left font-medium">Updated</th>
              </tr>
            </thead>
            <tbody>
              {items.map((rfq) => (
                <tr
                  key={rfq.id}
                  className="border-b cursor-pointer hover:bg-muted/30 transition-colors"
                  onClick={() => router.push(`/rfqs/${rfq.id}`)}
                >
                  <td className="px-4 py-3 font-medium">{rfq.rfqNumber ?? '—'}</td>
                  <td className="px-4 py-3">{rfq.name ?? '—'}</td>
                  <td className="px-4 py-3">{rfq.vendorId ?? '—'}</td>
                  <td className="px-4 py-3">{rfq.dueDate ? new Date(rfq.dueDate).toLocaleDateString() : '—'}</td>
                  <td className="px-4 py-3">{rfq.includePricing ? 'Yes' : 'No'}</td>
                  <td className="px-4 py-3 text-muted-foreground">{rfq.updatedAt ? new Date(rfq.updatedAt).toLocaleDateString() : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
