'use client';

import { formatDate, SortableColumnHeader, TableEmptyRow, type ColumnValueFilter } from '@/components/shared/list-filters';
import {
  ColumnSettingsHeaderCell,
  useColumnVisibility,
} from '@/components/shared/column-visibility';
import { resolveJobName } from '@/components/shared/job-label';
import { ListArchiveButton, LIST_ARCHIVE_TH_CLASS, LIST_ARCHIVE_TD_CLASS, LIST_ARCHIVE_SPACER_TD_CLASS } from '@/components/shared/ListArchiveButton';
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
  | 'job'
  | 'status'
  | 'estimate_type'
  | 'reference'
  | 'total_amount'
  | 'quote_date'
  | 'updated_at';

interface ColDef { key: QuoteSortField; label: string; filterable?: boolean; locked?: boolean }

const TABLE_COLUMNS: ColDef[] = [
  { key: 'quote_number', label: 'Estimate #', locked: true },
  { key: 'job', label: 'Job' },
  { key: 'reference', label: 'Reference' },
  { key: 'status', label: 'Status', filterable: true },
  { key: 'estimate_type', label: 'Estimate Type', filterable: true },
  { key: 'total_amount', label: 'Total' },
  { key: 'quote_date', label: 'Estimate Date' },
  { key: 'updated_at', label: 'Updated' },
];

export interface QuotesTableProps {
  quotes: Quote[];
  jobNameById?: Record<string, string>;
  onRowClick?: (quote: Quote) => void;
  onArchived?: (quoteId: string) => void;
  sortField?: QuoteSortField;
  sortOrder?: 'asc' | 'desc';
  onSort?: (field: QuoteSortField) => void;
  statusColumnFilter?: ColumnValueFilter;
  estimateTypeColumnFilter?: ColumnValueFilter;
}

export function QuotesTable({
  quotes,
  jobNameById,
  onRowClick,
  onArchived,
  sortField,
  sortOrder = 'desc',
  onSort,
  statusColumnFilter,
  estimateTypeColumnFilter,
}: QuotesTableProps) {
  const { isVisible, toggle, visibleCount } = useColumnVisibility(
    'quotes',
    TABLE_COLUMNS,
  );
  const visibleColumns = TABLE_COLUMNS.filter((col) => isVisible(col.key));
  const colSpan = visibleCount + 2;

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead className="bg-slate-50">
          <tr className="text-left text-xs font-medium uppercase tracking-wide text-slate-500">
            {onSort || statusColumnFilter || estimateTypeColumnFilter
              ? visibleColumns.map((col) => (
                  <SortableColumnHeader
                    key={col.key}
                    columnKey={col.key}
                    label={col.label}
                    activeField={sortField ?? null}
                    sortOrder={sortOrder}
                    onSort={onSort ?? (() => {})}
                    filter={
                      col.key === 'status'
                        ? statusColumnFilter
                        : col.key === 'estimate_type'
                          ? estimateTypeColumnFilter
                          : undefined
                    }
                  />
                ))
              : visibleColumns.map((col) => (
                  <th key={col.key} scope="col" className="px-4 py-3">
                    {col.label}
                  </th>
                ))}
            <th scope="col" className={LIST_ARCHIVE_TH_CLASS}>
              <span className="sr-only">Actions</span>
            </th>
            <ColumnSettingsHeaderCell
              columns={TABLE_COLUMNS}
              isVisible={isVisible}
              onToggle={toggle}
            />
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {quotes.length === 0 ? (
            <TableEmptyRow colSpan={colSpan} label="No estimates found." />
          ) : (
            quotes.map((quote) => {
            const num = quote.quoteNumber ?? quote.name ?? quote.id;
            const statusName = quote.status?.name ?? 'Unknown';
            const estimateType = getEstimateTypeName(quote);
            return (
              <tr
                key={quote.id}
                onClick={() => onRowClick?.(quote)}
                className="cursor-pointer transition-colors hover:bg-slate-50"
              >
                {isVisible('quote_number') && (
                  <td className="whitespace-nowrap px-4 py-3 font-medium text-slate-900">
                    {num}
                  </td>
                )}
                {isVisible('job') && (
                  <td className="px-4 py-3 text-slate-600">
                    {resolveJobName(quote.jobId, jobNameById)}
                  </td>
                )}
                {isVisible('reference') && (
                  <td className="px-4 py-3 text-slate-600">
                    {quote.name ?? ''}
                  </td>
                )}
                {isVisible('status') && (
                  <td className="whitespace-nowrap px-4 py-3">
                    <StatusBadge status={statusName} />
                  </td>
                )}
                {isVisible('estimate_type') && (
                  <td className="px-4 py-3">
                    <TypeBadge type={estimateType} />
                  </td>
                )}
                {isVisible('total_amount') && (
                  <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                    {formatAmount(quote.totalAmount)}
                  </td>
                )}
                {isVisible('quote_date') && (
                  <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                    {formatDate(quote.quoteDate)}
                  </td>
                )}
                {isVisible('updated_at') && (
                  <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                    {formatDate(quote.updatedAt)}
                  </td>
                )}
                <td
                  className={LIST_ARCHIVE_TD_CLASS}
                  onClick={(e) => e.stopPropagation()}
                >
                  <ListArchiveButton
                    entityType="quote"
                    entityId={quote.id}
                    statusName={statusName}
                    entityLabel={num}
                    onArchived={onArchived}
                  />
                </td>
                <td className={LIST_ARCHIVE_SPACER_TD_CLASS} aria-hidden />
              </tr>
            );
          })
          )}
        </tbody>
      </table>
    </div>
  );
}
