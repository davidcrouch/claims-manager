'use client';

import { useEffect, useMemo, useState } from 'react';
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
import { type StatusOption,
  formatDate,
  commitColumnFilterSelection,
  columnFilterToIdsParam,
  columnFilterToValuesParam,
  columnFilterToAssigneeIdsParam,
  buildColumnFilterOptions,
  ValueFilterMenu,
  SortableColumnHeader,
  TableEmptyRow, withUniqueNamedFilterOptions } from '@/components/shared/list-filters';
import { statusIdsForArchiveListTab, isArchivedStatus, mergeStatusParamWithTab } from '@/components/shared/archive-list';
import { TablePagination } from '@/components/shared/table-pagination';
import {
  ColumnSettingsHeaderCell,
  useColumnVisibility,
} from '@/components/shared/column-visibility';
import { ListArchiveButton, LIST_ARCHIVE_TH_CLASS, LIST_ARCHIVE_TD_CLASS, LIST_ARCHIVE_SPACER_TD_CLASS } from '@/components/shared/ListArchiveButton';
import { formatAddress } from '@/components/shared/detail';
import { SyncStatusIndicator } from '@/components/shared/SyncStatusIndicator';
import { jobDisplayName, jobInsurerReference } from '@/components/shared/job-label';
import { fetchJobsAction, fetchJobFilterOptionsAction } from '@/app/(app)/jobs/actions';
import {
  buildJobsListFetchKey,
  columnFilterFromIdsParam,
  columnFilterFromValuesParam,
  DEFAULT_JOBS_SORT,
  JOBS_PAGE_SIZE,
  isJobsMineTab,
  jobArchiveStateLabel,
  parseJobsColumnSort,
  parseJobsListTab,
  columnFilterToArchiveStateStatusIds,
  type JobSortField,
  type JobsListTab,
} from '@/components/jobs/jobs-list-helpers';
import {
  createListFetchSession,
  replaceListQueryIfNeeded,
  useListPageData,
} from '@/components/shared/use-list-page-data';
import { usePersistedListTab } from '@/components/shared/list-tab-storage';
import type { Job, PaginatedResponse } from '@/types/api';

function jobListAddress(job: Job): string {
  return formatAddress(job.address as Record<string, unknown> | undefined, {
    fallback: { suburb: job.addressSuburb },
  });
}

function jobListRef(job: Job): string {
  return jobDisplayName(job);
}

interface ColDef {
  key: JobSortField;
  label: string;
  filterable?: boolean;
  locked?: boolean;
  defaultHidden?: boolean;
  sortable?: boolean;
}

const TABLE_COLUMNS: ColDef[] = [
  { key: 'external_reference', label: 'Job #', locked: true, filterable: true },
  { key: 'external_job_id', label: 'Insurer Ref', defaultHidden: true },
  { key: 'job_type', label: 'Type', filterable: true },
  { key: 'status', label: 'Status', filterable: true },
  { key: 'archive_state', label: 'State', filterable: true, sortable: false },
  { key: 'assignee', label: 'Assigned', filterable: true },
  { key: 'insured', label: 'Client / Insured', sortable: false },
  { key: 'address', label: 'Address' },
  { key: 'request_date', label: 'Requested' },
  { key: 'updated_at', label: 'Updated' },
];

export interface JobsListClientProps {
  initialData: PaginatedResponse<Job>;
  /** Skip the first client fetch when it matches SSR / picker bootstrap. */
  initialFetchKey?: string;
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
  /** Logged-in org user id — required for the My Jobs tab filter. */
  currentUserId?: string | null;
}

export function JobsListClient({
  initialData,
  initialFetchKey,
  statusOptions,
  jobTypes = [],
  unreadJobIds,
  headerAction,
  refreshNonce = 0,
  variant = 'page',
  selectedJobId,
  onJobSelect,
  className,
  currentUserId,
}: JobsListClientProps) {
  const isPicker = variant === 'picker';
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data, setData, beginFetch, abortFetch } = useListPageData(initialData, {
    initialFetchKey,
  });
  const unreadSet = useMemo(() => new Set(unreadJobIds ?? []), [unreadJobIds]);
  const initialArchiveStateFilter = useMemo(
    () =>
      isPicker
        ? { selected: new Set<string>(), active: false }
        : columnFilterFromValuesParam(searchParams.get('archiveState')),
    [isPicker, searchParams],
  );
  const initialRefFilter = useMemo(
    () =>
      isPicker
        ? { selected: new Set<string>(), active: false }
        : columnFilterFromValuesParam(searchParams.get('refs')),
    [isPicker, searchParams],
  );
  const [search, setSearch] = useState(() =>
    isPicker ? '' : (searchParams.get('search') ?? ''),
  );
  const [debouncedSearch, setDebouncedSearch] = useState(search);
  const assignedToUserId = searchParams.get('assignedToUserId');
  const legacyMineTab =
    !isPicker &&
    !!assignedToUserId &&
    !!currentUserId &&
    assignedToUserId === currentUserId;
  const [tab, setTab] = usePersistedListTab<JobsListTab>({
    storageKey: 'jobs',
    urlTab: isPicker ? null : searchParams.get('tab'),
    parse: parseJobsListTab,
    fallbackTab: legacyMineTab ? 'mine' : undefined,
    disabled: isPicker,
  });
  const [page, setPage] = useState(() => {
    if (isPicker) return 1;
    const p = parseInt(searchParams.get('page') ?? '1', 10);
    return Number.isFinite(p) && p > 0 ? p : 1;
  });
  const [columnSort, setColumnSort] = useState<{ field: JobSortField; order: 'asc' | 'desc' }>(() =>
    isPicker
      ? { field: 'updated_at', order: 'desc' }
      : parseJobsColumnSort(searchParams.get('sort')),
  );
  const [typeFilter, setTypeFilter] = useState<Set<string>>(new Set());
  const [typeFilterActive, setTypeFilterActive] = useState(false);
  const [statusFilter, setStatusFilter] = useState<Set<string>>(new Set());
  const [statusFilterActive, setStatusFilterActive] = useState(false);
  const [archiveStateFilter, setArchiveStateFilter] = useState(initialArchiveStateFilter.selected);
  const [archiveStateFilterActive, setArchiveStateFilterActive] = useState(
    initialArchiveStateFilter.active,
  );
  const [refFilter, setRefFilter] = useState(initialRefFilter.selected);
  const [refFilterActive, setRefFilterActive] = useState(initialRefFilter.active);
  const [assigneeFilter, setAssigneeFilter] = useState<Set<string>>(new Set());
  const [assigneeFilterActive, setAssigneeFilterActive] = useState(false);
  const [filtersHydrated, setFiltersHydrated] = useState(isPicker);
  const [filterOptions, setFilterOptions] = useState<{
    refs: string[];
    assignees: { id: string; name: string }[];
  }>({ refs: [], assignees: [] });

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

  const tabStatusIds = useMemo(() => {
    if (isJobsMineTab(tab)) return undefined;
    return statusIdsForArchiveListTab(tab, statusOptions);
  }, [tab, statusOptions]);

  const isMineTab = isJobsMineTab(tab);
  const showAssigneeColumn = !isMineTab;
  const showArchiveStateColumn = isMineTab;

  const listColumns = useMemo(
    () =>
      TABLE_COLUMNS.filter(
        (col) => col.key !== 'archive_state' || showArchiveStateColumn,
      ),
    [showArchiveStateColumn],
  );

  const { isVisible, toggle } = useColumnVisibility(
    'jobs-v2',
    listColumns,
  );

  const assignedToUserIdParam = useMemo(
    () => (isMineTab && currentUserId ? currentUserId : undefined),
    [isMineTab, currentUserId],
  );

  const statusColumnParam = useMemo(
    () => columnFilterToIdsParam(statusFilterActive, statusFilter, statusOptions),
    [statusFilterActive, statusFilter, statusOptions],
  );

  const archiveStateStatusParam = useMemo(
    () =>
      isMineTab
        ? columnFilterToArchiveStateStatusIds(
            archiveStateFilterActive,
            archiveStateFilter,
            statusOptions,
          )
        : undefined,
    [isMineTab, archiveStateFilterActive, archiveStateFilter, statusOptions],
  );

  const statusParam = useMemo(
    () =>
      mergeStatusParamWithTab(
        mergeStatusParamWithTab(statusColumnParam, archiveStateStatusParam),
        tabStatusIds,
      ),
    [statusColumnParam, archiveStateStatusParam, tabStatusIds],
  );

  const jobTypeParam = useMemo(
    () => columnFilterToIdsParam(typeFilterActive, typeFilter, typeOptions),
    [typeFilterActive, typeFilter, typeOptions],
  );
  const refsParam = useMemo(
    () => columnFilterToValuesParam(refFilterActive, refFilter),
    [refFilterActive, refFilter],
  );
  const assigneeFilterOptions = useMemo(
    () => withUniqueNamedFilterOptions(filterOptions.assignees),
    [filterOptions.assignees],
  );
  const assignedToUserIdsParam = useMemo(
    () =>
      isMineTab
        ? undefined
        : columnFilterToAssigneeIdsParam(
            assigneeFilterActive,
            assigneeFilter,
            assigneeFilterOptions,
          ),
    [isMineTab, assigneeFilterActive, assigneeFilter, assigneeFilterOptions],
  );

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    fetchJobFilterOptionsAction().then((opts) => {
      setFilterOptions({
        refs: opts.refs ?? [],
        assignees: opts.assignees ?? [],
      });
    });
  }, []);

  useEffect(() => {
    if (isPicker || filtersHydrated) return;

    const jobTypeParam = searchParams.get('jobType');
    const assigneeParam = searchParams.get('assignedToUserIds');

    if (jobTypeParam && typeOptions.length === 0) return;
    if (assigneeParam && filterOptions.assignees.length === 0) return;

    if (jobTypeParam) {
      const hydrated = columnFilterFromIdsParam(jobTypeParam, typeOptions);
      setTypeFilter(hydrated.selected);
      setTypeFilterActive(hydrated.active);
    }

    if (assigneeParam) {
      const hydrated = columnFilterFromIdsParam(assigneeParam, assigneeFilterOptions, {
        blankId: '__blank__',
      });
      setAssigneeFilter(hydrated.selected);
      setAssigneeFilterActive(hydrated.active);
    }

    setFiltersHydrated(true);
  }, [
    isPicker,
    filtersHydrated,
    typeOptions,
    filterOptions.assignees.length,
    assigneeFilterOptions,
    searchParams,
  ]);

  // After create (or other external refresh), jump to page 1 so the new row is visible.
  useEffect(() => {
    if (refreshNonce === 0) return;
    setPage(1);
  }, [refreshNonce]);

  const sortParam = `${columnSort.field}_${columnSort.order}`;

  const runJobsFetch = (fetchKey: string) => {
    const session = createListFetchSession({ fetchKey, beginFetch, abortFetch });
    if (!session) return undefined;

    if (
      statusParam === null ||
      jobTypeParam === null ||
      refsParam === null ||
      assignedToUserIdsParam === null ||
      (isMineTab && !currentUserId)
    ) {
      setData({ data: [], total: 0 });
      return session.cleanup;
    }

    fetchJobsAction({
      search: debouncedSearch || undefined,
      page,
      limit: JOBS_PAGE_SIZE,
      sort: sortParam,
      status: statusParam,
      jobType: jobTypeParam,
      refs: refsParam,
      assignedToUserId: assignedToUserIdParam,
      assignedToUserIds: assignedToUserIdsParam,
    }).then((res) => {
      if (!session.cancelled && res) setData(res);
    });

    return session.cleanup;
  };

  const fetchDeps = [
    debouncedSearch,
    sortParam,
    tab,
    page,
    statusParam,
    jobTypeParam,
    refsParam,
    assignedToUserIdParam,
    assignedToUserIdsParam,
    refreshNonce,
    filtersHydrated,
    isMineTab,
    currentUserId,
    beginFetch,
    abortFetch,
    setData,
  ] as const;

  const fetchKey = buildJobsListFetchKey({
    search: debouncedSearch,
    sort: sortParam,
    tab,
    page,
    status: statusParam,
    jobType: jobTypeParam,
    refs: refsParam,
    assignedToUserId: assignedToUserIdParam,
    assignedToUserIds: assignedToUserIdsParam,
    refreshNonce,
  });

  // Page list: sync URL first, then fetch once the query string has settled.
  useEffect(() => {
    if (isPicker || !filtersHydrated) return;

    const params = new URLSearchParams(searchParams.toString());
    if (debouncedSearch) params.set('search', debouncedSearch);
    else params.delete('search');
    if (tab !== 'active') params.set('tab', tab);
    else params.delete('tab');
    params.delete('assignedToUserId');
    if (page > 1) params.set('page', String(page));
    else params.delete('page');
    if (sortParam !== DEFAULT_JOBS_SORT) params.set('sort', sortParam);
    else params.delete('sort');
    if (statusParam) params.set('status', statusParam);
    else params.delete('status');
    if (jobTypeParam) params.set('jobType', jobTypeParam);
    else params.delete('jobType');
    if (refsParam) params.set('refs', refsParam);
    else params.delete('refs');
    const archiveStateValuesParam = isMineTab
      ? columnFilterToValuesParam(archiveStateFilterActive, archiveStateFilter)
      : null;
    if (archiveStateValuesParam) params.set('archiveState', archiveStateValuesParam);
    else params.delete('archiveState');
    params.delete('assignedToUserId');
    if (assignedToUserIdsParam) params.set('assignedToUserIds', assignedToUserIdsParam);
    else params.delete('assignedToUserIds');
    const next = params.toString();
    if (
      !replaceListQueryIfNeeded({
        router,
        pathname: '/jobs',
        currentQuery: searchParams.toString(),
        nextQuery: next,
      })
    ) {
      return;
    }

    return runJobsFetch(fetchKey);
  }, [...fetchDeps, isPicker, searchParams, router, fetchKey]);

  // Picker: isolated from parent-page URL churn (e.g. quotes ?status=…).
  useEffect(() => {
    if (!isPicker || !filtersHydrated) return;
    return runJobsFetch(fetchKey);
  }, [...fetchDeps, isPicker, fetchKey]);

  // Outbound create/update returns before the worker finishes; poll until sync settles.
  const hasPendingSync = data.data.some((j) => j.syncStatus === 'pending');
  useEffect(() => {
    if (!hasPendingSync || !filtersHydrated) return;
    if (
      statusParam === null ||
      jobTypeParam === null ||
      refsParam === null ||
      assignedToUserIdsParam === null ||
      (isMineTab && !currentUserId)
    ) {
      return;
    }
    const interval = setInterval(() => {
      void fetchJobsAction({
        search: debouncedSearch || undefined,
        page,
        limit: JOBS_PAGE_SIZE,
        sort: sortParam,
        status: statusParam,
        jobType: jobTypeParam,
        refs: refsParam,
        assignedToUserId: assignedToUserIdParam,
        assignedToUserIds: assignedToUserIdsParam,
      }).then((res) => {
        if (res) setData(res);
      });
    }, 2500);
    const stop = setTimeout(() => clearInterval(interval), 60_000);
    return () => {
      clearInterval(interval);
      clearTimeout(stop);
    };
  }, [
    hasPendingSync,
    filtersHydrated,
    debouncedSearch,
    page,
    sortParam,
    statusParam,
    jobTypeParam,
    refsParam,
    assignedToUserIdParam,
    assignedToUserIdsParam,
    isMineTab,
    currentUserId,
    setData,
  ]);

  const handleColumnSort = (field: JobSortField) => {
    if (field === 'archive_state') return;
    setColumnSort((prev) => {
      if (prev.field === field) {
        return { field, order: prev.order === 'asc' ? 'desc' : 'asc' };
      }
      return {
        field,
        order:
          field === 'external_reference' || field === 'external_job_id'
            ? 'asc'
            : 'desc',
      };
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
    setTab(val as JobsListTab);
    if (val === 'mine') {
      setAssigneeFilter(new Set());
      setAssigneeFilterActive(false);
    } else {
      setArchiveStateFilter(new Set());
      setArchiveStateFilterActive(false);
    }
    setPage(1);
  };

  const visibleTableColumns = useMemo(
    () =>
      listColumns.filter(
        (col) => isVisible(col.key) && (col.key !== 'assignee' || showAssigneeColumn),
      ),
    [listColumns, isVisible, showAssigneeColumn],
  );

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

  const uniqueRefs = useMemo(
    () => buildColumnFilterOptions(filterOptions.refs),
    [filterOptions.refs],
  );

  const uniqueAssignees = useMemo(
    () =>
      buildColumnFilterOptions(
        assigneeFilterOptions.map((a) => a.name),
        { alwaysIncludeBlank: true },
      ),
    [assigneeFilterOptions],
  );

  const applyRefFilter = (next: Set<string>) => {
    const committed = commitColumnFilterSelection({
      next,
      optionCount: uniqueRefs.length,
    });
    setRefFilter(committed.selected);
    setRefFilterActive(committed.active);
    setPage(1);
  };

  const applyAssigneeFilter = (next: Set<string>) => {
    const committed = commitColumnFilterSelection({
      next,
      optionCount: uniqueAssignees.length,
    });
    setAssigneeFilter(committed.selected);
    setAssigneeFilterActive(committed.active);
    setPage(1);
  };

  const visibleRows = data.data;

  const breakdown = computeStatusBreakdown(visibleRows, (j) => j.status?.name);

  const refFilterProps = {
    options: uniqueRefs,
    selected: refFilter,
    active: refFilterActive,
    onApply: applyRefFilter,
    menuTitle: 'Filter by job ref',
    itemNoun: { singular: 'job ref', plural: 'job refs' },
  };

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

  const archiveStateNames = useMemo(() => ['Active', 'Archived'], []);

  const applyArchiveStateFilter = (next: Set<string>) => {
    const committed = commitColumnFilterSelection({
      next,
      optionCount: archiveStateNames.length,
    });
    setArchiveStateFilter(committed.selected);
    setArchiveStateFilterActive(committed.active);
    setPage(1);
  };

  const archiveStateFilterProps = {
    options: archiveStateNames,
    selected: archiveStateFilter,
    active: archiveStateFilterActive,
    onApply: applyArchiveStateFilter,
    menuTitle: 'Filter by state',
    itemNoun: { singular: 'state', plural: 'states' },
  };

  const assigneeFilterProps = {
    options: uniqueAssignees,
    selected: assigneeFilter,
    active: assigneeFilterActive,
    onApply: applyAssigneeFilter,
    menuTitle: 'Filter by assignee',
    itemNoun: { singular: 'assignee', plural: 'assignees' },
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
      <div
        className={`flex flex-col gap-4 pb-4 pt-1 ${
          isPicker
            ? 'sticky top-0 z-10 border-b border-slate-200 bg-background px-4'
            : 'px-6'
        }`}
      >
        {isPicker && (
          <p className="text-sm text-slate-500">
            Showing {visibleRows.length.toLocaleString()} of {data.total.toLocaleString()} jobs
            {debouncedSearch ? (
              <>
                {' '}
                matching &ldquo;{debouncedSearch}&rdquo;
              </>
            ) : null}
          </p>
        )}
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
          <Tabs value={tab} onValueChange={handleTabChange}>
            <TabsList>
              {!isPicker && <TabsTrigger value="mine">My Jobs</TabsTrigger>}
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
              placeholder="Search by job #, insurer ref, client/insured, or address..."
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
                  {visibleTableColumns.map((col) => {
                    if (col.key === 'archive_state') {
                      return (
                        <SortableColumnHeader
                          key={col.key}
                          columnKey={col.key}
                          label={col.label}
                          activeField={null}
                          sortOrder="asc"
                          onSort={() => {}}
                          filter={archiveStateFilterProps}
                          className="cursor-default hover:text-slate-500 [&_span>svg:last-child]:hidden"
                        />
                      );
                    }
                    if (col.sortable === false) {
                      return (
                        <th key={col.key} scope="col" className="px-4 py-3">
                          {col.label}
                        </th>
                      );
                    }
                    return (
                      <SortableColumnHeader
                        key={col.key}
                        columnKey={col.key}
                        label={col.label}
                        activeField={columnSort.field}
                        sortOrder={columnSort.order}
                        onSort={handleColumnSort}
                        filter={
                          col.key === 'external_reference'
                            ? refFilterProps
                            : col.key === 'status'
                              ? statusFilterProps
                              : col.key === 'job_type'
                                ? typeFilterProps
                                : col.key === 'assignee'
                                  ? assigneeFilterProps
                                  : undefined
                        }
                      />
                    );
                  })}
                  {!isPicker && (
                    <th scope="col" className={LIST_ARCHIVE_TH_CLASS}>
                      <span className="sr-only">Actions</span>
                    </th>
                  )}
                  <ColumnSettingsHeaderCell
                    columns={listColumns}
                    isVisible={isVisible}
                    onToggle={toggle}
                  />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visibleRows.length === 0 ? (
                  <TableEmptyRow
                    colSpan={visibleTableColumns.length + (isPicker ? 1 : 2)}
                    label="No jobs found."
                  />
                ) : (
                  visibleRows.map((job) => {
                  const ref = jobListRef(job);
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
                          <span className="flex items-center gap-1.5">
                            {isUnread && !isSelected && (
                              <span className="inline-block h-2 w-2 shrink-0 rounded-full bg-blue-500" />
                            )}
                            <span>{ref}</span>
                            <SyncStatusIndicator syncStatus={job.syncStatus} compact />
                          </span>
                        </td>
                      )}
                      {isVisible('external_job_id') && (
                        <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                          {jobInsurerReference(job) || '—'}
                        </td>
                      )}
                      {isVisible('job_type') && (
                        <td className="px-4 py-3">
                          <TypeBadge type={jobTypeName} />
                        </td>
                      )}
                      {isVisible('status') && (
                        <td className="whitespace-nowrap px-4 py-3">
                          <StatusBadge status={statusName} />
                        </td>
                      )}
                      {showArchiveStateColumn && isVisible('archive_state') && (
                        <td className="whitespace-nowrap px-4 py-3">
                          <StatusBadge
                            status={jobArchiveStateLabel(job.status?.name)}
                            variant={isArchivedStatus(job.status?.name) ? 'inactive' : 'active'}
                          />
                        </td>
                      )}
                      {showAssigneeColumn && isVisible('assignee') && (
                        <td className="px-4 py-3 text-slate-600">
                          {job.assigneeName ?? '—'}
                        </td>
                      )}
                      {isVisible('insured') && (
                        <td className="px-4 py-3 text-slate-600">
                          {job.insuredName?.trim() || '—'}
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
              pageSize={JOBS_PAGE_SIZE}
              total={data.total}
              onPageChange={handlePageChange}
            />
          </div>
      </div>
    </div>
  );
}
