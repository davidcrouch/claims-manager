'use client';

import { useRouter } from 'next/navigation';
import type { PaginatedResponse, Proposal } from '@/types/api';

interface Props {
  initialData: PaginatedResponse<Proposal>;
  statusOptions: { id: string; name: string }[];
}

export function ProposalsListClient({ initialData, statusOptions }: Props) {
  const router = useRouter();
  const items = initialData?.data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Proposals</h1>
      </div>
      {items.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">No proposals found.</p>
      ) : (
        <div className="rounded-md border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-left font-medium">Proposal #</th>
                <th className="px-4 py-3 text-left font-medium">Name</th>
                <th className="px-4 py-3 text-left font-medium">Vendor ID</th>
                <th className="px-4 py-3 text-left font-medium">Total</th>
                <th className="px-4 py-3 text-left font-medium">Received Date</th>
                <th className="px-4 py-3 text-left font-medium">Updated</th>
              </tr>
            </thead>
            <tbody>
              {items.map((proposal) => (
                <tr
                  key={proposal.id}
                  className="border-b cursor-pointer hover:bg-muted/30 transition-colors"
                  onClick={() => router.push(`/proposals/${proposal.id}`)}
                >
                  <td className="px-4 py-3 font-medium">{proposal.proposalNumber ?? '—'}</td>
                  <td className="px-4 py-3">{proposal.name ?? '—'}</td>
                  <td className="px-4 py-3">{proposal.vendorId ?? '—'}</td>
                  <td className="px-4 py-3">{proposal.totalAmount ? `$${Number(proposal.totalAmount).toLocaleString()}` : '—'}</td>
                  <td className="px-4 py-3">{proposal.receivedDate ? new Date(proposal.receivedDate).toLocaleDateString() : '—'}</td>
                  <td className="px-4 py-3 text-muted-foreground">{proposal.updatedAt ? new Date(proposal.updatedAt).toLocaleDateString() : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
