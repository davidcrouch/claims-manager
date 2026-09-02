'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ClipboardCheck, PackagePlus, Search, X } from 'lucide-react';
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
  columnFilterToAssigneeIdsParam,
  columnFilterToValuesParam,
  buildColumnFilterOptions,
  ValueFilterMenu,
  SortableColumnHeader,
  TableEmptyRow,
  withUniqueNamedFilterOptions,
} from '@/components/shared/list-filters';
import { statusIdsForArchiveListTab, mergeStatusParamWithTab, isArchivedStatus } from '@/components/shared/archive-list';
import {
  archiveStateLabel,
  columnFilterToArchiveStateStatusIds,
} from '@/components/shared/list-mine-tab';
import { columnFilterFromValuesParam } from '@/components/jobs/jobs-list-helpers';
import {
  isWorkOrdersMineTab,
  parseWorkOrdersListTab,
  type WorkOrdersListTab,
} from '@/components/work-orders/work-orders-list-helpers';
import { jobDisplayName } from '@/components/shared/job-label';
import { JobCellLink } from '@/components/shared/JobCellLink';
import { buildServerJobFilterOptions,
  resolveServerJobFilterSelection,
  selectedJobFilterLabels,
  parseSelectedJobIds,
  toServerJobFetchParams,
  writeServerJobFilterParams,
  syncServerJobFilterParams,
  buildListJobFilterOptions } from '@/components/shared/server-job-filter';
import {
  createListFetchSession,
  replaceListQueryIfNeeded,
  useListPageData } from '@/components/shared/use-list-page-data';
import {
  ARCHIVE_ONLY_LIST_TABS,
  usePersistedListTab,
} from '@/components/shared/list-tab-storage';
import { SetPageHeader } from '@/components/layout/SetPageHeader';
import {
  EntityPageHeader,
} from '@/components/shared/EntityPageHeader';
import { computeStatusBreakdown } from '@/components/layout/ListPageHeader';
import { CapturePoDrawer } from '@/components/forms/CapturePoDrawer';
import {
  fetchWorkOrdersAction,
  fetchWorkOrderFilterAssigneesAction,
} from '@/app/(app)/work-orders/actions';
import { entityDisplayLabel } from '@/components/shared/entity-label';
import { workOrderInsurerPo } from '@/components/work-orders/work-order-label';
import {
  ColumnSettingsHeaderCell,
  useColumnVisibility } from '@/components/shared/column-visibility';
import { ListArchiveButton, LIST_ARCHIVE_TH_CLASS, LIST_ARCHIVE_TD_CLASS, LIST_ARCHIVE_SPACER_TD_CLASS } from '@/components/shared/ListArchiveButton';
import { TablePagination } from '@/components/shared/table-pagination';
import type { WorkOrder, PaginatedResponse, Job, Claim } from '@/types/api';

const PAGE_SIZE = 20;

type ListTab = WorkOrdersListTab;

function formatAmount(value?: string | null): string {
  if (!value) return '';
  const n = Number(value);
  if (Number.isNaN(n)) return value;
  return n.toLocaleString('en-AU', {
    style: 'currency',
    currency: 'AUD',
    maximumFractionDigits: 2 });
}

type WOSortField =
  | 'name'
  | 'insurer_po'
  | 'job'
  | 'assignee'
  | 'archive_state'
  | 'status'
  | 'wo_type'
  | 'source'
  | 'total_amount'
  | 'start_date'
  | 'updated_at';

interface ColDef {
  key: WOSortField;
  label: string;
  filterable?: boolean;
  locked?: boolean;
  sortable?: boolean;
}

const TABLE_COLUMNS: ColDef[] = [
  { key: 'name', label: 'Work Order #', locked: true },
  { key: 'insurer_po', label: 'Insurer PO' },
  { key: 'job', label: 'Job', filterable: true },
  { key: 'assignee', label: 'Assigned', filterable: true },
  { key: 'status', label: 'Status', filterable: true },
  { key: 'archive_state', label: 'State', filterable: true, sortable: false },
  { key: 'wo_type', label: 'Type', filterable: true },
  { key: 'source', label: 'From (upstream)' },
  { key: 'total_amount', label: 'Total' },
  { key: 'start_date', label: 'Start' },
  { key: 'updated_at', label: 'Updated' },
];

export interface WorkOrdersListClientProps {
  initialData: PaginatedResponse<WorkOrder>;
  statusOptions: StatusOption[];
  workOrderTypes: StatusOption[];
  jobNameById?: Record<string, string>;
  jobTypeById?: Record<string, string>;
  /** When provided, the page header shows job details and data is scoped to this job. */
  job?: Job | null;
  parentClaim?: Claim | null;
  currentUserId?: string | null;
}

export function WorkOrdersListClient({
  initialData,
  statusOptions,
  workOrderTypes,
  jobNameById,
  jobTypeById,
  job,
  parentClaim,
  currentUserId,
}: WorkOrdersListClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const jobId = searchParams.get('jobId') ?? undefined;
  const jobIdsParam = searchParams.get('jobIds') ?? undefined;
  const { data, setData, beginFetch, abortFetch } = useListPageData(initialData);
  const [search, setSearch] = useState(searchParams.get('search') ?? '');
  const [debouncedSearch, setDebouncedSearch] = useState(search);
  const assignedToUserId = searchParams.get('assignedToUserId');
  const legacyMineTab =
    !job &&
    !!assignedToUserId &&
    !!currentUserId &&
    assignedToUserId === currentUserId;
  const [tab, setTab] = usePersistedListTab<ListTab>({
    storageKey: 'work-orders',
    urlTab: searchParams.get('tab'),
    parse: parseWorkOrdersListTab,
    fallbackTab: legacyMineTab ? 'mine' : undefined,
    allowedTabs: job ? ARCHIVE_ONLY_LIST_TABS : undefined,
  });
  const [page, setPage] = useState(() => {
    const p = parseInt(searchParams.get('page') ?? '1', 10);
    return Number.isFinite(p) && p > 0 ? p : 1;
  });
  const [columnSort, setColumnSort] = useState<{ field: WOSortField; order: 'asc' | 'desc' }>({
    field: 'updated_at',
    order: 'desc' });
  const [typeFilter, setTypeFilter] = useState<Set<string>>(new Set());
  const [typeFilterActive, setTypeFilterActive] = useState(false);
  const [statusFilter, setStatusFilter] = useState<Set<string>>(new Set());
  const [statusFilterActive, setStatusFilterActive] = useState(false);
  const [assigneeFilter, setAssigneeFilter] = useState<Set<string>>(new Set());
  const [assigneeFilterActive, setAssigneeFilterActive] = useState(false);
  const [archiveStateFilter, setArchiveStateFilter] = useState<Set<string>>(() =>
    columnFilterFromValuesParam(searchParams.get('archiveState')).selected,
  );
  const [archiveStateFilterActive, setArchiveStateFilterActive] = useState(
    () => columnFilterFromValuesParam(searchParams.get('archiveState')).active,
  );
  const [assigneeOptions, setAssigneeOptions] = useState<
    { id: string; name: string }[]
  >([]);
  const [captureDrawerOpen, setCaptureDrawerOpen] = useState(false);

  const isMineTab = isWorkOrdersMineTab(tab);
  const showAssigneeColumn = !isMineTab;
  const showArchiveStateColumn = isMineTab;

  const listColumns = useMemo(
    () =>
      TABLE_COLUMNS.filter(
        (col) =>
          (col.key !== 'assignee' || showAssigneeColumn) &&
          (col.key !== 'archive_state' || showArchiveStateColumn),
      ),
    [showAssigneeColumn, showArchiveStateColumn],
  );
  const { isVisible, toggle, visibleCount } = useColumnVisibility(
    'work-orders-v3',
    listColumns,
  );

  const selectedJobIds = useMemo(
    () => parseSelectedJobIds(jobId, jobIdsParam),
    [jobId, jobIdsParam],
  );
  const filterJobs = useMemo(
    () =>
      buildListJobFilterOptions({
        jobNameById,
        currentJob: job
          ? { id: job.id, label: jobDisplayName(job) }
          : null,
        jobId }),
    [jobNameById, job, jobId],
  );
  const uniqueJobs = useMemo(
    () => buildServerJobFilterOptions(filterJobs),
    [filterJobs],
  );
  const { selected: jobFilter, active: jobFilterActive } = useMemo(
    () =>
      selectedJobFilterLabels({
        jobId,
        jobIds: jobIdsParam
          ? jobIdsParam.split(',').map((id) => id.trim()).filter(Boolean)
          : undefined,
        jobs: filterJobs }),
    [jobId, jobIdsParam, filterJobs],
  );
  const { jobId: fetchJobId, jobIds: fetchJobIds } = useMemo(
    () => toServerJobFetchParams(selectedJobIds),
    [selectedJobIds],
  );
  const tabStatusIds = useMemo(() => {
    if (isWorkOrdersMineTab(tab)) return undefined;
    return statusIdsForArchiveListTab(tab, statusOptions);
  }, [tab, statusOptions]);

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
  const workOrderTypeParam = useMemo(
    () => columnFilterToIdsParam(typeFilterActive, typeFilter, workOrderTypes),
    [typeFilterActive, typeFilter, workOrderTypes],
  );
  const assigneeFilterOptions = useMemo(
    () => withUniqueNamedFilterOptions(assigneeOptions),
    [assigneeOptions],
  );
  const assignedToUserIdParam = useMemo(
    () => (isMineTab && currentUserId ? currentUserId : undefined),
    [isMineTab, currentUserId],
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
    fetchWorkOrderFilterAssigneesAction().then(setAssigneeOptions);
  }, []);

  const sortParam = `${columnSort.field}_${columnSort.order}`;

  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());
    if (debouncedSearch) params.set('search', debouncedSearch);
    else params.delete('search');
    if (tab !== 'active') params.set('tab', tab);
    else params.delete('tab');
    if (page > 1) params.set('page', String(page));
    else params.delete('page');
    if (sortParam !== 'updated_at_desc') params.set('sort', sortParam);
    else params.delete('sort');
    if (statusParam) params.set('status', statusParam); else params.delete('status');
    if (workOrderTypeParam) params.set('workOrderType', workOrderTypeParam); else params.delete('workOrderType');
    if (assignedToUserIdsParam) params.set('assignedToUserIds', assignedToUserIdsParam);
    else params.delete('assignedToUserIds');
    params.delete('assignedToUserId');
    const archiveStateValuesParam = isMineTab
      ? columnFilterToValuesParam(archiveStateFilterActive, archiveStateFilter)
      : null;
    if (archiveStateValuesParam) params.set('archiveState', archiveStateValuesParam);
    else params.delete('archiveState');
    syncServerJobFilterParams(params, jobId, jobIdsParam);
    const next = params.toString();
    replaceListQueryIfNeeded({
      router,
      pathname: '/work-orders',
      currentQuery: searchParams.toString(),
      nextQuery: next,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- searchParams excluded to avoid infinite loop
  }, [
    debouncedSearch,
    sortParam,
    tab,
    page,
    statusParam,
    workOrderTypeParam,
    assignedToUserIdParam,
    assignedToUserIdsParam,
    isMineTab,
    archiveStateFilterActive,
    archiveStateFilter,
    jobId,
    jobIdsParam,
    searchParams,
    router,
  ]);

  useEffect(() => {
    const statusKey = statusParam === null ? '__none__' : (statusParam ?? '');
    const typeKey = workOrderTypeParam === null ? '__none__' : (workOrderTypeParam ?? '');
    const assigneesKey =
      assignedToUserIdsParam === null ? '__none__' : (assignedToUserIdsParam ?? '');
    const assigneeKey = assignedToUserIdParam ?? '';
    const fetchKey = `${debouncedSearch}|${sortParam}|${tab}|${page}|${statusKey}|${typeKey}|${assigneeKey}|${assigneesKey}|${jobId ?? ''}|${jobIdsParam ?? ''}`;

    const session = createListFetchSession({ fetchKey, beginFetch, abortFetch });
    if (!session) return;

    if (
      statusParam === null ||
      workOrderTypeParam === null ||
      assignedToUserIdsParam === null ||
      (isMineTab && !currentUserId)
    ) {
      setData({ data: [], total: 0 });
      return session.cleanup;
    }

    fetchWorkOrdersAction({
      page,
      limit: PAGE_SIZE,
      sort: sortParam,
      status: statusParam,
      workOrderType: workOrderTypeParam,
      assignedToUserId: assignedToUserIdParam,
      assignedToUserIds: assignedToUserIdsParam,
      jobId: fetchJobId,
      jobIds: fetchJobIds,
      search: debouncedSearch || undefined,
    }).then((res) => {
      if (!session.cancelled && res) setData(res);
    });
    return session.cleanup;
  }, [
    debouncedSearch,
    sortParam,
    tab,
    page,
    statusParam,
    workOrderTypeParam,
    assignedToUserIdParam,
    assignedToUserIdsParam,
    isMineTab,
    currentUserId,
    archiveStateFilterActive,
    archiveStateFilter,
    jobId,
    jobIdsParam,
    fetchJobId,
    fetchJobIds,
    searchParams,
    beginFetch,
    abortFetch,
  ]);

  const handleColumnSort = (field: WOSortField) => {
    if (field === 'archive_state') return;
    setColumnSort((prev) => {
      if (prev.field === field) {
        return { field, order: prev.order === 'asc' ? 'desc' : 'asc' };
      }
      return {
        field,
        order: field === 'name' || field === 'insurer_po' ? 'asc' : 'desc',
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
    setTab(val as ListTab);
    if (val === 'mine') {
      setAssigneeFilter(new Set());
      setAssigneeFilterActive(false);
    } else {
      setArchiveStateFilter(new Set());
      setArchiveStateFilterActive(false);
    }
    setPage(1);
  };

  const uniqueTypes = useMemo(
    () => [...new Set(workOrderTypes.map((type) => type.name.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [workOrderTypes],
  );

  const uniqueAssignees = useMemo(
    () =>
      buildColumnFilterOptions(
        assigneeFilterOptions.map((a) => a.name),
        { alwaysIncludeBlank: true },
      ),
    [assigneeFilterOptions],
  );

  const uniqueStatuses = useMemo(() => {
    const fromOptions = statusOptions
      .map((s) => s.name?.trim())
      .filter((n): n is string => !!n);
    if (fromOptions.length > 0) {
      return [...new Set(fromOptions)].sort((a, b) => a.localeCompare(b));
    }
    const names = new Set<string>();
    for (const wo of data.data) {
      const name = wo.status?.name?.trim();
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
      optionCount: uniqueTypes.length });
    setTypeFilter(committed.selected);
    setTypeFilterActive(committed.active);
    setPage(1);
  };

  const applyStatusFilter = (next: Set<string>) => {
    const committed = commitColumnFilterSelection({
      next,
      optionCount: uniqueStatuses.length });
    setStatusFilter(committed.selected);
    setStatusFilterActive(committed.active);
    setPage(1);
  };

  const applyTypeFilter = (next: Set<string>) => {
    const committed = commitColumnFilterSelection({
      next,
      optionCount: uniqueTypes.length });
    setTypeFilter(committed.selected);
    setTypeFilterActive(committed.active);
    setPage(1);
  };

  const applyJobFilter = (next: Set<string>) => {
    const resolved = resolveServerJobFilterSelection({
      next,
      options: uniqueJobs,
      jobs: filterJobs });
    setPage(1);
    const params = new URLSearchParams(searchParams.toString());
    writeServerJobFilterParams(params, resolved);
    params.set('page', '1');
    router.replace(`/work-orders?${params.toString()}`, { scroll: false });
  };

  const applyAssigneeFilter = (next: Set<string>) => {
    const committed = commitColumnFilterSelection({
      next,
      optionCount: uniqueAssignees.length });
    setAssigneeFilter(committed.selected);
    setAssigneeFilterActive(committed.active);
    setPage(1);
  };

  const applyArchiveStateFilter = (next: Set<string>) => {
    const committed = commitColumnFilterSelection({
      next,
      optionCount: 2,
    });
    setArchiveStateFilter(committed.selected);
    setArchiveStateFilterActive(committed.active);
    setPage(1);
  };

  const statusFilterProps = {
    options: uniqueStatuses,
    selected: statusFilter,
    active: statusFilterActive,
    onApply: applyStatusFilter,
    menuTitle: 'Filter by status',
    itemNoun: { singular: 'status', plural: 'statuses' } };

  const typeFilterProps = {
    options: uniqueTypes,
    selected: typeFilter,
    active: typeFilterActive,
    onApply: applyTypeFilter,
    menuTitle: 'Filter by type',
    itemNoun: { singular: 'type', plural: 'types' } };

  const jobFilterProps = {
    options: uniqueJobs,
    selected: jobFilterActive ? jobFilter : new Set(uniqueJobs),
    active: jobFilterActive,
    onApply: applyJobFilter,
    menuTitle: 'Filter by job',
    itemNoun: { singular: 'job', plural: 'jobs' } };

  const assigneeFilterProps = {
    options: uniqueAssignees,
    selected: assigneeFilter,
    active: assigneeFilterActive,
    onApply: applyAssigneeFilter,
    menuTitle: 'Filter by assignee',
    itemNoun: { singular: 'assignee', plural: 'assignees' },
  };

  const archiveStateFilterProps = {
    options: ['Active', 'Archived'],
    selected: archiveStateFilter,
    active: archiveStateFilterActive,
    onApply: applyArchiveStateFilter,
    menuTitle: 'Filter by state',
    itemNoun: { singular: 'state', plural: 'states' },
  };

  const visibleRows = data.data;

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
      maximumFractionDigits: 0 });
  }, [visibleRows]);

  const visibleColumns = listColumns.filter((col) => isVisible(col.key));

  return (
    <div className="flex min-h-0 flex-1 flex-col" style={{ height: '100%' }}>
      <SetPageHeader>
        <EntityPageHeader
          icon={ClipboardCheck}
          title="Work Orders"
          total={data.total}
          showing={visibleRows.length}
          search={debouncedSearch}
          breakdown={breakdown}
          stats={totalValue ? [{ label: 'Total value', value: totalValue }] : undefined}
          accent="indigo"
          job={job}
          parentClaim={parentClaim}
        />
      </SetPageHeader>
      <div className="flex flex-col gap-4 px-6 pb-4 pt-1">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
          <Tabs value={tab} onValueChange={handleTabChange}>
            <TabsList>
              {!job && <TabsTrigger value="mine">My WOs</TabsTrigger>}
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
              placeholder="Search work orders by WO #, insurer PO or name..."
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
            emptyLabel="All types"
            menuTitle="Filter by type"
            itemNoun={{ singular: 'type', plural: 'types' }}
          />

          <Button
            variant="outline"
            size="sm"
            onClick={() => setCaptureDrawerOpen(true)}
            className="ml-auto shrink-0"
          >
            <PackagePlus className="mr-2 h-4 w-4" />
            Capture External PO
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
                  {visibleColumns.map((col) => {
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
                    return (
                      <SortableColumnHeader
                        key={col.key}
                        columnKey={col.key}
                        label={col.label}
                        activeField={columnSort.field}
                        sortOrder={columnSort.order}
                        onSort={handleColumnSort}
                        className={col.key === 'insurer_po' ? 'text-center' : undefined}
                        filter={
                          col.key === 'job'
                            ? jobFilterProps
                            : col.key === 'assignee'
                              ? assigneeFilterProps
                              : col.key === 'status'
                                ? statusFilterProps
                                : col.key === 'wo_type'
                                  ? typeFilterProps
                                  : undefined
                        }
                      />
                    );
                  })}
                  <th scope="col" className={LIST_ARCHIVE_TH_CLASS}>
                    <span className="sr-only">Actions</span>
                  </th>
                  <ColumnSettingsHeaderCell
                    columns={listColumns}
                    isVisible={isVisible}
                    onToggle={toggle}
                  />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visibleRows.length === 0 ? (
                  <TableEmptyRow colSpan={visibleCount + 2} label="No work orders found." />
                ) : (
                  visibleRows.map((wo) => {
                  const displayName = entityDisplayLabel(
                    wo.internalNumber,
                    wo.name,
                    wo.workOrderNumber,
                    wo.externalId,
                    wo.id,
                  );
                  const statusName = wo.status?.name ?? 'Unknown';
                  const woType = wo.workOrderType?.name ?? '';
                  const source = wo.sourceExternalReference ?? '';
                  return (
                    <tr
                      key={wo.id}
                      onClick={() => {
                        const scopedJobId = searchParams.get('jobId');
                        const href = scopedJobId
                          ? `/work-orders/${wo.id}?jobId=${scopedJobId}`
                          : `/work-orders/${wo.id}`;
                        router.push(href);
                      }}
                      className="cursor-pointer transition-colors hover:bg-slate-50"
                    >
                      {isVisible('name') && (
                        <td className="whitespace-nowrap px-4 py-3 font-medium text-slate-900">
                          {displayName}
                        </td>
                      )}
                      {isVisible('insurer_po') && (
                        <td className="whitespace-nowrap px-4 py-3 text-center text-slate-600">
                          {workOrderInsurerPo(wo) ?? '—'}
                        </td>
                      )}
                      {isVisible('job') && (
                        <td className="px-4 py-3 text-slate-600">
                          <JobCellLink jobId={wo.jobId} jobNameById={jobNameById} jobTypeById={jobTypeById} />
                        </td>
                      )}
                      {showAssigneeColumn && isVisible('assignee') && (
                        <td className="px-4 py-3 text-slate-600">
                          {wo.assigneeName?.trim() || '—'}
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
                            status={archiveStateLabel(statusName)}
                            variant={isArchivedStatus(statusName) ? 'inactive' : 'active'}
                          />
                        </td>
                      )}
                      {isVisible('wo_type') && (
                        <td className="px-4 py-3">
                          <TypeBadge type={woType} />
                        </td>
                      )}
                      {isVisible('source') && (
                        <td className="px-4 py-3 text-slate-600">
                          <span className="flex items-center gap-1.5">
                            {source}
                            {wo.sourceOrganisationId && (
                              <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700 ring-1 ring-inset ring-amber-600/20">
                                External
                              </span>
                            )}
                          </span>
                        </td>
                      )}
                      {isVisible('total_amount') && (
                        <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                          {formatAmount(wo.totalAmount)}
                        </td>
                      )}
                      {isVisible('start_date') && (
                        <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                          {formatDate(wo.startDate)}
                        </td>
                      )}
                      {isVisible('updated_at') && (
                        <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                          {formatDate(wo.updatedAt)}
                        </td>
                      )}
                      <td
                        className={LIST_ARCHIVE_TD_CLASS}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <ListArchiveButton
                          entityType="work_order"
                          entityId={wo.id}
                          statusName={statusName}
                          entityLabel={displayName}
                          onArchived={(id) => {
                            setData((prev) => ({
                              ...prev,
                              data: prev.data.filter((row) => row.id !== id),
                              total: Math.max(0, prev.total - 1) }));
                          }}
                        />
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

      <CapturePoDrawer
        open={captureDrawerOpen}
        onOpenChange={setCaptureDrawerOpen}
      />
    </div>
  );
}
