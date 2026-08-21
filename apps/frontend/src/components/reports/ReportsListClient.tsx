'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ClipboardList, Plus, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { StatusBadge } from '@/components/ui/status-badge';
import { TypeBadge } from '@/components/ui/type-badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  type StatusOption,
  formatDate,
  commitColumnFilterSelection,
  columnFilterToIdsParam,
  ValueFilterMenu,
  SortableColumnHeader,
  TableEmptyRow,
  statusIdsForArchiveListTab,
  mergeStatusParamWithTab,
} from '@/components/shared/list-filters';
import { TablePagination } from '@/components/shared/table-pagination';
import { SetPageHeader } from '@/components/layout/SetPageHeader';
import {
  ListPageHeader,
  computeStatusBreakdown,
} from '@/components/layout/ListPageHeader';
import { fetchReportsAction } from '@/app/(app)/reports/actions';
import {
  ColumnSettingsHeaderCell,
  useColumnVisibility,
} from '@/components/shared/column-visibility';
import { ListArchiveButton, LIST_ARCHIVE_SPACER_TD_CLASS } from '@/components/shared/ListArchiveButton';
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

interface ColDef { key: ReportSortField; label: string; filterable?: boolean; locked?: boolean }

const TABLE_COLUMNS: ColDef[] = [
  { key: 'reference', label: 'Report #', locked: true },
  { key: 'status', label: 'Status', filterable: true },
  { key: 'report_type', label: 'Type', filterable: true },
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
  reportTypes: StatusOption[];
}

const PAGE_SIZE = 20;

export function ReportsListClient({
  initialData,
  statusOptions,
  reportTypes,
}: ReportsListClientProps) {
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
  const [columnSort, setColumnSort] = useState<{ field: ReportSortField; order: 'asc' | 'desc' }>({
    field: 'updated_at',
    order: 'desc',
  });
  const [typeFilter, setTypeFilter] = useState<Set<string>>(new Set());
  const [typeFilterActive, setTypeFilterActive] = useState(false);
  const [statusFilter, setStatusFilter] = useState<Set<string>>(new Set());
  const [statusFilterActive, setStatusFilterActive] = useState(false);
  const { isVisible, toggle, visibleCount } = useColumnVisibility(
    'reports',
    TABLE_COLUMNS,
  );
  const lastFetchKeyRef = useRef<string | null>(null);
  const tabStatusIds = useMemo(
    () => statusIdsForArchiveListTab(tab, statusOptions),
    [tab, statusOptions],
  );
  const statusParam = useMemo(
    () =>
      mergeStatusParamWithTab(
        columnFilterToIdsParam(statusFilterActive, statusFilter, statusOptions),
        tabStatusIds,
      ),
    [statusFilterActive, statusFilter, statusOptions, tabStatusIds],
  );
  const reportTypeParam = useMemo(
    () => columnFilterToIdsParam(typeFilterActive, typeFilter, reportTypes),
    [typeFilterActive, typeFilter, reportTypes],
  );

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const sortParam = `${columnSort.field}_${columnSort.order}`;

  useEffect(() => {
    const statusKey = statusParam === null ? '__none__' : (statusParam ?? '');
    const typeKey = reportTypeParam === null ? '__none__' : (reportTypeParam ?? '');
    const fetchKey = `${debouncedSearch}|${sortParam}|${tab}|${page}|${statusKey}|${typeKey}`;
    const params = new URLSearchParams(searchParams.toString());
    params.set('search', debouncedSearch);
    params.set('tab', tab);
    params.set('page', String(page));
    params.set('sort', sortParam);
    if (statusParam) params.set('status', statusParam); else params.delete('status');
    if (reportTypeParam) params.set('reportTypeId', reportTypeParam); else params.delete('reportTypeId');
    router.replace(`/reports?${params}`, { scroll: false });

    if (lastFetchKeyRef.current === fetchKey) return;
    lastFetchKeyRef.current = fetchKey;

    if (statusParam === null || reportTypeParam === null) {
      setData({ data: [], total: 0 });
      return;
    }

    fetchReportsAction({
      page,
      limit: PAGE_SIZE,
      sort: sortParam,
      status: statusParam,
      reportTypeId: reportTypeParam,
      search: debouncedSearch || undefined,
    }).then(
      (res) => res && setData(res),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, sortParam, tab, page, statusParam, reportTypeParam]);

  const handleColumnSort = (field: ReportSortField) => {
    setColumnSort((prev) => {
      if (prev.field === field) {
        return { field, order: prev.order === 'asc' ? 'desc' : 'asc' };
      }
      return { field, order: field === 'reference' ? 'asc' : 'desc' };
    });
    setPage(1);
  };

  const handlePageChange = (newPage: number) => setPage(newPage);
  const handleSearchChange = (value: string) => { setSearch(value); setPage(1); };
  const handleTabChange = (val: string) => { setTab(val as ListTab); setPage(1); };

  const uniqueTypes = useMemo(() => [...new Set(reportTypes.map((type) => type.name.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b)), [reportTypes]);

  const uniqueStatuses = useMemo(() => {
    const fromOptions = statusOptions
      .map((s) => s.name?.trim())
      .filter((n): n is string => !!n);
    if (fromOptions.length > 0) {
      return [...new Set(fromOptions)].sort((a, b) => a.localeCompare(b));
    }
    const names = new Set<string>();
    for (const r of data.data) {
      const name = r.status?.name?.trim();
      if (name) names.add(name);
    }
    return [...names].sort((a, b) => a.localeCompare(b));
  }, [data.data, statusOptions]);

  const toggleType = (name: string) => {
    const working = typeFilterActive ? new Set(typeFilter) : new Set(uniqueTypes);
    if (working.has(name)) working.delete(name);
    else working.add(name);
    const committed = commitColumnFilterSelection({
      next: working,
      optionCount: uniqueTypes.length,
    });
    setTypeFilter(committed.selected);
    setTypeFilterActive(committed.active);
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

  const applyTypeFilter = (next: Set<string>) => {
    const committed = commitColumnFilterSelection({
      next,
      optionCount: uniqueTypes.length,
    });
    setTypeFilter(committed.selected);
    setTypeFilterActive(committed.active);
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

  const typeFilterProps = {
    options: uniqueTypes,
    selected: typeFilter,
    active: typeFilterActive,
    onApply: applyTypeFilter,
    menuTitle: 'Filter by report type',
    itemNoun: { singular: 'type', plural: 'types' },
  };

  const visibleRows = data.data;

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
              placeholder="Search reports by title or reference..."
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
            options={uniqueTypes}
            selected={typeFilterActive ? typeFilter : new Set(uniqueTypes)}
            onToggle={toggleType}
            onClearAll={() => {
              setTypeFilter(new Set());
              setTypeFilterActive(false);
              setPage(1);
            }}
            onSelectAll={() => {
              setTypeFilter(new Set());
              setTypeFilterActive(false);
              setPage(1);
            }}
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
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50">
                <tr className="text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                  {TABLE_COLUMNS.filter((col) => isVisible(col.key)).map((col) => (
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
                          : col.key === 'report_type'
                            ? typeFilterProps
                            : undefined
                      }
                    />
                  ))}
                  <th scope="col" className="px-4 py-3">Actions</th>
                  <ColumnSettingsHeaderCell
                    columns={TABLE_COLUMNS}
                    isVisible={isVisible}
                    onToggle={toggle}
                  />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visibleRows.length === 0 ? (
                  <TableEmptyRow colSpan={visibleCount + 2} label="No reports found." />
                ) : (
                  visibleRows.map((report) => {
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
                      {isVisible('reference') && (
                        <td className="px-4 py-3 font-medium text-slate-900">
                          {ref}
                        </td>
                      )}
                      {isVisible('status') && (
                        <td className="whitespace-nowrap px-4 py-3">
                          <StatusBadge status={statusName} />
                        </td>
                      )}
                      {isVisible('report_type') && (
                        <td className="px-4 py-3">
                          <TypeBadge type={typeName} />
                        </td>
                      )}
                      {isVisible('job_ref') && (
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
                      )}
                      {isVisible('created_at') && (
                        <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                          {formatDate(report.createdAt)}
                        </td>
                      )}
                      {isVisible('updated_at') && (
                        <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                          {formatDate(report.updatedAt)}
                        </td>
                      )}
                      <td
                        className="whitespace-nowrap px-4 py-3 text-slate-600"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center gap-2">
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
                          <ListArchiveButton
                            entityType="report"
                            entityId={report.id}
                            statusName={statusName}
                            entityLabel={ref}
                            onArchived={(id) => {
                              setData((prev) => ({
                                ...prev,
                                data: prev.data.filter((row) => row.id !== id),
                                total: Math.max(0, prev.total - 1),
                              }));
                            }}
                          />
                        </div>
                      </td>
                      <td className={LIST_ARCHIVE_SPACER_TD_CLASS} aria-hidden />
                    </tr>
                  );
                })
                )}
              </tbody>
            </table>
            <TablePagination
              page={page}
              pageSize={PAGE_SIZE}
              total={data.total}
              onPageChange={handlePageChange}
            />
          </div>
      </div>
    </div>
  );
}
