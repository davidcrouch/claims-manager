'use client';

import { useMemo, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { BookOpen, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  formatDate,
  ValueFilterMenu,
  SortableColumnHeader,
  commitColumnFilterSelection,
  columnFilterToValuesParam,
  TableEmptyRow,
} from '@/components/shared/list-filters';
import {
  statusValuesForArchiveListTab,
  mergeStatusParamWithTab,
  parseArchiveListTab,
  type ArchiveListTab,
} from '@/components/shared/archive-list';
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
import { TablePagination } from '@/components/shared/table-pagination';
import { SetPageHeader } from '@/components/layout/SetPageHeader';
import { SetHeaderActions } from '@/components/layout/SetHeaderActions';
import { PrintButton } from '@/components/shared/PrintButton';
import { EntityPageHeader } from '@/components/shared/EntityPageHeader';
import { computeStatusBreakdown } from '@/components/layout/ListPageHeader';
import { JournalFormDrawer } from './JournalFormDrawer';
import {
  createJournalAction,
  fetchJournalsAction,
  linkJournalAction } from '@/app/(app)/journals/actions';
import {
  ColumnSettingsHeaderCell,
  useColumnVisibility } from '@/components/shared/column-visibility';
import { ListArchiveButton, LIST_ARCHIVE_TH_CLASS, LIST_ARCHIVE_TD_CLASS, LIST_ARCHIVE_SPACER_TD_CLASS } from '@/components/shared/ListArchiveButton';
import type { Journal, PaginatedResponse, Job, Claim } from '@/types/api';
import type { JobOption } from '@/components/shared/job-label';
import { jobDisplayName } from '@/components/shared/job-label';
import { JobCellLink } from '@/components/shared/JobCellLink';

type ListTab = ArchiveListTab;

type JournalSortField =
  | 'name'
  | 'status'
  | 'job'
  | 'description'
  | 'location'
  | 'pages'
  | 'created_at'
  | 'updated_at';

interface ColDef { key: JournalSortField; label: string; filterable?: boolean; locked?: boolean }

const TABLE_COLUMNS: ColDef[] = [
  { key: 'name', label: 'Name', locked: true },
  { key: 'job', label: 'Job', filterable: true },
  { key: 'status', label: 'Status', filterable: true },
  { key: 'description', label: 'Description' },
  { key: 'location', label: 'Location' },
  { key: 'pages', label: 'Entries' },
  { key: 'created_at', label: 'Created' },
  { key: 'updated_at', label: 'Updated' },
];

export interface JournalsPageClientProps {
  initialData: PaginatedResponse<Journal> | { data: Journal[]; total: number };
  job?: Job | null;
  parentClaim?: Claim | null;
  jobNameById?: Record<string, string>;
  jobs?: JobOption[];
}

const PAGE_SIZE = 20;

export function JournalsPageClient({
  initialData,
  job,
  parentClaim,
  jobNameById,
  jobs = [] }: JournalsPageClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const jobId = searchParams.get('jobId') ?? undefined;
  const jobIdsParam = searchParams.get('jobIds') ?? undefined;
  const { data, setData, beginFetch, abortFetch } = useListPageData<PaginatedResponse<Journal>>(
    'data' in initialData ? initialData as PaginatedResponse<Journal> : { data: [], total: 0 },
  );
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [tab, setTab] = useState<ListTab>(() =>
    parseArchiveListTab(searchParams.get('tab')),
  );
  const [page, setPage] = useState(1);
  const [columnSort, setColumnSort] = useState<{ field: JournalSortField; order: 'asc' | 'desc' }>({
    field: 'updated_at',
    order: 'desc' });
  const [statusFilter, setStatusFilter] = useState<Set<string>>(new Set());
  const [statusFilterActive, setStatusFilterActive] = useState(false);
  const [createDrawerOpen, setCreateDrawerOpen] = useState(false);
  const { isVisible, toggle, visibleCount } = useColumnVisibility(
    'journals',
    TABLE_COLUMNS,
  );
  const uniqueStatuses = useMemo(
    () => ['active', 'archived'],
    [],
  );
  const tabStatusValues = useMemo(
    () => statusValuesForArchiveListTab(tab, uniqueStatuses),
    [tab, uniqueStatuses],
  );
  const statusParam = useMemo(
    () =>
      mergeStatusParamWithTab(
        columnFilterToValuesParam(statusFilterActive, statusFilter),
        tabStatusValues,
      ),
    [statusFilterActive, statusFilter, tabStatusValues],
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

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    const statusKey = statusParam === null ? '__none__' : (statusParam ?? '');
    const fetchKey = `${debouncedSearch}|${tab}|${page}|${statusKey}|${jobId ?? ''}|${jobIdsParam ?? ''}`;

    const params = new URLSearchParams(searchParams.toString());
    if (page > 1) params.set('page', String(page));
    else params.delete('page');
    if (tab !== 'active') params.set('tab', tab);
    else params.delete('tab');
    if (debouncedSearch) params.set('search', debouncedSearch);
    else params.delete('search');
    if (statusParam) params.set('status', statusParam); else params.delete('status');
    syncServerJobFilterParams(params, jobId, jobIdsParam);
    const next = params.toString();
    if (
      !replaceListQueryIfNeeded({
        router,
        pathname: '/journals',
        currentQuery: searchParams.toString(),
        nextQuery: next,
      })
    ) {
      return;
    }

    const session = createListFetchSession({ fetchKey, beginFetch, abortFetch });
    if (!session) return;

    if (statusParam === null) {
      setData({ data: [], total: 0 });
      return session.cleanup;
    }

    fetchJournalsAction({
      page,
      limit: PAGE_SIZE,
      status: statusParam,
      search: debouncedSearch || undefined,
      jobId: fetchJobId,
      jobIds: fetchJobIds }).then((res) => {
      if (!session.cancelled) setData(res);
    });
    return session.cleanup;
  }, [debouncedSearch, tab, page, statusParam, jobId, jobIdsParam, fetchJobId, fetchJobIds, searchParams, router, beginFetch, abortFetch]);

  const handleCreated = (journal: Journal) => {
    setData((prev) => ({ data: [journal, ...prev.data], total: prev.total + 1 }));
  };

  const handleColumnSort = (field: JournalSortField) => {
    setColumnSort((prev) => {
      if (prev.field === field) {
        return { field, order: prev.order === 'asc' ? 'desc' : 'asc' };
      }
      return { field, order: field === 'name' ? 'asc' : 'desc' };
    });
    setPage(1);
    setPage(1);
  };

  const handleSearchChange = (value: string) => { setSearch(value); setPage(1); };
  const handleTabChange = (val: string) => { setTab(val as ListTab); setPage(1); };
  const handlePageChange = (newPage: number) => setPage(newPage);

  const toggleStatus = (name: string) => {
    const working = statusFilterActive
      ? new Set(statusFilter)
      : new Set(uniqueStatuses);
    if (working.has(name)) working.delete(name);
    else working.add(name);
    const committed = commitColumnFilterSelection({
      next: working,
      optionCount: uniqueStatuses.length });
    setStatusFilter(committed.selected);
    setStatusFilterActive(committed.active);
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

  const applyJobFilter = (next: Set<string>) => {
    const resolved = resolveServerJobFilterSelection({
      next,
      options: uniqueJobs,
      jobs: filterJobs });
    setPage(1);
    const params = new URLSearchParams(searchParams.toString());
    writeServerJobFilterParams(params, resolved);
    params.set('page', '1');
    router.replace(`/journals?${params.toString()}`, { scroll: false });
  };

  const visibleRows = data.data;

  const breakdown = computeStatusBreakdown(visibleRows, (j) => j.status);

  return (
    <div className="flex min-h-0 flex-1 flex-col" style={{ height: '100%' }}>
      <SetPageHeader>
        <EntityPageHeader
          icon={BookOpen}
          title="Journals"
          total={data.total}
          showing={visibleRows.length}
          search={debouncedSearch}
          breakdown={breakdown}
          accent="slate"
          job={job}
          parentClaim={parentClaim}
        />
      </SetPageHeader>
      <SetHeaderActions>
        <Button
          size="default"
          onClick={() => setCreateDrawerOpen(true)}
          className="mr-3 h-9 gap-1.5 px-4 bg-blue-600 text-white hover:bg-blue-500"
        >
          New Journal
        </Button>
        <PrintButton documentType="journals_list" entityId="list" />
      </SetHeaderActions>
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
              placeholder="Search journals by name, description or location..."
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
            options={uniqueStatuses}
            selected={statusFilterActive ? statusFilter : new Set(uniqueStatuses)}
            onToggle={toggleStatus}
            onClearAll={() => {
              setStatusFilter(new Set());
              setStatusFilterActive(false);
              setPage(1);
            }}
            onSelectAll={() => {
              setStatusFilter(new Set());
              setStatusFilterActive(false);
              setPage(1);
            }}
            emptyLabel="All statuses"
            menuTitle="Filter by status"
            itemNoun={{ singular: 'status', plural: 'statuses' }}
          />
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
                        col.key === 'job'
                          ? {
                              options: uniqueJobs,
                              selected: jobFilterActive ? jobFilter : new Set(uniqueJobs),
                              active: jobFilterActive,
                              onApply: applyJobFilter,
                              menuTitle: 'Filter by job',
                              itemNoun: { singular: 'job', plural: 'jobs' } }
                          : col.key === 'status'
                            ? {
                                options: uniqueStatuses,
                                selected: statusFilter,
                                active: statusFilterActive,
                                onApply: applyStatusFilter,
                                menuTitle: 'Filter by status',
                                itemNoun: { singular: 'status', plural: 'statuses' } }
                            : undefined
                      }
                    />
                  ))}
                  <th scope="col" className={LIST_ARCHIVE_TH_CLASS}>
                    <span className="sr-only">Actions</span>
                  </th>
                  <ColumnSettingsHeaderCell
                    columns={TABLE_COLUMNS}
                    isVisible={isVisible}
                    onToggle={toggle}
                  />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visibleRows.length === 0 ? (
                  <TableEmptyRow colSpan={visibleCount + 2} label="No journals found." />
                ) : (
                  visibleRows.map((journal) => (
                  <tr
                    key={journal.id}
                    onClick={() => {
                      const jobId = searchParams.get('jobId');
                      const href = jobId ? `/journals/${journal.id}?jobId=${jobId}` : `/journals/${journal.id}`;
                      router.push(href);
                    }}
                    className="cursor-pointer transition-colors hover:bg-slate-50"
                  >
                    {isVisible('name') && (
                      <td className="whitespace-nowrap px-4 py-3 font-medium text-slate-900">
                        {journal.name}
                      </td>
                    )}
                    {isVisible('job') && (
                      <td className="px-4 py-3 text-slate-600">
                        <JobCellLink jobId={journal.jobId} jobNameById={jobNameById} />
                      </td>
                    )}
                    {isVisible('status') && (
                      <td className="whitespace-nowrap px-4 py-3">
                        <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                          {journal.status}
                        </span>
                      </td>
                    )}
                    {isVisible('description') && (
                      <td className="max-w-[200px] truncate px-4 py-3 text-slate-600">
                        {journal.description ?? ''}
                      </td>
                    )}
                    {isVisible('location') && (
                      <td className="px-4 py-3 text-slate-600">
                        {journal.addressSuburb ?? ''}
                      </td>
                    )}
                    {isVisible('pages') && (
                      <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                        {journal.pageCount ?? 0}
                      </td>
                    )}
                    {isVisible('created_at') && (
                      <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                        {formatDate(journal.createdAt)}
                      </td>
                    )}
                    {isVisible('updated_at') && (
                      <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                        {formatDate(journal.updatedAt)}
                      </td>
                    )}
                    <td
                      className={LIST_ARCHIVE_TD_CLASS}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <ListArchiveButton
                        entityType="journal"
                        entityId={journal.id}
                        statusName={journal.status}
                        entityLabel={journal.name}
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
                ))
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

      <JournalFormDrawer
        open={createDrawerOpen}
        onOpenChange={setCreateDrawerOpen}
        createJournal={createJournalAction}
        linkToJob={(journalId, selectedJobId) =>
          linkJournalAction(journalId, 'Job', selectedJobId)
        }
        jobId={jobId}
        jobs={jobs}
        onCreated={handleCreated}
      />
    </div>
  );
}
