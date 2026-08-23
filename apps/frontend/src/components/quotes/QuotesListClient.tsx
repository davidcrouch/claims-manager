'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { FileSpreadsheet, Search, X } from 'lucide-react';
import { fetchQuotesAction, fetchQuoteFilterAssigneesAction } from '@/app/(app)/quotes/actions';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { type StatusOption,
  commitColumnFilterSelection,
  columnFilterToIdsParam,
  columnFilterToAssigneeIdsParam,
  statusIdsForArchiveListTab,
  mergeStatusParamWithTab,
  buildColumnFilterOptions,
  ValueFilterMenu, withUniqueNamedFilterOptions } from '@/components/shared/list-filters';
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
import { SetPageHeader } from '@/components/layout/SetPageHeader';
import {
  EntityPageHeader } from '@/components/shared/EntityPageHeader';
import { computeStatusBreakdown } from '@/components/layout/ListPageHeader';
import { TablePagination } from '@/components/shared/table-pagination';
import { QuotesTable, type QuoteSortField } from './QuotesTable';
import { jobDisplayName } from '@/components/shared/job-label';
import type { Quote, PaginatedResponse, Job, Claim } from '@/types/api';

type ListTab = 'active' | 'archived' | 'all';
const VALID_TABS = new Set<ListTab>(['active', 'archived', 'all']);
function parseTab(param: string | null): ListTab {
  if (param && VALID_TABS.has(param as ListTab)) return param as ListTab;
  return 'active';
}

export interface QuotesListClientProps {
  initialData: PaginatedResponse<Quote>;
  statusOptions: StatusOption[];
  quoteTypes: StatusOption[];
  jobNameById?: Record<string, string>;
  jobAssigneeNameById?: Record<string, string>;
  /** When provided, the page header shows job details and data is scoped to this job. */
  job?: Job | null;
  parentClaim?: Claim | null;
}

const PAGE_SIZE = 20;

export function QuotesListClient({
  initialData,
  statusOptions,
  quoteTypes,
  jobNameById,
  jobAssigneeNameById,
  job,
  parentClaim }: QuotesListClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const jobId = searchParams.get('jobId') ?? undefined;
  const jobIdsParam = searchParams.get('jobIds') ?? undefined;
  const { data, setData, beginFetch, abortFetch } = useListPageData(initialData);

  const [search, setSearch] = useState(searchParams.get('search') ?? '');
  const [debouncedSearch, setDebouncedSearch] = useState(search);
  const [tab, setTab] = useState<ListTab>(() => parseTab(searchParams.get('tab')));
  const [page, setPage] = useState(() => {
    const p = parseInt(searchParams.get('page') ?? '1', 10);
    return Number.isFinite(p) && p > 0 ? p : 1;
  });
  const [columnSort, setColumnSort] = useState<{ field: QuoteSortField; order: 'asc' | 'desc' }>({
    field: 'updated_at',
    order: 'desc' });
  const [typeFilter, setTypeFilter] = useState<Set<string>>(new Set());
  const [typeFilterActive, setTypeFilterActive] = useState(false);
  const [statusFilter, setStatusFilter] = useState<Set<string>>(new Set());
  const [statusFilterActive, setStatusFilterActive] = useState(false);
  const [assigneeFilter, setAssigneeFilter] = useState<Set<string>>(new Set());
  const [assigneeFilterActive, setAssigneeFilterActive] = useState(false);
  const [assigneeOptions, setAssigneeOptions] = useState<
    { id: string; name: string }[]
  >([]);

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
  const quoteTypeParam = useMemo(
    () => columnFilterToIdsParam(typeFilterActive, typeFilter, quoteTypes),
    [typeFilterActive, typeFilter, quoteTypes],
  );
  const assigneeFilterOptions = useMemo(
    () => withUniqueNamedFilterOptions(assigneeOptions),
    [assigneeOptions],
  );
  const assignedToUserIdsParam = useMemo(
    () =>
      columnFilterToAssigneeIdsParam(
        assigneeFilterActive,
        assigneeFilter,
        assigneeFilterOptions,
      ),
    [assigneeFilterActive, assigneeFilter, assigneeFilterOptions],
  );

  const sortParam = `${columnSort.field}_${columnSort.order}`;

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    fetchQuoteFilterAssigneesAction().then(setAssigneeOptions);
  }, []);

  // URL sync — skip no-op replace so a create→detail router.push is not cancelled
  // when the list remounts after the create server action refreshes the page.
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
    if (statusParam) params.set('status', statusParam);
    else params.delete('status');
    if (quoteTypeParam) params.set('quoteType', quoteTypeParam);
    else params.delete('quoteType');
    if (assignedToUserIdsParam) params.set('assignedToUserIds', assignedToUserIdsParam);
    else params.delete('assignedToUserIds');
    syncServerJobFilterParams(params, jobId, jobIdsParam);
    const next = params.toString();
    replaceListQueryIfNeeded({
      router,
      pathname: '/quotes',
      currentQuery: searchParams.toString(),
      nextQuery: next,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- searchParams excluded to avoid infinite loop: router.replace updates URL -> searchParams changes -> effect re-runs
  }, [
    debouncedSearch,
    sortParam,
    tab,
    page,
    statusParam,
    quoteTypeParam,
    assignedToUserIdsParam,
    jobId,
    jobIdsParam,
    searchParams,
    router,
  ]);

  useEffect(() => {
    const statusKey = statusParam === null ? '__none__' : (statusParam ?? '');
    const typeKey = quoteTypeParam === null ? '__none__' : (quoteTypeParam ?? '');
    const assigneesKey =
      assignedToUserIdsParam === null ? '__none__' : (assignedToUserIdsParam ?? '');
    const fetchKey = `${debouncedSearch}|${sortParam}|${tab}|${page}|${statusKey}|${typeKey}|${assigneesKey}|${jobId ?? ''}|${jobIdsParam ?? ''}`;
    const session = createListFetchSession({ fetchKey, beginFetch, abortFetch });
    if (!session) return;
    if (
      statusParam === null ||
      quoteTypeParam === null ||
      assignedToUserIdsParam === null
    ) {
      setData({ data: [], total: 0 });
      return session.cleanup;
    }
    fetchQuotesAction({
      page,
      limit: PAGE_SIZE,
      sort: sortParam,
      status: statusParam,
      quoteType: quoteTypeParam,
      assignedToUserIds: assignedToUserIdsParam,
      jobId: fetchJobId,
      jobIds: fetchJobIds,
      search: debouncedSearch || undefined }).then((res) => {
      if (!session.cancelled && res) setData(res);
    });
    return session.cleanup;
  }, [
    debouncedSearch,
    sortParam,
    tab,
    page,
    statusParam,
    quoteTypeParam,
    assignedToUserIdsParam,
    jobId,
    jobIdsParam,
    fetchJobId,
    fetchJobIds,
    searchParams,
    beginFetch,
    abortFetch,
  ]);

  const handleColumnSort = (field: QuoteSortField) => {
    setColumnSort((prev) => {
      if (prev.field === field) {
        return { field, order: prev.order === 'asc' ? 'desc' : 'asc' };
      }
      return { field, order: field === 'quote_number' ? 'asc' : 'desc' };
    });
    setPage(1);
    setPage(1);
  };

  const handlePageChange = (newPage: number) => setPage(newPage);
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => { setSearch(e.target.value); setPage(1); };
  const handleTabChange = (val: string) => { setTab(val as ListTab); setPage(1); };

  const uniqueTypes = useMemo(
    () => [...new Set(quoteTypes.map((type) => type.name.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [quoteTypes],
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
    for (const q of data.data) {
      const name = q.status?.name?.trim();
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
    router.replace(`/quotes?${params.toString()}`, { scroll: false });
  };

  const applyAssigneeFilter = (next: Set<string>) => {
    const committed = commitColumnFilterSelection({
      next,
      optionCount: uniqueAssignees.length });
    setAssigneeFilter(committed.selected);
    setAssigneeFilterActive(committed.active);
    setPage(1);
  };

  const visibleRows = data.data;

  const breakdown = computeStatusBreakdown(visibleRows, (q) => q.status?.name);
  const totalValue = useMemo(() => {
    const sum = visibleRows.reduce((acc, q) => {
      const n = Number(q.totalAmount);
      return Number.isFinite(n) ? acc + n : acc;
    }, 0);
    if (sum === 0) return null;
    return sum.toLocaleString('en-AU', {
      style: 'currency',
      currency: 'AUD',
      maximumFractionDigits: 0 });
  }, [visibleRows]);

  return (
    <div className="flex min-h-0 flex-1 flex-col" style={{ height: '100%' }}>
      <SetPageHeader>
        <EntityPageHeader
          icon={FileSpreadsheet}
          title="Estimates"
          total={data.total}
          showing={visibleRows.length}
          search={debouncedSearch}
          breakdown={breakdown}
          stats={totalValue ? [{ label: 'Total value', value: totalValue }] : undefined}
          accent="amber"
          job={job}
          parentClaim={parentClaim}
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
              placeholder="Search estimates by estimate # or reference..."
              value={search}
              onChange={handleSearchChange}
              className="h-10 w-full pl-9 pr-9"
            />
            {search && (
              <button
                type="button"
                onClick={() => { setSearch(''); setPage(1); }}
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
            emptyLabel="All estimate types"
            menuTitle="Filter by estimate type"
            itemNoun={{ singular: 'type', plural: 'types' }}
          />
        </div>
      </div>

      <div
        className="flex-1 px-6 pb-6"
        style={{ minHeight: 0, overflow: 'auto' }}
      >
        <>
          <QuotesTable
            quotes={visibleRows}
            jobNameById={jobNameById}
            jobAssigneeNameById={jobAssigneeNameById}
            onRowClick={(q) => {
              const jobId = searchParams.get('jobId');
              const href = jobId ? `/quotes/${q.id}?jobId=${jobId}` : `/quotes/${q.id}`;
              router.push(href);
            }}
            onArchived={(id) => {
              setData((prev) => ({
                ...prev,
                data: prev.data.filter((row) => row.id !== id),
                total: Math.max(0, prev.total - 1) }));
            }}
            sortField={columnSort.field}
            sortOrder={columnSort.order}
            onSort={handleColumnSort}
            statusColumnFilter={{
              options: uniqueStatuses,
              selected: statusFilter,
              active: statusFilterActive,
              onApply: applyStatusFilter,
              menuTitle: 'Filter by status',
              itemNoun: { singular: 'status', plural: 'statuses' } }}
            jobColumnFilter={{
              options: uniqueJobs,
              selected: jobFilterActive ? jobFilter : new Set(uniqueJobs),
              active: jobFilterActive,
              onApply: applyJobFilter,
              menuTitle: 'Filter by job',
              itemNoun: { singular: 'job', plural: 'jobs' } }}
            assigneeColumnFilter={{
              options: uniqueAssignees,
              selected: assigneeFilter,
              active: assigneeFilterActive,
              onApply: applyAssigneeFilter,
              menuTitle: 'Filter by assignee',
              itemNoun: { singular: 'assignee', plural: 'assignees' } }}
            estimateTypeColumnFilter={{
              options: uniqueTypes,
              selected: typeFilter,
              active: typeFilterActive,
              onApply: applyTypeFilter,
              menuTitle: 'Filter by estimate type',
              itemNoun: { singular: 'type', plural: 'types' } }}
          />
          <TablePagination page={page} pageSize={PAGE_SIZE} total={data.total} onPageChange={handlePageChange} />
        </>
      </div>
    </div>
  );
}
