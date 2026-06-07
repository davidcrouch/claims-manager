'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { TrendingDown } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { SetPageHeader } from '@/components/layout/SetPageHeader';
import { ListPageHeader } from '@/components/layout/ListPageHeader';
import {
  SortTabs,
  SearchInput,
  StatusFilterMenu,
  ListEmptyState,
  type SortOption,
  compareDates,
  compareValues,
  formatDate,
} from '@/components/shared/list-filters';
import type { AgingBucket, Bill } from '@/types/api';

const SORT_OPTIONS: SortOption[] = [
  { key: 'due_date', label: 'Due Date' },
  { key: 'received', label: 'Received' },
  { key: 'amount', label: 'Amount' },
  { key: 'age', label: 'Age' },
  { key: 'bill_number', label: 'Bill #' },
];

const STATUS_OPTIONS = [
  { id: 'unpaid', name: 'Unpaid' },
  { id: 'paid', name: 'Paid' },
  { id: 'overdue', name: 'Overdue' },
];

function fmt(n: number) {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'AUD',
  }).format(n);
}

function daysSince(dateStr?: string | null): number {
  if (!dateStr) return 0;
  const diff = Date.now() - new Date(dateStr).getTime();
  return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
}

interface Props {
  summary: {
    buckets: AgingBucket[];
    totalOutstanding: number;
    totalOverdue: number;
    totalPaid: number;
  };
  bills: Bill[];
}

export function FinanceApClient({ summary, bills }: Props) {
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState('due_date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [statusFilter, setStatusFilter] = useState<Set<string>>(new Set());

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortOrder((o) => (o === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortOrder(field === 'bill_number' ? 'asc' : 'desc');
    }
  };

  const visibleRows = useMemo(() => {
    let rows = bills;

    if (statusFilter.size > 0) {
      rows = rows.filter((bill) => {
        const name = bill.status?.name?.toLowerCase() ?? '';
        return statusFilter.has(name);
      });
    }

    const query = search.trim().toLowerCase();
    if (query) {
      rows = rows.filter((bill) =>
        (bill.billNumber ?? '').toLowerCase().includes(query),
      );
    }

    const sorted = [...rows].sort((a, b) => {
      switch (sortField) {
        case 'bill_number':
          return compareValues(
            a.billNumber ?? '',
            b.billNumber ?? '',
            sortOrder,
          );
        case 'amount':
          return compareValues(
            parseFloat(a.totalAmount ?? '0'),
            parseFloat(b.totalAmount ?? '0'),
            sortOrder,
          );
        case 'received':
          return compareDates(a.receivedDate ?? a.issueDate, b.receivedDate ?? b.issueDate, sortOrder);
        case 'age':
          return compareValues(daysSince(a.issueDate), daysSince(b.issueDate), sortOrder);
        case 'due_date':
        default:
          return compareDates(a.dueDate ?? a.issueDate, b.dueDate ?? b.issueDate, sortOrder);
      }
    });

    return sorted;
  }, [bills, search, statusFilter, sortField, sortOrder]);

  return (
    <div className="flex min-h-0 flex-1 flex-col" style={{ height: '100%' }}>
      <SetPageHeader>
        <ListPageHeader
          icon={TrendingDown}
          title="Accounts Payable"
          total={bills.length}
          showing={visibleRows.length}
          accent="rose"
          stats={[
            { label: 'Payable', value: fmt(summary.totalOutstanding) },
            { label: 'Overdue', value: fmt(summary.totalOverdue) },
          ]}
        />
      </SetPageHeader>

      <div className="flex flex-col gap-4 px-6 pb-4 pt-1">
        <div className="grid gap-4 sm:grid-cols-3">
          <Card size="sm">
            <CardContent className="px-4">
              <p className="text-xs text-muted-foreground">Total Payable</p>
              <p className="mt-1 text-lg font-bold">{fmt(summary.totalOutstanding)}</p>
            </CardContent>
          </Card>
          <Card size="sm">
            <CardContent className="px-4">
              <p className="text-xs text-muted-foreground">Total Overdue</p>
              <p className="mt-1 text-lg font-bold text-destructive">{fmt(summary.totalOverdue)}</p>
            </CardContent>
          </Card>
          <Card size="sm">
            <CardContent className="px-4">
              <p className="text-xs text-muted-foreground">Total Paid</p>
              <p className="mt-1 text-lg font-bold text-green-600">{fmt(summary.totalPaid)}</p>
            </CardContent>
          </Card>
        </div>

        {summary.buckets.length > 0 && (
          <div>
            <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Aging Buckets
            </h2>
            <div className="grid gap-3 sm:grid-cols-5">
              {summary.buckets.map((bucket) => (
                <Card key={bucket.label} size="sm" className="text-center">
                  <CardContent className="px-3 py-3">
                    <div className="text-xs font-medium text-muted-foreground">{bucket.label}</div>
                    <div className="mt-0.5 text-sm font-bold">{fmt(bucket.totalAmount)}</div>
                    <div className="text-[10px] text-muted-foreground">{bucket.count} bill(s)</div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
          <SortTabs
            options={SORT_OPTIONS}
            activeField={sortField}
            sortOrder={sortOrder}
            onSort={handleSort}
          />
          <SearchInput
            placeholder="Search by bill #..."
            value={search}
            onChange={setSearch}
          />
          <StatusFilterMenu
            options={STATUS_OPTIONS}
            selected={statusFilter}
            onSelectionChange={(id, checked) => {
              setStatusFilter((prev) => {
                const next = new Set(prev);
                if (checked) next.add(id);
                else next.delete(id);
                return next;
              });
            }}
            onClearAll={() => setStatusFilter(new Set())}
            onSelectAll={() => setStatusFilter(new Set(STATUS_OPTIONS.map((o) => o.id)))}
          />
        </div>
      </div>

      <div className="flex-1 px-6 pb-6" style={{ minHeight: 0, overflow: 'auto' }}>
        {visibleRows.length > 0 ? (
          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50">
                <tr className="text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                  <th scope="col" className="px-4 py-3">Bill #</th>
                  <th scope="col" className="px-4 py-3 text-right">Amount</th>
                  <th scope="col" className="px-4 py-3">Received</th>
                  <th scope="col" className="px-4 py-3">Due Date</th>
                  <th scope="col" className="px-4 py-3">Status</th>
                  <th scope="col" className="px-4 py-3 text-right">Age (days)</th>
                  <th scope="col" className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visibleRows.map((bill) => (
                  <tr key={bill.id} className="transition-colors hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-900">
                      <Link href={`/bills/${bill.id}`} className="text-primary hover:underline">
                        {bill.billNumber ?? bill.id}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {fmt(parseFloat(bill.totalAmount ?? '0'))}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                      {formatDate(bill.receivedDate ?? bill.issueDate)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                      {formatDate(bill.dueDate)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                        {bill.status?.name ?? 'Unknown'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {daysSince(bill.issueDate)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <Link
                        href={`/bills/${bill.id}`}
                        className="text-xs text-primary hover:underline"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <ListEmptyState label="No payables match your filters." />
        )}
      </div>
    </div>
  );
}
