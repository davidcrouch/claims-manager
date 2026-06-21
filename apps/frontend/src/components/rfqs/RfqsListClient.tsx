'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { FileQuestion, Search, X } from 'lucide-react';
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
import type { Rfq, PaginatedResponse } from '@/types/api';

type ListTab = 'active' | 'archived' | 'all';
const VALID_TABS = new Set<ListTab>(['active', 'archived', 'all']);
function parseTab(param: string | null): ListTab {
  if (param && VALID_TABS.has(param as ListTab)) return param as ListTab;
  return 'active';
}

type RfqSortField =
  | 'rfq_number'
  | 'status'
  | 'vendor'
  | 'job_ref'
  | 'sent_date'
  | 'due_date'
  | 'updated_at';

interface ColDef { key: RfqSortField; label: string }

const TABLE_COLUMNS: ColDef[] = [
  { key: 'rfq_number', label: 'RFQ #' },
  { key: 'status', label: 'Status' },
  { key: 'vendor', label: 'Vendor (sub)' },
  { key: 'job_ref', label: 'Job Ref' },
  { key: 'sent_date', label: 'Sent' },
  { key: 'due_date', label: 'Due' },
  { key: 'updated_at', label: 'Updated' },
];

function getRfqSortValue(rfq: Rfq, field: RfqSortField): string | null | undefined {
  switch (field) {
    case 'rfq_number': return rfq.rfqNumber ?? rfq.name ?? rfq.id;
    case 'status': return rfq.status?.name;
    case 'vendor': return rfq.rfqToName;
    case 'job_ref': return rfq.jobId ? rfq.jobId.slice(0, 8) : null;
    case 'sent_date': return rfq.sentDate;
    case 'due_date': return rfq.dueDate;
    case 'updated_at': return rfq.updatedAt;
    default: return null;
  }
}

export interface RfqsListClientProps {
  initialData: PaginatedResponse<Rfq>;
  statusOptions: StatusOption[];
}

export function RfqsListClient({
  initialData,
  statusOptions,
}: RfqsListClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [data] = useState(initialData);
  const [search, setSearch] = useState(searchParams.get('search') ?? '');
  const [debouncedSearch, setDebouncedSearch] = useState(search);
  const [tab, setTab] = useState<ListTab>(() => parseTab(searchParams.get('tab')));
  const [columnSort, setColumnSort] = useState<{ field: RfqSortField; order: 'asc' | 'desc' }>({
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
    router.replace(`/rfqs?${params}`, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- searchParams excluded to avoid infinite loop
  }, [debouncedSearch, tab]);

  const handleColumnSort = (field: RfqSortField) => {
    setColumnSort((prev) => {
      if (prev.field === field) {
        return { field, order: prev.order === 'asc' ? 'desc' : 'asc' };
      }
      return { field, order: field === 'rfq_number' ? 'asc' : 'desc' };
    });
  };

  const uniqueVendors = useMemo(() => {
    const names = new Set<string>();
    for (const rfq of data.data) {
      const name = rfq.rfqToName?.trim();
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
      rows = rows.filter((rfq) => {
        const archived = isArchivedStatus(rfq.status?.name);
        return tab === 'archived' ? archived : !archived;
      });
    }

    if (vendorFilter.size > 0) {
      rows = rows.filter((rfq) => {
        const name = rfq.rfqToName?.trim();
        return name ? vendorFilter.has(name) : false;
      });
    }

    if (query) {
      rows = rows.filter((rfq) => {
        const num = (rfq.rfqNumber ?? '').toLowerCase();
        const name = (rfq.name ?? '').toLowerCase();
        const vendor = (rfq.rfqToName ?? '').toLowerCase();
        return num.includes(query) || name.includes(query) || vendor.includes(query);
      });
    }

    const isDate = columnSort.field === 'sent_date' || columnSort.field === 'due_date' || columnSort.field === 'updated_at';
    return [...rows].sort((a, b) => {
      const aVal = getRfqSortValue(a, columnSort.field);
      const bVal = getRfqSortValue(b, columnSort.field);
      return isDate
        ? compareDates(aVal, bVal, columnSort.order)
        : compareValues(aVal, bVal, columnSort.order);
    });
  }, [data.data, debouncedSearch, tab, vendorFilter, columnSort]);

  const breakdown = computeStatusBreakdown(
    visibleRows,
    (rfq) => rfq.status?.name,
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col" style={{ height: '100%' }}>
      <SetPageHeader>
        <ListPageHeader
          icon={FileQuestion}
          title="RFQs"
          total={data.total}
          showing={visibleRows.length}
          search={debouncedSearch}
          breakdown={breakdown}
          accent="violet"
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
              placeholder="Search RFQs by number, name or vendor..."
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
                {visibleRows.map((rfq) => {
                  const num = rfq.rfqNumber ?? rfq.name ?? rfq.id;
                  const statusName = rfq.status?.name ?? 'Unknown';
                  const vendor = rfq.rfqToName ?? '';
                  return (
                    <tr
                      key={rfq.id}
                      onClick={() => router.push(`/rfqs/${rfq.id}`)}
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
                      <td className="px-4 py-3 text-slate-600">{vendor}</td>
                      <td className="px-4 py-3 text-slate-600">
                        {rfq.jobId ? rfq.jobId.slice(0, 8) : ''}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                        {formatDate(rfq.sentDate)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                        {formatDate(rfq.dueDate)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                        {formatDate(rfq.updatedAt)}
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
              <p className="text-sm text-slate-400">No RFQs found.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
