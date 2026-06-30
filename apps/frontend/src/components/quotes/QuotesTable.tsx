'use client';

import { Trash2 } from 'lucide-react';
import { formatDate, SortableColumnHeader } from '@/components/shared/list-filters';
import { StatusBadge } from '@/components/ui/status-badge';
import { TypeBadge } from '@/components/ui/type-badge';
import type { Quote } from '@/types/api';

type Dict = Record<string, unknown>;

export function getEstimateTypeName(quote: Quote): string {
  if (quote.quoteType?.name) return quote.quoteType.name;
  const approval = (quote.approvalInfo as Dict | undefined) ?? {};
  if (typeof approval.quoteTypeName === 'string' && approval.quoteTypeName) {
    return approval.quoteTypeName;
  }
  const api = (quote.apiPayload as Dict | undefined) ?? {};
  const apiQuoteType =
    (api.quoteType as Dict | undefined) ??
    (api.quoteTypeId as Dict | undefined) ??
    {};
  if (typeof apiQuoteType.name === 'string' && apiQuoteType.name) {
    return apiQuoteType.name;
  }
  const custom = (quote.customData as Dict | undefined) ?? {};
  if (typeof custom.quoteType === 'string' && custom.quoteType) {
    return custom.quoteType;
  }
  return '';
}

function formatAmount(value?: string | null): string {
  if (!value) return '';
  const n = Number(value);
  if (Number.isNaN(n)) return value;
  return n.toLocaleString('en-AU', {
    style: 'currency',
    currency: 'AUD',
    maximumFractionDigits: 2,
  });
}

export type QuoteSortField =
  | 'quote_number'
  | 'status'
  | 'estimate_type'
  | 'reference'
  | 'total_amount'
  | 'quote_date'
  | 'updated_at';

interface ColDef { key: QuoteSortField; label: string }

const TABLE_COLUMNS: ColDef[] = [
  { key: 'quote_number', label: 'Estimate #' },
  { key: 'reference', label: 'Reference' },
  { key: 'status', label: 'Status' },
  { key: 'estimate_type', label: 'Estimate Type' },
  { key: 'total_amount', label: 'Total' },
  { key: 'quote_date', label: 'Estimate Date' },
  { key: 'updated_at', label: 'Updated' },
];

export interface QuotesTableProps {
  quotes: Quote[];
  onRowClick?: (quote: Quote) => void;
  onDelete?: (quoteId: string) => void;
  deletingId?: string | null;
  showActions?: boolean;
  sortField?: QuoteSortField;
  sortOrder?: 'asc' | 'desc';
  onSort?: (field: QuoteSortField) => void;
}

export function QuotesTable({
  quotes,
  onRowClick,
  onDelete,
  deletingId,
  showActions = false,
  sortField,
  sortOrder = 'desc',
  onSort,
}: QuotesTableProps) {
  if (quotes.length === 0) return null;

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead className="bg-slate-50">
          <tr className="text-left text-xs font-medium uppercase tracking-wide text-slate-500">
            {onSort
              ? TABLE_COLUMNS.map((col) => (
                  <SortableColumnHeader
                    key={col.key}
                    columnKey={col.key}
                    label={col.label}
                    activeField={sortField ?? null}
                    sortOrder={sortOrder}
                    onSort={onSort}
                  />
                ))
              : TABLE_COLUMNS.map((col) => (
                  <th key={col.key} scope="col" className="px-4 py-3">
                    {col.label}
                  </th>
                ))}
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
            const estimateType = getEstimateTypeName(quote);
            return (
              <tr
                key={quote.id}
                onClick={() => onRowClick?.(quote)}
                className="cursor-pointer transition-colors hover:bg-slate-50"
              >
                <td className="whitespace-nowrap px-4 py-3 font-medium text-slate-900">
                  {num}
                </td>
                <td className="px-4 py-3 text-slate-600">
                  {quote.name ?? ''}
                </td>
                <td className="whitespace-nowrap px-4 py-3">
                  <StatusBadge status={statusName} />
                </td>
                <td className="px-4 py-3">
                  <TypeBadge type={estimateType} />
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
