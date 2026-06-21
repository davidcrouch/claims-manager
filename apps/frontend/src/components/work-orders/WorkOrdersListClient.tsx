'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ClipboardCheck, Search, X } from 'lucide-react';
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
import type { WorkOrder, PaginatedResponse } from '@/types/api';

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

type WOSortField =
  | 'work_order_number'
  | 'status'
  | 'wo_type'
  | 'source'
  | 'job_ref'
  | 'total_amount'
  | 'start_date'
  | 'updated_at';

interface ColDef { key: WOSortField; label: string }

const TABLE_COLUMNS: ColDef[] = [
  { key: 'work_order_number', label: 'WO #' },
  { key: 'status', label: 'Status' },
  { key: 'wo_type', label: 'Type' },
  { key: 'source', label: 'From (upstream)' },
  { key: 'job_ref', label: 'Job Ref' },
  { key: 'total_amount', label: 'Total' },
  { key: 'start_date', label: 'Start' },
  { key: 'updated_at', label: 'Updated' },
];

function getWOSortValue(wo: WorkOrder, field: WOSortField): string | number | null | undefined {
  switch (field) {
    case 'work_order_number': return wo.workOrderNumber ?? wo.externalId ?? wo.id;
    case 'status': return wo.status?.name;
    case 'wo_type': return wo.workOrderType?.name;
    case 'source': return wo.sourceExternalReference;
    case 'job_ref': return wo.jobId ? wo.jobId.slice(0, 8) : null;
    case 'total_amount': { const n = Number(wo.totalAmount); return Number.isFinite(n) ? n : null; }
    case 'start_date': return wo.startDate;
    case 'updated_at': return wo.updatedAt;
    default: return null;
  }
}

export interface WorkOrdersListClientProps {
  initialData: PaginatedResponse<WorkOrder>;
  statusOptions: StatusOption[];
}

export function WorkOrdersListClient({
  initialData,
  statusOptions,
}: WorkOrdersListClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [data] = useState(initialData);
  const [search, setSearch] = useState(searchParams.get('search') ?? '');
  const [debouncedSearch, setDebouncedSearch] = useState(search);
  const [tab, setTab] = useState<ListTab>(() => parseTab(searchParams.get('tab')));
  const [columnSort, setColumnSort] = useState<{ field: WOSortField; order: 'asc' | 'desc' }>({
    field: 'updated_at',
    order: 'desc',
  });
  const [typeFilter, setTypeFilter] = useState<Set<string>>(new Set());

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('search', debouncedSearch);
    params.set('tab', tab);
    params.set('page', '1');
    router.replace(`/work-orders?${params}`, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- searchParams excluded to avoid infinite loop
  }, [debouncedSearch, tab]);

  const handleColumnSort = (field: WOSortField) => {
    setColumnSort((prev) => {
      if (prev.field === field) {
        return { field, order: prev.order === 'asc' ? 'desc' : 'asc' };
      }
      return { field, order: field === 'work_order_number' ? 'asc' : 'desc' };
    });
  };

  const uniqueTypes = useMemo(() => {
    const names = new Set<string>();
    for (const wo of data.data) {
      const name = wo.workOrderType?.name?.trim();
      if (name) names.add(name);
    }
    return [...names].sort((a, b) => a.localeCompare(b));
  }, [data.data]);

  const toggleType = (name: string) => {
    setTypeFilter((prev) => {
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
      rows = rows.filter((wo) => {
        const archived = isArchivedStatus(wo.status?.name);
        return tab === 'archived' ? archived : !archived;
      });
    }

    if (typeFilter.size > 0) {
      rows = rows.filter((wo) => {
        const name = wo.workOrderType?.name?.trim();
        return name ? typeFilter.has(name) : false;
      });
    }

    if (query) {
      rows = rows.filter((wo) => {
        const num = (wo.workOrderNumber ?? '').toLowerCase();
        const ext = (wo.externalId ?? '').toLowerCase();
        const name = (wo.name ?? '').toLowerCase();
        return num.includes(query) || ext.includes(query) || name.includes(query);
      });
    }

    const isDate = columnSort.field === 'start_date' || columnSort.field === 'updated_at';
    return [...rows].sort((a, b) => {
      const aVal = getWOSortValue(a, columnSort.field);
      const bVal = getWOSortValue(b, columnSort.field);
      return isDate
        ? compareDates(aVal as string, bVal as string, columnSort.order)
        : compareValues(aVal, bVal, columnSort.order);
    });
  }, [data.data, tab, typeFilter, debouncedSearch, columnSort]);

  const breakdown = computeStatusBreakdown(visibleRows, (wo) => wo.status?.name);

  const totalValue = useMemo(() => {
    const sum = visibleRows.reduce((acc, wo) => {
      const n = Number(wo.totalAmount);
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
          icon={ClipboardCheck}
          title="Work Orders"
          total={data.total}
          showing={visibleRows.length}
          search={debouncedSearch}
          breakdown={breakdown}
          stats={totalValue ? [{ label: 'Total value', value: totalValue }] : undefined}
          accent="indigo"
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
              placeholder="Search work orders by WO #, name or job ref..."
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
                {visibleRows.map((wo) => {
                  const num = wo.workOrderNumber ?? wo.externalId ?? wo.id;
                  const statusName = wo.status?.name ?? 'Unknown';
                  const woType = wo.workOrderType?.name ?? '';
                  const source = wo.sourceExternalReference ?? '';
                  return (
                    <tr
                      key={wo.id}
                      onClick={() => router.push(`/work-orders/${wo.id}`)}
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
                      <td className="px-4 py-3 text-slate-600">{woType}</td>
                      <td className="px-4 py-3 text-slate-600">{source}</td>
                      <td className="px-4 py-3 text-slate-600">
                        {wo.jobId ? wo.jobId.slice(0, 8) : ''}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                        {formatAmount(wo.totalAmount)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                        {formatDate(wo.startDate)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                        {formatDate(wo.updatedAt)}
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
              <p className="text-sm text-slate-400">No work orders found.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
