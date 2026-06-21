'use client';

import Link from 'next/link';
import { Trash2 } from 'lucide-react';
import { StatusBadge } from '@/components/ui/status-badge';
import { formatDate } from '@/components/shared/list-filters';
import type { Quote } from '@/types/api';

function formatAmount(value?: string | null): string {
  if (!value) return '';
  const n = Number(value);
  if (Number.isNaN(n)) return value;
  return n.toLocaleString(undefined, {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  });
}

export interface QuotesTableProps {
  quotes: Quote[];
  onRowClick?: (quote: Quote) => void;
  onDelete?: (quoteId: string) => void;
  deletingId?: string | null;
  showActions?: boolean;
}

export function QuotesTable({
  quotes,
  onRowClick,
  onDelete,
  deletingId,
  showActions = false,
}: QuotesTableProps) {
  if (quotes.length === 0) return null;

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead className="bg-slate-50">
          <tr className="text-left text-xs font-medium uppercase tracking-wide text-slate-500">
            <th scope="col" className="px-4 py-3">Estimate #</th>
            <th scope="col" className="px-4 py-3">Status</th>
            <th scope="col" className="px-4 py-3">Reference</th>
            <th scope="col" className="px-4 py-3">Total</th>
            <th scope="col" className="px-4 py-3">Estimate Date</th>
            <th scope="col" className="px-4 py-3">Updated</th>
            {showActions && (
              <th scope="col" className="px-4 py-3 w-10">
                <span className="sr-only">Actions</span>
              </th>
            )}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {quotes.map((quote) => {
            const num = quote.quoteNumber ?? quote.name ?? quote.id;
            const statusName = quote.status?.name ?? 'Unknown';
            return (
              <tr
                key={quote.id}
                onClick={() => onRowClick?.(quote)}
                className="cursor-pointer transition-colors hover:bg-slate-50"
              >
                <td className="whitespace-nowrap px-4 py-3 font-medium text-slate-900">
                  {onRowClick ? (
                    <button
                      type="button"
                      className="text-primary hover:underline"
                      onClick={(e) => {
                        e.stopPropagation();
                        onRowClick(quote);
                      }}
                    >
                      {num}
                    </button>
                  ) : (
                    <Link
                      href={`/quotes/${quote.id}`}
                      className="text-primary hover:underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {num}
                    </Link>
                  )}
                </td>
                <td className="whitespace-nowrap px-4 py-3">
                  <StatusBadge status={statusName} />
                </td>
                <td className="px-4 py-3 text-slate-600">
                  {quote.name ?? ''}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                  {formatAmount(quote.totalAmount)}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                  {formatDate(quote.quoteDate)}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                  {formatDate(quote.updatedAt)}
                </td>
                {showActions && (
                  <td className="whitespace-nowrap px-4 py-2 text-center">
                    <button
                      type="button"
                      disabled={deletingId === quote.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete?.(quote.id);
                      }}
                      className="inline-flex items-center justify-center rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                      title="Delete estimate"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
