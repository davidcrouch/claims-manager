'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { TrendingUp } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { SetPageHeader } from '@/components/layout/SetPageHeader';
import { ListPageHeader } from '@/components/layout/ListPageHeader';
import {
  SortTabs,
  SearchInput,
  StatusFilterMenu,
  TableEmptyRow,
  type SortOption,
  type StatusOption,
  buildSortString,
  parseSort,
  statusIdsKey,
  formatDate,
} from '@/components/shared/list-filters';
import { fetchInvoicesAction } from '@/app/(app)/invoices/actions';
import {
  createListFetchSession,
  replaceListQueryIfNeeded,
  useListPageData,
} from '@/components/shared/use-list-page-data';
import type { AgingBucket, Invoice, PaginatedResponse } from '@/types/api';

const SORT_OPTIONS: SortOption[] = [
  { key: 'issue_date', label: 'Issue Date' },
  { key: 'total_amount', label: 'Amount' },
  { key: 'invoice_number', label: 'Invoice #' },
];
const ALLOWED_SORT_FIELDS = SORT_OPTIONS.map((o) => o.key);
const PAGE_SIZE = 100;

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
  initialInvoices: PaginatedResponse<Invoice> | { data: Invoice[]; total: number };
  statusOptions: StatusOption[];
}

export function FinanceArClient({ summary, initialInvoices, statusOptions }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data, setData, beginFetch, abortFetch } = useListPageData<PaginatedResponse<Invoice>>(
    'data' in initialInvoices
      ? (initialInvoices as PaginatedResponse<Invoice>)
      : { data: [], total: 0 },
  );
  const [search, setSearch] = useState(searchParams.get('search') ?? '');
  const [debouncedSearch, setDebouncedSearch] = useState(search);
  const [sort, setSort] = useState(() => {
    const parsed = parseSort({
      sortParam: searchParams.get('sort'),
      allowedFields: ALLOWED_SORT_FIELDS,
      defaultField: 'issue_date',
      defaultOrder: 'asc',
    });
    return buildSortString(parsed.field, parsed.order);
  });
  const [statusFilter, setStatusFilter] = useState<Set<string>>(new Set());

  const statusParam = useMemo(() => {
    if (statusFilter.size === 0) return undefined;
    if (statusFilter.size === statusOptions.length) return undefined;
    return [...statusFilter].sort().join(',');
  }, [statusFilter, statusOptions.length]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    const statusKey = statusIdsKey(statusFilter);
    const fetchKey = `${debouncedSearch}|${sort}|${statusKey}`;
    const params = new URLSearchParams(searchParams.toString());
    if (debouncedSearch) params.set('search', debouncedSearch);
    else params.delete('search');
    if (sort !== 'issue_date_asc') params.set('sort', sort);
    else params.delete('sort');
    if (statusParam) params.set('status', statusParam);
    else params.delete('status');
    if (
      !replaceListQueryIfNeeded({
        router,
        pathname: '/finance/ar',
        currentQuery: searchParams.toString(),
        nextQuery: params.toString(),
      })
    ) {
      return;
    }

    const session = createListFetchSession({ fetchKey, beginFetch, abortFetch });
    if (!session) return;

    fetchInvoicesAction({
      page: 1,
      limit: PAGE_SIZE,
      search: debouncedSearch || undefined,
      sort,
      status: statusParam,
    }).then((res) => {
      if (!session.cancelled && res) setData(res);
    });
    return session.cleanup;
  }, [debouncedSearch, sort, statusParam, statusFilter, searchParams, router, beginFetch, abortFetch]);

  const { field: sortField, order: sortOrder } = parseSort({
    sortParam: sort,
    allowedFields: ALLOWED_SORT_FIELDS,
    defaultField: 'issue_date',
    defaultOrder: 'asc',
  });

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSort(buildSortString(field, sortOrder === 'asc' ? 'desc' : 'asc'));
    } else {
      setSort(buildSortString(field, field === 'invoice_number' ? 'asc' : 'desc'));
    }
  };

  const setStatusChecked = (id: string, checked: boolean) => {
    setStatusFilter((prev) => {
      const working =
        prev.size === 0 ? new Set(statusOptions.map((o) => o.id)) : new Set(prev);
      if (checked) working.add(id);
      else working.delete(id);
      if (working.size === statusOptions.length) return new Set();
      return working;
    });
  };

  const visibleRows = data.data;

  return (
    <div className="flex min-h-0 flex-1 flex-col" style={{ height: '100%' }}>
      <SetPageHeader>
        <ListPageHeader
          icon={TrendingUp}
          title="Accounts Receivable"
          total={data.total}
          showing={visibleRows.length}
          search={debouncedSearch}
          statusSelectedCount={statusFilter.size}
          accent="emerald"
          stats={[
            { label: 'Outstanding', value: fmt(summary.totalOutstanding) },
            { label: 'Overdue', value: fmt(summary.totalOverdue) },
          ]}
        />
      </SetPageHeader>

      <div className="flex flex-col gap-4 px-6 pb-4 pt-1">
        <div className="grid gap-4 sm:grid-cols-3">
          <Card size="sm">
            <CardContent className="px-4">
              <p className="text-xs text-muted-foreground">Total Outstanding</p>
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
                    <div className="text-[10px] text-muted-foreground">{bucket.count} invoice(s)</div>
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
            placeholder="Search by invoice #..."
            value={search}
            onChange={setSearch}
          />
          <StatusFilterMenu
            options={statusOptions}
            selected={
              statusFilter.size === 0
                ? new Set(statusOptions.map((o) => o.id))
                : statusFilter
            }
            onSelectionChange={setStatusChecked}
            onClearAll={() => setStatusFilter(new Set())}
            onSelectAll={() => setStatusFilter(new Set())}
          />
        </div>
      </div>

      <div className="flex-1 px-6 pb-6" style={{ minHeight: 0, overflow: 'auto' }}>
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr className="text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                <th scope="col" className="px-4 py-3">Invoice #</th>
                <th scope="col" className="px-4 py-3 text-right">Amount</th>
                <th scope="col" className="px-4 py-3">Issue Date</th>
                <th scope="col" className="px-4 py-3">Status</th>
                <th scope="col" className="px-4 py-3 text-right">Age (days)</th>
                <th scope="col" className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visibleRows.length === 0 ? (
                <TableEmptyRow colSpan={6} label="No receivables match your filters." />
              ) : (
                visibleRows.map((inv) => (
                  <tr key={inv.id} className="transition-colors hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-900">
                      <Link href={`/invoices/${inv.id}`} className="text-primary hover:underline">
                        {inv.invoiceNumber ?? inv.id}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {fmt(parseFloat(inv.totalAmount ?? '0'))}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                      {formatDate(inv.issueDate)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                        {inv.status?.name ?? 'Unknown'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {daysSince(inv.issueDate)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <Link
                        href={`/invoices/${inv.id}`}
                        className="text-xs text-primary hover:underline"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
