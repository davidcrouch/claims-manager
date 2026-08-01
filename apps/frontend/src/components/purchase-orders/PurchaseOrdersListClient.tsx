'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ShoppingCart, Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { StatusBadge } from '@/components/ui/status-badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  type StatusOption,
  formatDate,
  isArchivedStatus,
  commitColumnFilterSelection,
  columnFilterToIdsParam,
  ValueFilterMenu,
  SortableColumnHeader,
} from '@/components/shared/list-filters';
import { resolveJobName } from '@/components/shared/job-label';
import { TablePagination } from '@/components/shared/table-pagination';
import { SetPageHeader } from '@/components/layout/SetPageHeader';
import {
  ListPageHeader,
  computeStatusBreakdown,
} from '@/components/layout/ListPageHeader';
import { fetchPurchaseOrdersAction } from '@/app/(app)/purchase-orders/actions';
import type { PurchaseOrder, PaginatedResponse } from '@/types/api';

type ListTab = 'active' | 'archived' | 'all';
const VALID_TABS = new Set<ListTab>(['active', 'archived', 'all']);
function parseTab(param: string | null): ListTab {
  if (param && VALID_TABS.has(param as ListTab)) return param as ListTab;
  return 'active';
}

const PAGE_SIZE = 20;

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

type POSortField =
  | 'purchase_order_number'
  | 'job'
  | 'status'
  | 'vendor'
  | 'total_amount'
  | 'external_id'
  | 'updated_at';

interface ColDef { key: POSortField; label: string; filterable?: boolean }

const TABLE_COLUMNS: ColDef[] = [
  { key: 'purchase_order_number', label: 'PO #' },
  { key: 'job', label: 'Job' },
  { key: 'status', label: 'Status', filterable: true },
  { key: 'vendor', label: 'Vendor', filterable: true },
  { key: 'total_amount', label: 'Total' },
  { key: 'external_id', label: 'External Id' },
  { key: 'updated_at', label: 'Updated' },
];

export interface PurchaseOrdersListClientProps {
  initialData: PaginatedResponse<PurchaseOrder>;
  statusOptions: StatusOption[];
  vendorOptions: StatusOption[];
  jobNameById?: Record<string, string>;
}

export function PurchaseOrdersListClient({
  initialData,
  statusOptions,
  vendorOptions,
  jobNameById,
}: PurchaseOrdersListClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [data, setData] = useState(initialData);
  const [search, setSearch] = useState(searchParams.get('search') ?? '');
  const [debouncedSearch, setDebouncedSearch] = useState(search);
  const [tab, setTab] = useState<ListTab>(() => parseTab(searchParams.get('tab')));
  const [page, setPage] = useState(() => {
    const p = parseInt(searchParams.get('page') ?? '1', 10);
    return Number.isFinite(p) && p > 0 ? p : 1;
  });
  const [columnSort, setColumnSort] = useState<{ field: POSortField; order: 'asc' | 'desc' }>({
    field: 'updated_at',
    order: 'desc',
  });
  const [vendorFilter, setVendorFilter] = useState<Set<string>>(new Set());
  const [vendorFilterActive, setVendorFilterActive] = useState(false);
  const [statusFilter, setStatusFilter] = useState<Set<string>>(new Set());
  const [statusFilterActive, setStatusFilterActive] = useState(false);
  const lastFetchKeyRef = useRef<string | null>(null);
  const statusParam = useMemo(
    () => columnFilterToIdsParam(statusFilterActive, statusFilter, statusOptions),
    [statusFilterActive, statusFilter, statusOptions],
  );
  const vendorParam = useMemo(
    () => columnFilterToIdsParam(vendorFilterActive, vendorFilter, vendorOptions),
    [vendorFilterActive, vendorFilter, vendorOptions],
  );

  const sortParam = `${columnSort.field}_${columnSort.order}`;

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    const statusKey = statusParam === null ? '__none__' : (statusParam ?? '');
    const vendorKey = vendorParam === null ? '__none__' : (vendorParam ?? '');
    const fetchKey = `${debouncedSearch}|${sortParam}|${tab}|${page}|${statusKey}|${vendorKey}`;
    const params = new URLSearchParams(searchParams.toString());
    params.set('search', debouncedSearch);
    params.set('tab', tab);
    params.set('page', String(page));
    params.set('sort', sortParam);
    if (statusParam) params.set('status', statusParam); else params.delete('status');
    if (vendorParam) params.set('vendorId', vendorParam); else params.delete('vendorId');
    router.replace(`/purchase-orders?${params}`, { scroll: false });
    if (lastFetchKeyRef.current === fetchKey) return;
    lastFetchKeyRef.current = fetchKey;
    if (statusParam === null || vendorParam === null) {
      setData({ data: [], total: 0 });
      return;
    }
    fetchPurchaseOrdersAction({ page, limit: PAGE_SIZE, sort: sortParam, status: statusParam, vendorId: vendorParam }).then((res) => res && setData(res));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- searchParams excluded to avoid infinite loop
  }, [debouncedSearch, sortParam, tab, page, statusParam, vendorParam]);

  const handleColumnSort = (field: POSortField) => {
    setColumnSort((prev) => {
      if (prev.field === field) {
        return { field, order: prev.order === 'asc' ? 'desc' : 'asc' };
      }
      return { field, order: field === 'purchase_order_number' ? 'asc' : 'desc' };
    });
    setPage(1);
  };

  const handlePageChange = (newPage: number) => setPage(newPage);
  const handleSearchChange = (value: string) => { setSearch(value); setPage(1); };
  const handleTabChange = (val: string) => { setTab(val as ListTab); setPage(1); };

  const uniqueVendors = useMemo(() => [...new Set(vendorOptions.map((vendor) => vendor.name.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b)), [vendorOptions]);

  const uniqueStatuses = useMemo(() => {
    const fromOptions = statusOptions
      .map((s) => s.name?.trim())
      .filter((n): n is string => !!n);
    if (fromOptions.length > 0) {
      return [...new Set(fromOptions)].sort((a, b) => a.localeCompare(b));
    }
    const names = new Set<string>();
    for (const po of data.data) {
      const name = po.status?.name?.trim();
      if (name) names.add(name);
    }
    return [...names].sort((a, b) => a.localeCompare(b));
  }, [data.data, statusOptions]);

  const toggleVendor = (name: string) => {
    const working = vendorFilterActive ? new Set(vendorFilter) : new Set(uniqueVendors);
    if (working.has(name)) working.delete(name);
    else working.add(name);
    const committed = commitColumnFilterSelection({
      next: working,
      optionCount: uniqueVendors.length,
    });
    setVendorFilter(committed.selected);
    setVendorFilterActive(committed.active);
    setPage(1);
  };

  const applyStatusFilter = (next: Set<string>) => {
    const committed = commitColumnFilterSelection({
      next,
      optionCount: uniqueStatuses.length,
    });
    setStatusFilter(committed.selected);
    setStatusFilterActive(committed.active);
    setPage(1);
  };

  const applyVendorFilter = (next: Set<string>) => {
    const committed = commitColumnFilterSelection({
      next,
      optionCount: uniqueVendors.length,
    });
    setVendorFilter(committed.selected);
    setVendorFilterActive(committed.active);
    setPage(1);
  };

  const statusFilterProps = {
    options: uniqueStatuses,
    selected: statusFilter,
    active: statusFilterActive,
    onApply: applyStatusFilter,
    menuTitle: 'Filter by status',
    itemNoun: { singular: 'status', plural: 'statuses' },
  };

  const vendorFilterProps = {
    options: uniqueVendors,
    selected: vendorFilter,
    active: vendorFilterActive,
    onApply: applyVendorFilter,
    menuTitle: 'Filter by vendor',
    itemNoun: { singular: 'vendor', plural: 'vendors' },
  };

  const visibleRows = useMemo(() => {
    const query = debouncedSearch.trim().toLowerCase();
    let rows = data.data;

    if (tab !== 'all') {
      rows = rows.filter((po) => {
        const archived = isArchivedStatus(po.status?.name);
        return tab === 'archived' ? archived : !archived;
      });
    }

    if (query) {
      rows = rows.filter((po) => {
        const num = (po.purchaseOrderNumber ?? '').toLowerCase();
        const ext = (po.externalId ?? '').toLowerCase();
        const vendor = (po.vendor?.name ?? '').toLowerCase();
        return num.includes(query) || ext.includes(query) || vendor.includes(query);
      });
    }

    return rows;
  }, [data.data, debouncedSearch, tab]);

  const breakdown = computeStatusBreakdown(
    visibleRows,
    (po) => po.status?.name,
  );
  const totalValue = useMemo(() => {
    const sum = visibleRows.reduce((acc, po) => {
      const n = Number(po.totalAmount);
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
          icon={ShoppingCart}
          title="Purchase Orders"
          total={data.total}
          showing={visibleRows.length}
          search={debouncedSearch}
          breakdown={breakdown}
          stats={totalValue ? [{ label: 'Total value', value: totalValue }] : undefined}
          accent="orange"
        />
      </SetPageHeader>
      <div className="flex flex-col gap-4 px-6 pb-4 pt-1">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
          <Tabs value={tab} onValueChange={handleTabChange}>
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
              placeholder="Search purchase orders by PO #, external id or vendor..."
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="h-10 w-full pl-9 pr-9"
            />
            {search && (
              <button
                type="button"
                onClick={() => handleSearchChange('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X size={14} />
              </button>
            )}
          </div>

          <ValueFilterMenu
            options={uniqueVendors}
            selected={vendorFilterActive ? vendorFilter : new Set(uniqueVendors)}
            onToggle={toggleVendor}
            onClearAll={() => {
              setVendorFilter(new Set());
              setVendorFilterActive(false);
              setPage(1);
            }}
            onSelectAll={() => {
              setVendorFilter(new Set());
              setVendorFilterActive(false);
              setPage(1);
            }}
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
                      filter={
                        col.key === 'status'
                          ? statusFilterProps
                          : col.key === 'vendor'
                            ? vendorFilterProps
                            : undefined
                      }
                    />
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visibleRows.map((po) => {
                  const num =
                    po.purchaseOrderNumber ?? po.externalId ?? po.id;
                  const statusName = po.status?.name ?? 'Unknown';
                  const vendorName = po.vendor?.name ?? '';
                  return (
                    <tr
                      key={po.id}
                      onClick={() => router.push(`/purchase-orders/${po.id}`)}
                      className="cursor-pointer transition-colors hover:bg-slate-50"
                    >
                      <td className="whitespace-nowrap px-4 py-3 font-medium text-slate-900">
                        {num}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {resolveJobName(po.jobId, jobNameById)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <StatusBadge status={statusName} />
                      </td>
                      <td className="px-4 py-3 text-slate-600">{vendorName}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                        {formatAmount(po.totalAmount)}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {po.externalId ?? ''}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                        {formatDate(po.updatedAt)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <TablePagination page={page} pageSize={PAGE_SIZE} total={data.total} onPageChange={handlePageChange} />
          </div>
        ) : (
          <div className="flex h-64 items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50">
            <div className="flex flex-col items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-slate-100">
                <Search size={24} className="text-slate-400" />
              </div>
              <p className="text-sm text-slate-400">No purchase orders found.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
