'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Receipt, Search, X } from 'lucide-react';
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
import type { Invoice, PaginatedResponse } from '@/types/api';
import { formatCurrency } from '@/components/shared/detail';

type ListTab = 'active' | 'archived' | 'all';
const VALID_TABS = new Set<ListTab>(['active', 'archived', 'all']);
function parseTab(param: string | null): ListTab {
  if (param && VALID_TABS.has(param as ListTab)) return param as ListTab;
  return 'active';
}

type InvSortField =
  | 'invoice_number'
  | 'status'
  | 'total_amount'
  | 'issue_date'
  | 'created_at'
  | 'updated_at';

interface ColDef { key: InvSortField; label: string }

const TABLE_COLUMNS: ColDef[] = [
  { key: 'invoice_number', label: 'Invoice #' },
  { key: 'status', label: 'Status' },
  { key: 'total_amount', label: 'Total' },
  { key: 'issue_date', label: 'Issue Date' },
  { key: 'created_at', label: 'Created' },
  { key: 'updated_at', label: 'Updated' },
];

function getInvSortValue(inv: Invoice, field: InvSortField): string | number | null | undefined {
  switch (field) {
    case 'invoice_number': return inv.invoiceNumber ?? inv.id;
    case 'status': return inv.status?.name;
    case 'total_amount': { const n = Number(inv.totalAmount); return Number.isFinite(n) ? n : null; }
    case 'issue_date': return inv.issueDate;
    case 'created_at': return inv.createdAt;
    case 'updated_at': return inv.updatedAt;
    default: return null;
  }
}

export interface InvoicesListClientProps {
  initialData: PaginatedResponse<Invoice>;
  statusOptions: StatusOption[];
  headerAction?: React.ReactNode;
}

export function InvoicesListClient({
  initialData,
  statusOptions,
  headerAction,
}: InvoicesListClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [data] = useState(initialData);
  const [search, setSearch] = useState(searchParams.get('search') ?? '');
  const [debouncedSearch, setDebouncedSearch] = useState(search);
  const [tab, setTab] = useState<ListTab>(() => parseTab(searchParams.get('tab')));
  const [columnSort, setColumnSort] = useState<{ field: InvSortField; order: 'asc' | 'desc' }>({
    field: 'updated_at',
    order: 'desc',
  });
  const [statusNameFilter, setStatusNameFilter] = useState<Set<string>>(new Set());

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('search', debouncedSearch);
    params.set('tab', tab);
    params.set('page', '1');
    router.replace(`/invoices?${params}`, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- searchParams excluded to avoid infinite loop
  }, [debouncedSearch, tab]);

  const handleColumnSort = (field: InvSortField) => {
    setColumnSort((prev) => {
      if (prev.field === field) {
        return { field, order: prev.order === 'asc' ? 'desc' : 'asc' };
      }
      return { field, order: field === 'invoice_number' ? 'asc' : 'desc' };
    });
  };

  const uniqueStatuses = useMemo(() => {
    const names = new Set<string>();
    for (const inv of data.data) {
      const name = inv.status?.name?.trim();
      if (name) names.add(name);
    }
    return [...names].sort((a, b) => a.localeCompare(b));
  }, [data.data]);

  const toggleStatusName = (name: string) => {
    setStatusNameFilter((prev) => {
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
      rows = rows.filter((inv) => {
        const archived = isArchivedStatus(inv.status?.name);
        return tab === 'archived' ? archived : !archived;
      });
    }

    if (statusNameFilter.size > 0) {
      rows = rows.filter((inv) => {
        const name = inv.status?.name?.trim();
        return name ? statusNameFilter.has(name) : false;
      });
    }

    if (query) {
      rows = rows.filter((inv) =>
        (inv.invoiceNumber ?? '').toLowerCase().includes(query),
      );
    }

    const isDate = columnSort.field === 'issue_date' || columnSort.field === 'created_at' || columnSort.field === 'updated_at';
    return [...rows].sort((a, b) => {
      const aVal = getInvSortValue(a, columnSort.field);
      const bVal = getInvSortValue(b, columnSort.field);
      return isDate
        ? compareDates(aVal as string, bVal as string, columnSort.order)
        : compareValues(aVal, bVal, columnSort.order);
    });
  }, [data.data, tab, statusNameFilter, debouncedSearch, columnSort]);

  const breakdown = computeStatusBreakdown(visibleRows, (i) => i.status?.name);
  const totalValue = useMemo(() => {
    const sum = visibleRows.reduce((acc, inv) => {
      const n = Number(inv.totalAmount);
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
          icon={Receipt}
          title="Invoices"
          total={data.total}
          showing={visibleRows.length}
          search={debouncedSearch}
          breakdown={breakdown}
          stats={totalValue ? [{ label: 'Total value', value: totalValue }] : undefined}
          accent="teal"
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
              placeholder="Search invoices by invoice #..."
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
            options={uniqueStatuses}
            selected={statusNameFilter}
            onToggle={toggleStatusName}
            onClearAll={() => setStatusNameFilter(new Set())}
            onSelectAll={() => setStatusNameFilter(new Set(uniqueStatuses))}
            emptyLabel="All statuses"
            menuTitle="Filter by status"
            itemNoun={{ singular: 'status', plural: 'statuses' }}
          />

          {headerAction}
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
                {visibleRows.map((inv) => {
                  const num = inv.invoiceNumber ?? inv.id;
                  const statusName = inv.status?.name ?? 'Unknown';
                  return (
                    <tr
                      key={inv.id}
                      onClick={() => router.push(`/invoices/${inv.id}`)}
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
                      <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                        {formatCurrency(inv.totalAmount)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                        {formatDate(inv.issueDate)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                        {formatDate(inv.createdAt)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                        {formatDate(inv.updatedAt)}
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
              <p className="text-sm text-slate-400">No invoices found.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
