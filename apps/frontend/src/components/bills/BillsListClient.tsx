'use client';

import { useRouter } from 'next/navigation';
import type { PaginatedResponse, Bill } from '@/types/api';

interface Props {
  initialData: PaginatedResponse<Bill>;
  statusOptions: { id: string; name: string }[];
}

export function BillsListClient({ initialData, statusOptions }: Props) {
  const router = useRouter();
  const items = initialData?.data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Bills</h1>
      </div>
      {items.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">No bills found.</p>
      ) : (
        <div className="rounded-md border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-left font-medium">Bill #</th>
                <th className="px-4 py-3 text-left font-medium">Vendor ID</th>
                <th className="px-4 py-3 text-left font-medium">Due Date</th>
                <th className="px-4 py-3 text-left font-medium">Total</th>
                <th className="px-4 py-3 text-left font-medium">Payment Status</th>
                <th className="px-4 py-3 text-left font-medium">Updated</th>
              </tr>
            </thead>
            <tbody>
              {items.map((bill) => (
                <tr
                  key={bill.id}
                  className="border-b cursor-pointer hover:bg-muted/30 transition-colors"
                  onClick={() => router.push(`/bills/${bill.id}`)}
                >
                  <td className="px-4 py-3 font-medium">{bill.billNumber ?? '—'}</td>
                  <td className="px-4 py-3">{bill.vendorId ?? '—'}</td>
                  <td className="px-4 py-3">{bill.dueDate ? new Date(bill.dueDate).toLocaleDateString() : '—'}</td>
                  <td className="px-4 py-3">{bill.totalAmount ? `$${Number(bill.totalAmount).toLocaleString()}` : '—'}</td>
                  <td className="px-4 py-3">{bill.paymentStatus?.name ?? '—'}</td>
                  <td className="px-4 py-3 text-muted-foreground">{bill.updatedAt ? new Date(bill.updatedAt).toLocaleDateString() : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
