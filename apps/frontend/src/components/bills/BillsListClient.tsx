'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ReceiptText, Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  type StatusOption,
  compareDates,
  compareValues,
  formatDate,
  isArchivedStatus,
  ValueFilterMenu,
  SortableColumnHeader,
} from '@/components/shared/list-filters';
import { SetPageHeader } from '@/components/layout/SetPageHeader';
import {
  ListPageHeader,
  computeStatusBreakdown,
} from '@/components/layout/ListPageHeader';
import { formatCurrency } from '@/components/shared/detail';
import type { Bill, PaginatedResponse } from '@/types/api';

type ListTab = 'active' | 'archived' | 'all';
const VALID_TABS = new Set<ListTab>(['active', 'archived', 'all']);
function parseTab(param: string | null): ListTab {
  if (param && VALID_TABS.has(param as ListTab)) return param as ListTab;
  return 'active';
}

type BillSortField =
  | 'bill_number'
  | 'status'
  | 'vendor'
  | 'po_ref'
  | 'total_amount'
  | 'received_date'
  | 'due_date'
  | 'updated_at';

interface ColDef { key: BillSortField; label: string }

const TABLE_COLUMNS: ColDef[] = [
  { key: 'bill_number', label: 'Bill #' },
  { key: 'status', label: 'Status' },
  { key: 'vendor', label: 'Vendor (sub)' },
  { key: 'po_ref', label: 'PO #' },
  { key: 'total_amount', label: 'Amount' },
  { key: 'received_date', label: 'Received' },
  { key: 'due_date', label: 'Due Date' },
  { key: 'updated_at', label: 'Updated' },
];

function getBillSortValue(
  bill: Bill,
  field: BillSortField,
): string | number | null | undefined {
  switch (field) {
    case 'bill_number': return bill.billNumber ?? bill.externalReference ?? bill.id;
    case 'status': return bill.status?.name;
    case 'vendor': return bill.vendorId ? bill.vendorId.slice(0, 8) : null;
    case 'po_ref': return bill.purchaseOrderId ? bill.purchaseOrderId.slice(0, 8) : null;
    case 'total_amount': { const n = Number(bill.totalAmount); return Number.isFinite(n) ? n : null; }
    case 'received_date': return bill.receivedDate;
    case 'due_date': return bill.dueDate;
    case 'updated_at': return bill.updatedAt;
    default: return null;
  }
}

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
  const [tab, setTab] = useState<ListTab>(() => parseTab(searchParams.get('tab')));
  const [columnSort, setColumnSort] = useState<{ field: BillSortField; order: 'asc' | 'desc' }>({
    field: 'updated_at',
    order: 'desc',
  });
  const [vendorFilter, setVendorFilter] = useState<Set<string>>(new Set());

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('search', debouncedSearch);
    params.set('tab', tab);
    params.set('page', '1');
    router.replace(`/bills?${params}`, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- searchParams excluded to avoid infinite loop
  }, [debouncedSearch, tab]);

  const handleColumnSort = (field: BillSortField) => {
    setColumnSort((prev) => {
      if (prev.field === field) {
        return { field, order: prev.order === 'asc' ? 'desc' : 'asc' };
      }
      return { field, order: field === 'bill_number' ? 'asc' : 'desc' };
    });
  };

  const uniqueVendors = useMemo(() => {
    const ids = new Set<string>();
    for (const bill of data.data) {
      const id = bill.vendorId?.trim();
      if (id) ids.add(id.slice(0, 8));
    }
    return [...ids].sort((a, b) => a.localeCompare(b));
  }, [data.data]);

  const toggleVendor = (name: string) => {
    setVendorFilter((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const visibleRows = useMemo(() => {
    const query = debouncedSearch.trim().toLowerCase();
    let rows = data.data;

    if (tab !== 'all') {
      rows = rows.filter((b) => {
        const archived = isArchivedStatus(b.status?.name);
        return tab === 'archived' ? archived : !archived;
      });
    }

    if (vendorFilter.size > 0) {
      rows = rows.filter((b) => {
        const id = b.vendorId?.trim();
        return id ? vendorFilter.has(id.slice(0, 8)) : false;
      });
    }

    if (query) {
      rows = rows.filter((b) => {
        const num = (b.billNumber ?? '').toLowerCase();
        const ext = (b.externalReference ?? '').toLowerCase();
        return num.includes(query) || ext.includes(query);
      });
    }

    const isDate = columnSort.field === 'received_date' || columnSort.field === 'due_date' || columnSort.field === 'updated_at';
    return [...rows].sort((a, b) => {
      const aVal = getBillSortValue(a, columnSort.field);
      const bVal = getBillSortValue(b, columnSort.field);
      return isDate
        ? compareDates(aVal as string, bVal as string, columnSort.order)
        : compareValues(aVal, bVal, columnSort.order);
    });
  }, [data.data, debouncedSearch, tab, vendorFilter, columnSort]);

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
          breakdown={breakdown}
          stats={totalValue ? [{ label: 'Total value', value: totalValue }] : undefined}
          accent="rose"
        />
      </SetPageHeader>
      <div className="flex flex-col gap-4 px-6 pb-4 pt-1">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
          <Tabs value={tab} onValueChange={(val) => setTab(val as ListTab)}>
            <TabsList>
              <TabsTrigger value="active">Active</TabsTrigger>
              <TabsTrigger value="archived">Archived</TabsTrigger>
              <TabsTrigger value="all">All</TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="relative flex-1">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              size={16}
            />
            <Input
              placeholder="Search bills by number or reference..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-10 w-full pl-9 pr-9"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X size={14} />
              </button>
            )}
          </div>

          <ValueFilterMenu
            options={uniqueVendors}
            selected={vendorFilter}
            onToggle={toggleVendor}
            onClearAll={() => setVendorFilter(new Set())}
            onSelectAll={() => setVendorFilter(new Set(uniqueVendors))}
            emptyLabel="All vendors"
            menuTitle="Filter by vendor"
            itemNoun={{ singular: 'vendor', plural: 'vendors' }}
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
                  {TABLE_COLUMNS.map((col) => (
                    <SortableColumnHeader
                      key={col.key}
                      columnKey={col.key}
                      label={col.label}
                      activeField={columnSort.field}
                      sortOrder={columnSort.order}
                      onSort={handleColumnSort}
                    />
                  ))}
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
          <div className="flex h-64 items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50">
            <div className="flex flex-col items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-slate-100">
                <Search size={24} className="text-slate-400" />
              </div>
              <p className="text-sm text-slate-400">No bills found.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
