'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ReceiptText } from 'lucide-react';
import {
  SortTabs,
  SearchInput,
  StatusFilterMenu,
  ListEmptyState,
  type StatusOption,
  type SortOption,
  buildSortString,
  parseSort,
  statusIdsKey,
  parseStatusIdsFromSearchParam,
  compareDates,
  compareValues,
  formatDate,
} from '@/components/shared/list-filters';
import { SetPageHeader } from '@/components/layout/SetPageHeader';
import {
  ListPageHeader,
  computeStatusBreakdown,
} from '@/components/layout/ListPageHeader';
import { formatCurrency } from '@/components/shared/detail';
import type { Bill, PaginatedResponse } from '@/types/api';

const SORT_OPTIONS: SortOption[] = [
  { key: 'updated_at', label: 'Updated' },
  { key: 'received_date', label: 'Received' },
  { key: 'due_date', label: 'Due Date' },
  { key: 'total_amount', label: 'Amount' },
];
const ALLOWED_SORT_FIELDS = SORT_OPTIONS.map((o) => o.key);

export interface BillsListClientProps {
  initialData: PaginatedResponse<Bill>;
  statusOptions: StatusOption[];
}

export function BillsListClient({
  initialData,
  statusOptions,
}: BillsListClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [data] = useState(initialData);
  const [search, setSearch] = useState(searchParams.get('search') ?? '');
  const [debouncedSearch, setDebouncedSearch] = useState(search);
  const [sort, setSort] = useState(() => {
    const parsed = parseSort({
      sortParam: searchParams.get('sort'),
      allowedFields: ALLOWED_SORT_FIELDS,
      defaultField: 'updated_at',
    });
    return buildSortString(parsed.field, parsed.order);
  });
  const [statusFilter, setStatusFilter] = useState<Set<string>>(() =>
    parseStatusIdsFromSearchParam(searchParams.get('status')),
  );

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    const statusKey = statusIdsKey(statusFilter);
    const params = new URLSearchParams(searchParams.toString());
    params.set('search', debouncedSearch);
    params.set('sort', sort);
    params.set('page', '1');
    if (statusKey) params.set('status', statusKey);
    else params.delete('status');
    router.replace(`/bills?${params}`, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- searchParams excluded to avoid infinite loop
  }, [debouncedSearch, sort, statusFilter]);

  const { field: activeSortField, order: sortOrder } = parseSort({
    sortParam: sort,
    allowedFields: ALLOWED_SORT_FIELDS,
    defaultField: 'updated_at',
  });

  const handleSort = (field: string) => {
    if (activeSortField === field) {
      setSort(buildSortString(field, sortOrder === 'asc' ? 'desc' : 'asc'));
    } else {
      setSort(buildSortString(field, 'desc'));
    }
  };

  const setStatusChecked = (id: string, checked: boolean) => {
    setStatusFilter((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const clearStatuses = () => setStatusFilter(new Set());
  const selectAllStatuses = () =>
    setStatusFilter(new Set(statusOptions.map((o) => o.id)));

  const visibleRows = useMemo(() => {
    const query = debouncedSearch.trim().toLowerCase();
    let rows = data.data;

    if (statusFilter.size > 0) {
      rows = rows.filter((b) => {
        const sid = b.statusLookupId ?? b.status?.id;
        return sid ? statusFilter.has(sid) : false;
      });
    }

    if (query) {
      rows = rows.filter((b) => {
        const num = (b.billNumber ?? '').toLowerCase();
        const ext = (b.externalReference ?? '').toLowerCase();
        return num.includes(query) || ext.includes(query);
      });
    }

    const sorted = [...rows].sort((a, b) => {
      switch (activeSortField) {
        case 'received_date':
          return compareDates(a.receivedDate, b.receivedDate, sortOrder);
        case 'due_date':
          return compareDates(a.dueDate, b.dueDate, sortOrder);
        case 'total_amount':
          return compareValues(
            Number(a.totalAmount ?? 0),
            Number(b.totalAmount ?? 0),
            sortOrder,
          );
        case 'updated_at':
        default:
          return compareDates(a.updatedAt, b.updatedAt, sortOrder);
      }
    });

    return sorted;
  }, [data.data, debouncedSearch, statusFilter, activeSortField, sortOrder]);

  const breakdown = computeStatusBreakdown(
    visibleRows,
    (b) => b.status?.name,
  );

  const totalValue = useMemo(() => {
    const sum = visibleRows.reduce((acc, b) => {
      const n = Number(b.totalAmount);
      return Number.isFinite(n) ? acc + n : acc;
    }, 0);
    if (sum === 0) return null;
    return sum.toLocaleString(undefined, {
      style: 'currency',
      currency: 'AUD',
      maximumFractionDigits: 0,
    });
  }, [visibleRows]);

  return (
    <div className="flex min-h-0 flex-1 flex-col" style={{ height: '100%' }}>
      <SetPageHeader>
        <ListPageHeader
          icon={ReceiptText}
          title="Bills"
          total={data.total}
          showing={visibleRows.length}
          search={debouncedSearch}
          statusSelectedCount={statusFilter.size}
          breakdown={breakdown}
          stats={totalValue ? [{ label: 'Total value', value: totalValue }] : undefined}
          accent="rose"
        />
      </SetPageHeader>
      <div className="flex flex-col gap-4 px-6 pb-4 pt-1">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
          <SortTabs
            options={SORT_OPTIONS}
            activeField={activeSortField}
            sortOrder={sortOrder}
            onSort={handleSort}
          />

          <SearchInput
            placeholder="Search bills by number or reference..."
            value={search}
            onChange={setSearch}
          />

          <StatusFilterMenu
            options={statusOptions}
            selected={statusFilter}
            onSelectionChange={setStatusChecked}
            onClearAll={clearStatuses}
            onSelectAll={selectAllStatuses}
          />
        </div>
      </div>

      <div
        className="flex-1 px-6 pb-6"
        style={{ minHeight: 0, overflow: 'auto' }}
      >
        {visibleRows.length > 0 ? (
          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50">
                <tr className="text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                  <th scope="col" className="px-4 py-3">Bill #</th>
                  <th scope="col" className="px-4 py-3">Status</th>
                  <th scope="col" className="px-4 py-3">Vendor (sub)</th>
                  <th scope="col" className="px-4 py-3">PO #</th>
                  <th scope="col" className="px-4 py-3">Amount</th>
                  <th scope="col" className="px-4 py-3">Received</th>
                  <th scope="col" className="px-4 py-3">Due Date</th>
                  <th scope="col" className="px-4 py-3">Updated</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visibleRows.map((bill) => {
                  const num = bill.billNumber ?? bill.externalReference ?? bill.id;
                  const statusName = bill.status?.name ?? 'Unknown';
                  return (
                    <tr
                      key={bill.id}
                      onClick={() => router.push(`/bills/${bill.id}`)}
                      className="cursor-pointer transition-colors hover:bg-slate-50"
                    >
                      <td className="whitespace-nowrap px-4 py-3 font-medium text-slate-900">
                        {num}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                          {statusName}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {bill.vendorId ? bill.vendorId.slice(0, 8) : ''}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {bill.purchaseOrderId ? bill.purchaseOrderId.slice(0, 8) : ''}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                        {formatCurrency(bill.totalAmount)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                        {formatDate(bill.receivedDate)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                        {formatDate(bill.dueDate)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                        {formatDate(bill.updatedAt)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <ListEmptyState label="No bills found." />
        )}
      </div>
    </div>
  );
}
