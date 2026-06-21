'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Search, X, Plus } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { WorkOrderFormDrawer } from '@/components/forms/WorkOrderFormDrawer';
import { fetchJobWorkOrdersAction } from '@/app/(app)/jobs/[id]/actions';
import { formatCurrency } from '@/components/shared/detail';
import {
  isArchivedStatus,
  compareDates,
  compareValues,
  formatDate,
  ValueFilterMenu,
  SortableColumnHeader,
} from '@/components/shared/list-filters';
import type { WorkOrder } from '@/types/api';

type ListTab = 'active' | 'archived' | 'all';

type WOSortField =
  | 'wo_number'
  | 'status'
  | 'type'
  | 'start_date'
  | 'total'
  | 'updated_at';

interface ColDef { key: WOSortField; label: string }

const TABLE_COLUMNS: ColDef[] = [
  { key: 'wo_number', label: 'WO #' },
  { key: 'status', label: 'Status' },
  { key: 'type', label: 'Type' },
  { key: 'start_date', label: 'Start' },
  { key: 'total', label: 'Total' },
  { key: 'updated_at', label: 'Updated' },
];

function getSortValue(wo: WorkOrder, field: WOSortField): string | number | null | undefined {
  switch (field) {
    case 'wo_number': return wo.workOrderNumber ?? wo.externalId ?? wo.id;
    case 'status': return wo.status?.name;
    case 'type': return wo.workOrderType?.name;
    case 'start_date': return wo.startDate;
    case 'total': { const n = Number(wo.totalAmount); return Number.isFinite(n) ? n : null; }
    case 'updated_at': return wo.updatedAt;
    default: return null;
  }
}

export function JobWorkOrdersTab({ jobId }: { jobId: string }) {
  const router = useRouter();
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const [tab, setTab] = useState<ListTab>('active');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<Set<string>>(new Set());
  const [columnSort, setColumnSort] = useState<{ field: WOSortField; order: 'asc' | 'desc' }>({
    field: 'updated_at',
    order: 'desc',
  });

  const load = useCallback(() => {
    setLoading(true);
    fetchJobWorkOrdersAction(jobId)
      .then((data) => setWorkOrders(data ?? []))
      .catch((err) => console.error('JobWorkOrdersTab:', err))
      .finally(() => setLoading(false));
  }, [jobId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const handleColumnSort = (field: WOSortField) => {
    setColumnSort((prev) => {
      if (prev.field === field) return { field, order: prev.order === 'asc' ? 'desc' : 'asc' };
      return { field, order: field === 'wo_number' ? 'asc' : 'desc' };
    });
  };

  const uniqueTypes = useMemo(() => {
    const names = new Set<string>();
    for (const wo of workOrders) {
      const n = wo.workOrderType?.name?.trim();
      if (n) names.add(n);
    }
    return [...names].sort((a, b) => a.localeCompare(b));
  }, [workOrders]);

  const toggleType = (name: string) => {
    setTypeFilter((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const visibleRows = useMemo(() => {
    let rows = workOrders;

    if (tab !== 'all') {
      rows = rows.filter((wo) => {
        const archived = isArchivedStatus(wo.status?.name);
        return tab === 'archived' ? archived : !archived;
      });
    }

    if (typeFilter.size > 0) {
      rows = rows.filter((wo) => {
        const n = wo.workOrderType?.name?.trim();
        return n ? typeFilter.has(n) : false;
      });
    }

    const query = debouncedSearch.trim().toLowerCase();
    if (query) {
      rows = rows.filter((wo) => {
        const num = (wo.workOrderNumber ?? '').toLowerCase();
        const name = (wo.name ?? '').toLowerCase();
        return num.includes(query) || name.includes(query);
      });
    }

    const isDate = columnSort.field === 'start_date' || columnSort.field === 'updated_at';
    return [...rows].sort((a, b) => {
      const aVal = getSortValue(a, columnSort.field);
      const bVal = getSortValue(b, columnSort.field);
      return isDate
        ? compareDates(aVal as string, bVal as string, columnSort.order)
        : compareValues(aVal, bVal, columnSort.order);
    });
  }, [workOrders, tab, typeFilter, debouncedSearch, columnSort]);

  if (loading) {
    return <p className="text-sm text-slate-400">Loading...</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
        <Tabs value={tab} onValueChange={(val) => setTab(val as ListTab)}>
          <TabsList>
            <TabsTrigger value="active">Active</TabsTrigger>
            <TabsTrigger value="archived">Archived</TabsTrigger>
            <TabsTrigger value="all">All</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <Input
            placeholder="Search work orders..."
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
          options={uniqueTypes}
          selected={typeFilter}
          onToggle={toggleType}
          onClearAll={() => setTypeFilter(new Set())}
          onSelectAll={() => setTypeFilter(new Set(uniqueTypes))}
          emptyLabel="All types"
          menuTitle="Filter by type"
          itemNoun={{ singular: 'type', plural: 'types' }}
        />

        <Button onClick={() => setDrawerOpen(true)} size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Create Work Order
        </Button>
      </div>

      <WorkOrderFormDrawer
        open={drawerOpen}
        onOpenChange={(open) => {
          setDrawerOpen(open);
          if (!open) load();
        }}
        jobId={jobId}
      />

      {visibleRows.length === 0 ? (
        <div className="flex h-48 items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50">
          <div className="flex flex-col items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-slate-100">
              <Search size={24} className="text-slate-400" />
            </div>
            <p className="text-sm text-slate-400">No work orders found.</p>
          </div>
        </div>
      ) : (
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
              {visibleRows.map((wo) => {
                const statusName = wo.status?.name ?? 'Unknown';
                return (
                  <tr
                    key={wo.id}
                    onClick={() => router.push(`/work-orders/${wo.id}`)}
                    className="cursor-pointer transition-colors hover:bg-slate-50"
                  >
                    <td className="whitespace-nowrap px-4 py-3 font-medium text-slate-900">
                      {wo.workOrderNumber ?? wo.externalId ?? wo.id}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                        {statusName}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{wo.workOrderType?.name ?? '—'}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-600">{formatDate(wo.startDate)}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-right font-medium text-slate-900">
                      {formatCurrency(wo.totalAmount)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-600">{formatDate(wo.updatedAt)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
