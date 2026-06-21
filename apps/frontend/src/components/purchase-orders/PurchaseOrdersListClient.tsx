'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ShoppingCart, Search, X } from 'lucide-react';
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
import type { PurchaseOrder, PaginatedResponse } from '@/types/api';

type ListTab = 'active' | 'archived' | 'all';
const VALID_TABS = new Set<ListTab>(['active', 'archived', 'all']);
function parseTab(param: string | null): ListTab {
  if (param && VALID_TABS.has(param as ListTab)) return param as ListTab;
  return 'active';
}

function formatAmount(value?: string | null): string {
  if (!value) return '';
  const n = Number(value);
  if (Number.isNaN(n)) return value;
  return n.toLocaleString(undefined, {
    style: 'currency',
    currency: 'AUD',
    maximumFractionDigits: 2,
  });
}

type POSortField =
  | 'purchase_order_number'
  | 'status'
  | 'vendor'
  | 'total_amount'
  | 'external_id'
  | 'updated_at';

interface ColDef { key: POSortField; label: string }

const TABLE_COLUMNS: ColDef[] = [
  { key: 'purchase_order_number', label: 'PO #' },
  { key: 'status', label: 'Status' },
  { key: 'vendor', label: 'Vendor' },
  { key: 'total_amount', label: 'Total' },
  { key: 'external_id', label: 'External Id' },
  { key: 'updated_at', label: 'Updated' },
];

function getPOSortValue(
  po: PurchaseOrder,
  field: POSortField,
): string | number | null | undefined {
  switch (field) {
    case 'purchase_order_number': return po.purchaseOrderNumber ?? po.externalId ?? po.id;
    case 'status': return po.status?.name;
    case 'vendor': return po.vendor?.name;
    case 'total_amount': { const n = Number(po.totalAmount); return Number.isFinite(n) ? n : null; }
    case 'external_id': return po.externalId;
    case 'updated_at': return po.updatedAt;
    default: return null;
  }
}

export interface PurchaseOrdersListClientProps {
  initialData: PaginatedResponse<PurchaseOrder>;
  statusOptions: StatusOption[];
}

export function PurchaseOrdersListClient({
  initialData,
  statusOptions,
}: PurchaseOrdersListClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [data] = useState(initialData);
  const [search, setSearch] = useState(searchParams.get('search') ?? '');
  const [debouncedSearch, setDebouncedSearch] = useState(search);
  const [tab, setTab] = useState<ListTab>(() => parseTab(searchParams.get('tab')));
  const [columnSort, setColumnSort] = useState<{ field: POSortField; order: 'asc' | 'desc' }>({
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
    router.replace(`/purchase-orders?${params}`, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- searchParams excluded to avoid infinite loop
  }, [debouncedSearch, tab]);

  const handleColumnSort = (field: POSortField) => {
    setColumnSort((prev) => {
      if (prev.field === field) {
        return { field, order: prev.order === 'asc' ? 'desc' : 'asc' };
      }
      return { field, order: field === 'purchase_order_number' ? 'asc' : 'desc' };
    });
  };

  const uniqueVendors = useMemo(() => {
    const names = new Set<string>();
    for (const po of data.data) {
      const name = po.vendor?.name?.trim();
      if (name) names.add(name);
    }
    return [...names].sort((a, b) => a.localeCompare(b));
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
      rows = rows.filter((po) => {
        const archived = isArchivedStatus(po.status?.name);
        return tab === 'archived' ? archived : !archived;
      });
    }

    if (vendorFilter.size > 0) {
      rows = rows.filter((po) => {
        const name = po.vendor?.name?.trim();
        return name ? vendorFilter.has(name) : false;
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

    const isDate = columnSort.field === 'updated_at';
    return [...rows].sort((a, b) => {
      const aVal = getPOSortValue(a, columnSort.field);
      const bVal = getPOSortValue(b, columnSort.field);
      return isDate
        ? compareDates(aVal as string, bVal as string, columnSort.order)
        : compareValues(aVal, bVal, columnSort.order);
    });
  }, [data.data, debouncedSearch, tab, vendorFilter, columnSort]);

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
              placeholder="Search purchase orders by PO #, external id or vendor..."
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
                      <td className="whitespace-nowrap px-4 py-3">
                        <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                          {statusName}
                        </span>
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
