'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ClipboardList, Plus, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
import type { Report, PaginatedResponse } from '@/types/api';

type ListTab = 'active' | 'archived' | 'all';
const VALID_TABS = new Set<ListTab>(['active', 'archived', 'all']);
function parseTab(param: string | null): ListTab {
  if (param && VALID_TABS.has(param as ListTab)) return param as ListTab;
  return 'active';
}

type ReportSortField =
  | 'reference'
  | 'status'
  | 'report_type'
  | 'job_ref'
  | 'created_at'
  | 'updated_at';

interface ColDef { key: ReportSortField; label: string }

const TABLE_COLUMNS: ColDef[] = [
  { key: 'reference', label: 'Report #' },
  { key: 'status', label: 'Status' },
  { key: 'report_type', label: 'Type' },
  { key: 'job_ref', label: 'Job Ref' },
  { key: 'created_at', label: 'Created' },
  { key: 'updated_at', label: 'Updated' },
];

function getReportSortValue(
  r: Report,
  field: ReportSortField,
): string | null | undefined {
  switch (field) {
    case 'reference': return r.reference ?? r.title ?? r.id;
    case 'status': return r.status?.name;
    case 'report_type': return r.reportType?.name;
    case 'job_ref': return r.jobId;
    case 'created_at': return r.createdAt;
    case 'updated_at': return r.updatedAt;
    default: return null;
  }
}

export interface ReportsListClientProps {
  initialData: PaginatedResponse<Report>;
  statusOptions: StatusOption[];
}

export function ReportsListClient({
  initialData,
  statusOptions,
}: ReportsListClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [data] = useState(initialData);
  const [search, setSearch] = useState(searchParams.get('search') ?? '');
  const [debouncedSearch, setDebouncedSearch] = useState(search);
  const [tab, setTab] = useState<ListTab>(() => parseTab(searchParams.get('tab')));
  const [columnSort, setColumnSort] = useState<{ field: ReportSortField; order: 'asc' | 'desc' }>({
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
    router.replace(`/reports?${params}`, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- searchParams excluded to avoid infinite loop
  }, [debouncedSearch, tab]);

  const handleColumnSort = (field: ReportSortField) => {
    setColumnSort((prev) => {
      if (prev.field === field) {
        return { field, order: prev.order === 'asc' ? 'desc' : 'asc' };
      }
      return { field, order: field === 'reference' ? 'asc' : 'desc' };
    });
  };

  const uniqueTypes = useMemo(() => {
    const names = new Set<string>();
    for (const r of data.data) {
      const name = r.reportType?.name?.trim();
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
      rows = rows.filter((r) => {
        const archived = isArchivedStatus(r.status?.name);
        return tab === 'archived' ? archived : !archived;
      });
    }

    if (typeFilter.size > 0) {
      rows = rows.filter((r) => {
        const name = r.reportType?.name?.trim();
        return name ? typeFilter.has(name) : false;
      });
    }

    if (query) {
      rows = rows.filter((r) => {
        const title = (r.title ?? '').toLowerCase();
        const ref = (r.reference ?? '').toLowerCase();
        return title.includes(query) || ref.includes(query);
      });
    }

    const isDate = columnSort.field === 'created_at' || columnSort.field === 'updated_at';
    return [...rows].sort((a, b) => {
      const aVal = getReportSortValue(a, columnSort.field);
      const bVal = getReportSortValue(b, columnSort.field);
      return isDate
        ? compareDates(aVal, bVal, columnSort.order)
        : compareValues(aVal, bVal, columnSort.order);
    });
  }, [data.data, debouncedSearch, tab, typeFilter, columnSort]);

  const breakdown = computeStatusBreakdown(
    visibleRows,
    (r) => r.status?.name,
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col" style={{ height: '100%' }}>
      <SetPageHeader>
        <ListPageHeader
          icon={ClipboardList}
          title="Reports"
          total={data.total}
          showing={visibleRows.length}
          search={debouncedSearch}
          breakdown={breakdown}
          accent="slate"
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
              placeholder="Search reports by title or reference..."
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
            emptyLabel="All report types"
            menuTitle="Filter by report type"
            itemNoun={{ singular: 'type', plural: 'types' }}
          />

          <Button size="sm" className="shrink-0" disabled title="Select a job first — create reports from a Job's detail page">
            <Plus className="mr-1 h-4 w-4" />
            Create Report
          </Button>
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
                  <th scope="col" className="px-4 py-3 w-10">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visibleRows.map((report) => {
                  const ref = report.reference ?? report.title ?? report.id;
                  const statusName = report.status?.name ?? 'Unknown';
                  const typeName = report.reportType?.name ?? '';
                  const jobRef = report.jobId ?? '';
                  return (
                    <tr
                      key={report.id}
                      onClick={() => router.push(`/reports/${report.id}`)}
                      className="cursor-pointer transition-colors hover:bg-slate-50"
                    >
                      <td className="px-4 py-3 font-medium text-slate-900">
                        {ref}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                          {statusName}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{typeName}</td>
                      <td className="px-4 py-3 text-slate-600">
                        {jobRef ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              router.push(`/jobs/${report.jobId}`);
                            }}
                            className="text-primary hover:underline"
                          >
                            {jobRef}
                          </button>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                        {formatDate(report.createdAt)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                        {formatDate(report.updatedAt)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push(`/reports/${report.id}`);
                          }}
                          className="text-xs text-primary hover:underline"
                        >
                          View
                        </button>
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
              <p className="text-sm text-slate-400">No reports found.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
