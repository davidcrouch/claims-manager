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
} from '@/components/shared/list-filters';
import { TablePagination } from '@/components/shared/table-pagination';

const PAGE_SIZE = 20;

type ListTab = 'active' | 'archived' | 'all';
const VALID_TABS = new Set<ListTab>(['active', 'archived', 'all']);
function parseTab(param: string | null): ListTab {
  if (param && VALID_TABS.has(param as ListTab)) return param as ListTab;
  return 'active';
}

function formatAddress(job: Job): string {
  const addr = job.address as
    | { streetNumber?: string; streetName?: string; suburb?: string }
    | undefined;
  if (addr) {
    const parts = [addr.streetNumber, addr.streetName, addr.suburb].filter(
      Boolean,
    );
    if (parts.length) return parts.join(' ');
  }
  return job.addressSuburb ?? '';
}

type JobSortField =
  | 'external_reference'
  | 'status'
  | 'job_type'
  | 'address'
  | 'request_date'
  | 'updated_at';

interface ColDef { key: JobSortField; label: string; filterable?: boolean }

const TABLE_COLUMNS: ColDef[] = [
  { key: 'external_reference', label: 'Job Ref' },
  { key: 'status', label: 'Status', filterable: true },
  { key: 'job_type', label: 'Type', filterable: true },
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
}

export function JobsListClient({
  initialData,
  statusOptions,
  jobTypes = [],
  unreadJobIds,
  headerAction,
  refreshNonce = 0,
}: JobsListClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [data, setData] = useState(initialData);
  const unreadSet = useMemo(() => new Set(unreadJobIds ?? []), [unreadJobIds]);
  const [search, setSearch] = useState(searchParams.get('search') ?? '');
  const [debouncedSearch, setDebouncedSearch] = useState(search);
  const [tab, setTab] = useState<ListTab>(() => parseTab(searchParams.get('tab')));
  const [page, setPage] = useState(() => {
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

  useEffect(() => {
    const statusKey = statusParam === null ? '__none__' : (statusParam ?? '');
    const typeKey = jobTypeParam === null ? '__none__' : (jobTypeParam ?? '');
    const fetchKey = `${debouncedSearch}|${sortParam}|${tab}|${page}|${statusKey}|${typeKey}|${refreshNonce}`;

    const params = new URLSearchParams(searchParams.toString());
    params.set('search', debouncedSearch);
    params.set('tab', tab);
    params.set('page', String(page));
    params.set('sort', sortParam);
    if (statusParam) params.set('status', statusParam);
    else params.delete('status');
    if (jobTypeParam) params.set('jobType', jobTypeParam);
    else params.delete('jobType');
    router.replace(`/jobs?${params}`, { scroll: false });

    if (lastFetchKeyRef.current === fetchKey) return;
    lastFetchKeyRef.current = fetchKey;

    if (statusParam === null || jobTypeParam === null) {
      setData({ data: [], total: 0 });
      return;
    }

    fetchJobsAction({
      search: debouncedSearch || undefined,
      page,
      limit: PAGE_SIZE,
      sort: sortParam,
      status: statusParam,
      jobType: jobTypeParam,
    }).then((res) => res && setData(res));
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  return (
    <div className="flex min-h-0 flex-1 flex-col" style={{ height: '100%' }}>
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
                          : col.key === 'job_type'
                            ? typeFilterProps
                            : undefined
                      }
                    />
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visibleRows.map((job) => {
                  const ref = job.name ?? job.externalJobId ?? job.externalReference ?? job.id;
                  const statusName = job.status?.name ?? 'Unknown';
                  const jobTypeName = job.jobType?.name ?? '';
                  const isUnread = unreadSet.has(job.id);
                  return (
                    <tr
                      key={job.id}
                      onClick={() => router.push(`/jobs/${job.id}`)}
                      className={`cursor-pointer transition-colors hover:bg-slate-50 ${
                        isUnread
                          ? 'border-l-[3px] border-l-blue-500 bg-blue-100'
                          : ''
                      }`}
                    >
                      <td className="whitespace-nowrap px-4 py-3 font-medium text-slate-900">
                        {isUnread && (
                          <span className="mr-2 inline-block h-2 w-2 rounded-full bg-blue-500" />
                        )}
                        {ref}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <StatusBadge status={statusName} />
                      </td>
                      <td className="px-4 py-3">
                        <TypeBadge type={jobTypeName} />
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {formatAddress(job)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                        {formatDate(job.requestDate)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                        {formatDate(job.updatedAt)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <TablePagination
              page={page}
              pageSize={PAGE_SIZE}
              total={data.total}
              onPageChange={handlePageChange}
            />
          </div>
        ) : (
          <div className="flex h-64 items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50">
            <div className="flex flex-col items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-slate-100">
                <Search size={24} className="text-slate-400" />
              </div>
              <p className="text-sm text-slate-400">No jobs found.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
