'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Briefcase, Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { StatusBadge } from '@/components/ui/status-badge';
import { TypeBadge } from '@/components/ui/type-badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SetPageHeader } from '@/components/layout/SetPageHeader';
import {
  ListPageHeader,
  computeStatusBreakdown,
} from '@/components/layout/ListPageHeader';
import { fetchJobsAction } from '@/app/(app)/jobs/actions';
import type { Job, PaginatedResponse } from '@/types/api';
import {
  type StatusOption,
  formatDate,
  isArchivedStatus,
  commitColumnFilterSelection,
  columnFilterToIdsParam,
  ValueFilterMenu,
  SortableColumnHeader,
  TableEmptyRow,
} from '@/components/shared/list-filters';
import { TablePagination } from '@/components/shared/table-pagination';
import {
  ColumnSettingsHeaderCell,
  useColumnVisibility,
} from '@/components/shared/column-visibility';
import { ListArchiveButton, LIST_ARCHIVE_TH_CLASS, LIST_ARCHIVE_TD_CLASS, LIST_ARCHIVE_SPACER_TD_CLASS } from '@/components/shared/ListArchiveButton';
import { formatAddress } from '@/components/shared/detail';

const PAGE_SIZE = 20;

type ListTab = 'active' | 'archived' | 'all';
const VALID_TABS = new Set<ListTab>(['active', 'archived', 'all']);
function parseTab(param: string | null): ListTab {
  if (param && VALID_TABS.has(param as ListTab)) return param as ListTab;
  return 'active';
}

function jobListAddress(job: Job): string {
  return formatAddress(job.address as Record<string, unknown> | undefined, {
    fallback: { suburb: job.addressSuburb },
  });
}

type JobSortField =
  | 'external_reference'
  | 'status'
  | 'job_type'
  | 'assignee'
  | 'address'
  | 'request_date'
  | 'updated_at';

interface ColDef { key: JobSortField; label: string; filterable?: boolean; locked?: boolean }

const TABLE_COLUMNS: ColDef[] = [
  { key: 'external_reference', label: 'Job Ref', locked: true },
  { key: 'status', label: 'Status', filterable: true },
  { key: 'job_type', label: 'Type', filterable: true },
  { key: 'assignee', label: 'Assigned' },
  { key: 'address', label: 'Address' },
  { key: 'request_date', label: 'Requested' },
  { key: 'updated_at', label: 'Updated' },
];

export interface JobsListClientProps {
  initialData: PaginatedResponse<Job>;
  statusOptions: StatusOption[];
  jobTypes?: { id: string; name?: string }[];
  unreadJobIds?: string[];
  headerAction?: React.ReactNode;
  /** Bump to force a list refetch (e.g. after creating a job). */
  refreshNonce?: number;
  /**
   * `page` (default): full jobs list with URL sync + page header.
   * `picker`: embedded list for drawers; no URL sync / page header.
   */
  variant?: 'page' | 'picker';
  /** Highlight the current job in picker mode. */
  selectedJobId?: string;
  /** When set (picker), called instead of navigating to `/jobs/:id`. */
  onJobSelect?: (job: Job) => void;
  /** Extra class on the outer wrapper (e.g. drawer padding). */
  className?: string;
}

export function JobsListClient({
  initialData,
  statusOptions,
  jobTypes = [],
  unreadJobIds,
  headerAction,
  refreshNonce = 0,
  variant = 'page',
  selectedJobId,
  onJobSelect,
  className,
}: JobsListClientProps) {
  const isPicker = variant === 'picker';
  const router = useRouter();
  const searchParams = useSearchParams();
  const [data, setData] = useState(initialData);
  const unreadSet = useMemo(() => new Set(unreadJobIds ?? []), [unreadJobIds]);
  const [search, setSearch] = useState(() =>
    isPicker ? '' : (searchParams.get('search') ?? ''),
  );
  const [debouncedSearch, setDebouncedSearch] = useState(search);
  const [tab, setTab] = useState<ListTab>(() =>
    isPicker ? 'active' : parseTab(searchParams.get('tab')),
  );
  const [page, setPage] = useState(() => {
    if (isPicker) return 1;
    const p = parseInt(searchParams.get('page') ?? '1', 10);
    return Number.isFinite(p) && p > 0 ? p : 1;
  });
  const [columnSort, setColumnSort] = useState<{ field: JobSortField; order: 'asc' | 'desc' }>({
    field: 'updated_at',
    order: 'desc',
  });
  const [typeFilter, setTypeFilter] = useState<Set<string>>(new Set());
  const [typeFilterActive, setTypeFilterActive] = useState(false);
  const [statusFilter, setStatusFilter] = useState<Set<string>>(new Set());
  const [statusFilterActive, setStatusFilterActive] = useState(false);
  const { isVisible, toggle, visibleCount } = useColumnVisibility(
    'jobs',
    TABLE_COLUMNS,
  );

  const lastFetchKeyRef = useRef<string | null>(null);

  const typeOptions = useMemo(
    () =>
      jobTypes
        .map((t) => ({
          id: t.id,
          name: t.name?.trim() ? t.name.trim() : 'Unknown',
        }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [jobTypes],
  );

  const statusNames = useMemo(() => {
    const fromOptions = statusOptions
      .map((s) => s.name?.trim())
      .filter((n): n is string => !!n);
    return [...new Set(fromOptions)].sort((a, b) => a.localeCompare(b));
  }, [statusOptions]);

  // Unique display names for the popup (optionCount must match Set size after All)
  const typeNames = useMemo(
    () => [...new Set(typeOptions.map((t) => t.name))].sort((a, b) => a.localeCompare(b)),
    [typeOptions],
  );

  /** Status IDs implied by Active / Archived tab (undefined = All). */
  const tabStatusIds = useMemo(() => {
    if (tab === 'all') return undefined;
    const ids = statusOptions
      .filter((s) => {
        const archived = isArchivedStatus(s.name);
        return tab === 'archived' ? archived : !archived;
      })
      .map((s) => s.id);
    return ids.length > 0 ? ids.sort().join(',') : undefined;
  }, [tab, statusOptions]);

  const statusParam = useMemo(() => {
    const column = columnFilterToIdsParam(
      statusFilterActive,
      statusFilter,
      statusOptions,
    );
    if (column === null) return null;
    if (!tabStatusIds) return column;
    if (!column) return tabStatusIds;
    const tabSet = new Set(tabStatusIds.split(','));
    const intersect = column.split(',').filter((id) => tabSet.has(id));
    return intersect.length > 0 ? intersect.join(',') : null;
  }, [statusFilterActive, statusFilter, statusOptions, tabStatusIds]);

  const jobTypeParam = useMemo(
    () => columnFilterToIdsParam(typeFilterActive, typeFilter, typeOptions),
    [typeFilterActive, typeFilter, typeOptions],
  );

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  // After create (or other external refresh), jump to page 1 so the new row is visible.
  useEffect(() => {
    if (refreshNonce === 0) return;
    setPage(1);
  }, [refreshNonce]);

  const sortParam = `${columnSort.field}_${columnSort.order}`;

  // URL sync only — do not tie this to refreshNonce or a create→detail
  // navigation can race with replace('/jobs?...').
  useEffect(() => {
    if (isPicker) return;
    const params = new URLSearchParams(searchParams.toString());
    params.set('search', debouncedSearch);
    params.set('tab', tab);
    params.set('page', String(page));
    params.set('sort', sortParam);
    if (statusParam) params.set('status', statusParam);
    else params.delete('status');
    if (jobTypeParam) params.set('jobType', jobTypeParam);
    else params.delete('jobType');
    const next = params.toString();
    if (next === searchParams.toString()) return;
    router.replace(`/jobs?${next}`, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, sortParam, tab, page, statusParam, jobTypeParam, isPicker]);

  useEffect(() => {
    const statusKey = statusParam === null ? '__none__' : (statusParam ?? '');
    const typeKey = jobTypeParam === null ? '__none__' : (jobTypeParam ?? '');
    const fetchKey = `${debouncedSearch}|${sortParam}|${tab}|${page}|${statusKey}|${typeKey}|${refreshNonce}`;

    if (lastFetchKeyRef.current === fetchKey) return;
    lastFetchKeyRef.current = fetchKey;

    if (statusParam === null || jobTypeParam === null) {
      setData({ data: [], total: 0 });
      return;
    }

    let cancelled = false;
    fetchJobsAction({
      search: debouncedSearch || undefined,
      page,
      limit: PAGE_SIZE,
      sort: sortParam,
      status: statusParam,
      jobType: jobTypeParam,
    }).then((res) => {
      if (!cancelled && res) setData(res);
    });

    return () => {
      cancelled = true;
      // If this effect is cleaned up before the request lands (navigate away /
      // hide), allow the same key to refetch when the list is shown again.
      if (lastFetchKeyRef.current === fetchKey) {
        lastFetchKeyRef.current = null;
      }
    };
  }, [debouncedSearch, sortParam, tab, page, statusParam, jobTypeParam, refreshNonce]);

  const handleColumnSort = (field: JobSortField) => {
    setColumnSort((prev) => {
      if (prev.field === field) {
        return { field, order: prev.order === 'asc' ? 'desc' : 'asc' };
      }
      return { field, order: field === 'external_reference' ? 'asc' : 'desc' };
    });
    setPage(1);
  };

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
  };

  const handleSearchChange = (value: string) => {
    setSearch(value);
    setPage(1);
  };

  const handleTabChange = (val: string) => {
    setTab(val as ListTab);
    setPage(1);
  };

  const toggleType = (name: string) => {
    const working = typeFilterActive ? new Set(typeFilter) : new Set(typeNames);
    if (working.has(name)) working.delete(name);
    else working.add(name);
    const committed = commitColumnFilterSelection({
      next: working,
      optionCount: typeNames.length,
    });
    setTypeFilter(committed.selected);
    setTypeFilterActive(committed.active);
    setPage(1);
  };

  const applyStatusFilter = (next: Set<string>) => {
    const committed = commitColumnFilterSelection({
      next,
      optionCount: statusNames.length,
    });
    setStatusFilter(committed.selected);
    setStatusFilterActive(committed.active);
    setPage(1);
  };

  const applyTypeFilter = (next: Set<string>) => {
    const committed = commitColumnFilterSelection({
      next,
      optionCount: typeNames.length,
    });
    setTypeFilter(committed.selected);
    setTypeFilterActive(committed.active);
    setPage(1);
  };

  const visibleRows = useMemo(() => data.data, [data.data]);

  const breakdown = computeStatusBreakdown(visibleRows, (j) => j.status?.name);

  const statusFilterProps = {
    options: statusNames,
    selected: statusFilter,
    active: statusFilterActive,
    onApply: applyStatusFilter,
    menuTitle: 'Filter by status',
    itemNoun: { singular: 'status', plural: 'statuses' },
  };

  const typeFilterProps = {
    options: typeNames.length > 0 ? typeNames : [],
    selected: typeFilter,
    active: typeFilterActive,
    onApply: applyTypeFilter,
    menuTitle: 'Filter by type',
    itemNoun: { singular: 'type', plural: 'types' },
  };

  const handleRowClick = (job: Job) => {
    if (onJobSelect) {
      onJobSelect(job);
      return;
    }
    router.push(`/jobs/${job.id}`);
  };

  return (
    <div
      className={`flex min-h-0 flex-1 flex-col${className ? ` ${className}` : ''}`}
      style={{ height: '100%' }}
    >
      {!isPicker && (
        <SetPageHeader>
          <ListPageHeader
            icon={Briefcase}
            title="Jobs"
            total={data.total}
            showing={visibleRows.length}
            search={debouncedSearch}
            breakdown={breakdown}
            accent="emerald"
          />
        </SetPageHeader>
      )}
      <div className={`flex flex-col gap-4 pb-4 pt-1 ${isPicker ? 'px-4' : 'px-6'}`}>
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
              placeholder="Search jobs by reference or suburb..."
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
            options={typeNames}
            selected={typeFilterActive ? typeFilter : new Set(typeNames)}
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
            emptyLabel="All types"
            menuTitle="Filter by type"
            itemNoun={{ singular: 'type', plural: 'types' }}
          />

          {headerAction}
        </div>
      </div>

      <div
        className={`flex-1 pb-6 ${isPicker ? 'px-4' : 'px-6'}`}
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
                          : col.key === 'job_type'
                            ? typeFilterProps
                            : undefined
                      }
                    />
                  ))}
                  {!isPicker && (
                    <th scope="col" className={LIST_ARCHIVE_TH_CLASS}>
                      <span className="sr-only">Actions</span>
                    </th>
                  )}
                  <ColumnSettingsHeaderCell
                    columns={TABLE_COLUMNS}
                    isVisible={isVisible}
                    onToggle={toggle}
                  />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visibleRows.length === 0 ? (
                  <TableEmptyRow colSpan={visibleCount + (isPicker ? 1 : 2)} label="No jobs found." />
                ) : (
                  visibleRows.map((job) => {
                  const ref = job.name ?? job.externalJobId ?? job.externalReference ?? job.id;
                  const statusName = job.status?.name ?? 'Unknown';
                  const jobTypeName = job.jobType?.name ?? '';
                  const isUnread = unreadSet.has(job.id);
                  const isSelected = selectedJobId === job.id;
                  return (
                    <tr
                      key={job.id}
                      onClick={() => handleRowClick(job)}
                      className={`cursor-pointer transition-colors hover:bg-slate-50 ${
                        isSelected
                          ? 'bg-emerald-50 ring-1 ring-inset ring-emerald-200'
                          : isUnread
                            ? 'border-l-[3px] border-l-blue-500 bg-blue-100'
                            : ''
                      }`}
                    >
                      {isVisible('external_reference') && (
                        <td className="whitespace-nowrap px-4 py-3 font-medium text-slate-900">
                          {isUnread && !isSelected && (
                            <span className="mr-2 inline-block h-2 w-2 rounded-full bg-blue-500" />
                          )}
                          {ref}
                        </td>
                      )}
                      {isVisible('status') && (
                        <td className="whitespace-nowrap px-4 py-3">
                          <StatusBadge status={statusName} />
                        </td>
                      )}
                      {isVisible('job_type') && (
                        <td className="px-4 py-3">
                          <TypeBadge type={jobTypeName} />
                        </td>
                      )}
                      {isVisible('assignee') && (
                        <td className="px-4 py-3 text-slate-600">
                          {job.assigneeName ?? '—'}
                        </td>
                      )}
                      {isVisible('address') && (
                        <td className="px-4 py-3 text-slate-600">
                          {jobListAddress(job)}
                        </td>
                      )}
                      {isVisible('request_date') && (
                        <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                          {formatDate(job.requestDate)}
                        </td>
                      )}
                      {isVisible('updated_at') && (
                        <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                          {formatDate(job.updatedAt)}
                        </td>
                      )}
                      {!isPicker && (
                        <td
                          className={LIST_ARCHIVE_TD_CLASS}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <ListArchiveButton
                            entityType="job"
                            entityId={job.id}
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
                        </td>
                      )}
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
