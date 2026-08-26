'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { FileInput, PackagePlus, Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { type StatusOption,
  formatDate,
  commitColumnFilterSelection,
  columnFilterToIdsParam,


  ValueFilterMenu,
  SortableColumnHeader,
  TableEmptyRow, withUniqueNamedFilterOptions } from '@/components/shared/list-filters';
import { statusIdsForArchiveListTab, mergeStatusParamWithTab } from '@/components/shared/archive-list';
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
import { TablePagination } from '@/components/shared/table-pagination';
import { SetPageHeader } from '@/components/layout/SetPageHeader';
import {
  EntityPageHeader,
  type EntityBreakdownItem } from '@/components/shared/EntityPageHeader';
import { computeStatusBreakdown } from '@/components/layout/ListPageHeader';
import { formatCurrency } from '@/components/shared/detail';
import { fetchProposalsAction } from '@/app/(app)/proposals/actions';
import { CaptureEstimateDrawer } from '@/components/forms/CaptureEstimateDrawer';
import {
  ColumnSettingsHeaderCell,
  useColumnVisibility } from '@/components/shared/column-visibility';
import { ListArchiveButton, LIST_ARCHIVE_TH_CLASS, LIST_ARCHIVE_TD_CLASS, LIST_ARCHIVE_SPACER_TD_CLASS } from '@/components/shared/ListArchiveButton';
import type { Proposal, PaginatedResponse, Job, Claim } from '@/types/api';

const PAGE_SIZE = 20;

type ListTab = 'active' | 'archived' | 'all';
const VALID_TABS = new Set<ListTab>(['active', 'archived', 'all']);
function parseTab(param: string | null): ListTab {
  if (param && VALID_TABS.has(param as ListTab)) return param as ListTab;
  return 'active';
}

type ProposalSortField =
  | 'proposal_number'
  | 'job'
  | 'status'
  | 'vendor'
  | 'rfq_ref'
  | 'total_amount'
  | 'received_date'
  | 'updated_at';

interface ColDef { key: ProposalSortField; label: string; filterable?: boolean; locked?: boolean }

const TABLE_COLUMNS: ColDef[] = [
  { key: 'proposal_number', label: 'Proposal #', locked: true },
  { key: 'job', label: 'Job', filterable: true },
  { key: 'status', label: 'Status', filterable: true },
  { key: 'vendor', label: 'Vendor', filterable: true },
  { key: 'rfq_ref', label: 'RFQ #' },
  { key: 'total_amount', label: 'Total' },
  { key: 'received_date', label: 'Received' },
  { key: 'updated_at', label: 'Updated' },
];

export interface ProposalsListClientProps {
  initialData: PaginatedResponse<Proposal>;
  statusOptions: StatusOption[];
  vendorOptions: StatusOption[];
  jobNameById?: Record<string, string>;
  jobTypeById?: Record<string, string>;
  job?: Job | null;
  parentClaim?: Claim | null;
}

export function ProposalsListClient({
  initialData,
  statusOptions,
  vendorOptions,
  jobNameById,
  jobTypeById,
  job,
  parentClaim }: ProposalsListClientProps) {
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
  const [columnSort, setColumnSort] = useState<{ field: ProposalSortField; order: 'asc' | 'desc' }>({
    field: 'updated_at',
    order: 'desc' });
  const [vendorFilter, setVendorFilter] = useState<Set<string>>(new Set());
  const [vendorFilterActive, setVendorFilterActive] = useState(false);
  const [statusFilter, setStatusFilter] = useState<Set<string>>(new Set());
  const [statusFilterActive, setStatusFilterActive] = useState(false);
  const [captureDrawerOpen, setCaptureDrawerOpen] = useState(false);
  const { isVisible, toggle, visibleCount } = useColumnVisibility(
    'proposals',
    TABLE_COLUMNS,
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
  const vendorFilterOptions = useMemo(
    () =>
      withUniqueNamedFilterOptions(
        vendorOptions.map((vendor) => ({
          id: vendor.id,
          name: vendor.name?.trim() ? vendor.name.trim() : vendor.id })),
      ),
    [vendorOptions],
  );
  const vendorParam = useMemo(
    () => columnFilterToIdsParam(vendorFilterActive, vendorFilter, vendorFilterOptions),
    [vendorFilterActive, vendorFilter, vendorFilterOptions],
  );

  const sortParam = `${columnSort.field}_${columnSort.order}`;

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    const statusKey = statusParam === null ? '__none__' : (statusParam ?? '');
    const vendorKey = vendorParam === null ? '__none__' : (vendorParam ?? '');
    const fetchKey = `${debouncedSearch}|${sortParam}|${tab}|${page}|${statusKey}|${vendorKey}|${jobId ?? ''}|${jobIdsParam ?? ''}`;
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
    if (vendorParam) params.set('vendorId', vendorParam); else params.delete('vendorId');
    syncServerJobFilterParams(params, jobId, jobIdsParam);
    const next = params.toString();
    if (
      !replaceListQueryIfNeeded({
        router,
        pathname: '/proposals',
        currentQuery: searchParams.toString(),
        nextQuery: next,
      })
    ) {
      return;
    }
    const session = createListFetchSession({ fetchKey, beginFetch, abortFetch });
    if (!session) return;
    if (statusParam === null || vendorParam === null) {
      setData({ data: [], total: 0 });
      return session.cleanup;
    }
    fetchProposalsAction({ page, limit: PAGE_SIZE, sort: sortParam, status: statusParam, vendorId: vendorParam, jobId: fetchJobId, jobIds: fetchJobIds, search: debouncedSearch || undefined }).then((res) => {
      if (!session.cancelled && res) setData(res);
    });
    return session.cleanup;
  }, [debouncedSearch, sortParam, tab, page, statusParam, vendorParam, jobId, jobIdsParam, fetchJobId, fetchJobIds, searchParams, router, beginFetch, abortFetch]);

  const handleColumnSort = (field: ProposalSortField) => {
    setColumnSort((prev) => {
      if (prev.field === field) {
        return { field, order: prev.order === 'asc' ? 'desc' : 'asc' };
      }
      return { field, order: field === 'proposal_number' ? 'asc' : 'desc' };
    });
    setPage(1);
  };

  const handlePageChange = (newPage: number) => setPage(newPage);
  const handleSearchChange = (value: string) => { setSearch(value); setPage(1); };
  const handleTabChange = (val: string) => { setTab(val as ListTab); setPage(1); };

  const uniqueVendors = useMemo(
    () => vendorFilterOptions.map((vendor) => vendor.name).sort((a, b) => a.localeCompare(b)),
    [vendorFilterOptions],
  );


  const uniqueStatuses = useMemo(() => {
    const fromOptions = statusOptions
      .map((s) => s.name?.trim())
      .filter((n): n is string => !!n);
    if (fromOptions.length > 0) {
      return [...new Set(fromOptions)].sort((a, b) => a.localeCompare(b));
    }
    const names = new Set<string>();
    for (const p of data.data) {
      const name = p.status?.name?.trim();
      if (name) names.add(name);
    }
    return [...names].sort((a, b) => a.localeCompare(b));
  }, [data.data, statusOptions]);

  const toggleVendor = (name: string) => {
    const working = vendorFilterActive ? new Set(vendorFilter) : new Set(uniqueVendors);
    if (working.has(name)) working.delete(name);
    else working.add(name);
    const committed = commitColumnFilterSelection({
      next: working,
      optionCount: uniqueVendors.length });
    setVendorFilter(committed.selected);
    setVendorFilterActive(committed.active);
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

  const applyVendorFilter = (next: Set<string>) => {
    const committed = commitColumnFilterSelection({
      next,
      optionCount: uniqueVendors.length });
    setVendorFilter(committed.selected);
    setVendorFilterActive(committed.active);
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
    router.replace(`/proposals?${params.toString()}`, { scroll: false });
  };

  const statusFilterProps = {
    options: uniqueStatuses,
    selected: statusFilter,
    active: statusFilterActive,
    onApply: applyStatusFilter,
    menuTitle: 'Filter by status',
    itemNoun: { singular: 'status', plural: 'statuses' } };

  const vendorFilterProps = {
    options: uniqueVendors,
    selected: vendorFilter,
    active: vendorFilterActive,
    onApply: applyVendorFilter,
    menuTitle: 'Filter by vendor',
    itemNoun: { singular: 'vendor', plural: 'vendors' } };

  const jobFilterProps = {
    options: uniqueJobs,
    selected: jobFilterActive ? jobFilter : new Set(uniqueJobs),
    active: jobFilterActive,
    onApply: applyJobFilter,
    menuTitle: 'Filter by job',
    itemNoun: { singular: 'job', plural: 'jobs' } };

  const visibleRows = data.data;

  const breakdown = computeStatusBreakdown(
    visibleRows,
    (p) => p.status?.name,
  );

  const totalValue = useMemo(() => {
    const sum = visibleRows.reduce((acc, p) => {
      const n = Number(p.totalAmount);
      return Number.isFinite(n) ? acc + n : acc;
    }, 0);
    if (sum === 0) return null;
    return sum.toLocaleString(undefined, {
      style: 'currency',
      currency: 'AUD',
      maximumFractionDigits: 0 });
  }, [visibleRows]);

  return (
    <div className="flex min-h-0 flex-1 flex-col" style={{ height: '100%' }}>
      <SetPageHeader>
        <EntityPageHeader
          icon={FileInput}
          title="Proposals"
          total={data.total}
          showing={visibleRows.length}
          search={debouncedSearch}
          breakdown={breakdown}
          stats={totalValue ? [{ label: 'Total value', value: totalValue }] : undefined}
          accent="violet"
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
              placeholder="Search proposals by number, name or vendor..."
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

          <Button
            variant="outline"
            size="sm"
            onClick={() => setCaptureDrawerOpen(true)}
            className="shrink-0"
            disabled={!jobId && !parentClaim?.id}
            title={
              !jobId && !parentClaim?.id
                ? 'Open proposals from a job to capture an external estimate'
                : undefined
            }
          >
            <PackagePlus className="mr-2 h-4 w-4" />
            Capture External Estimate
          </Button>

          <ValueFilterMenu
            options={uniqueVendors}
            selected={vendorFilterActive ? vendorFilter : new Set(uniqueVendors)}
            onToggle={toggleVendor}
            onClearAll={() => {
              setVendorFilter(new Set());
              setVendorFilterActive(false);
              setPage(1);
            }}
            onSelectAll={() => {
              setVendorFilter(new Set());
              setVendorFilterActive(false);
              setPage(1);
            }}
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
                          ? jobFilterProps
                          : col.key === 'status'
                            ? statusFilterProps
                            : col.key === 'vendor'
                              ? vendorFilterProps
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
                  <TableEmptyRow colSpan={visibleCount + 2} label="No proposals found." />
                ) : (
                  visibleRows.map((p) => {
                  const num = p.proposalNumber ?? p.reference ?? p.name ?? p.id;
                  const statusName = p.status?.name ?? 'Unknown';
                  const vendor = p.proposalFromName ?? '';
                  return (
                    <tr
                      key={p.id}
                      onClick={() => {
                      const jobId = searchParams.get('jobId');
                      const href = jobId ? `/proposals/${p.id}?jobId=${jobId}` : `/proposals/${p.id}`;
                      router.push(href);
                    }}
                      className="cursor-pointer transition-colors hover:bg-slate-50"
                    >
                      {isVisible('proposal_number') && (
                        <td className="whitespace-nowrap px-4 py-3 font-medium text-slate-900">
                          {num}
                        </td>
                      )}
                      {isVisible('job') && (
                        <td className="px-4 py-3 text-slate-600">
                          <JobCellLink jobId={p.jobId} jobNameById={jobNameById} jobTypeById={jobTypeById} />
                        </td>
                      )}
                      {isVisible('status') && (
                        <td className="whitespace-nowrap px-4 py-3">
                          <StatusBadge status={statusName} />
                        </td>
                      )}
                      {isVisible('vendor') && (
                        <td className="px-4 py-3 text-slate-600">{vendor}</td>
                      )}
                      {isVisible('rfq_ref') && (
                        <td className="px-4 py-3 text-slate-600">
                          {p.rfqId ? p.rfqId.slice(0, 8) : ''}
                        </td>
                      )}
                      {isVisible('total_amount') && (
                        <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                          {formatCurrency(p.totalAmount)}
                        </td>
                      )}
                      {isVisible('received_date') && (
                        <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                          {formatDate(p.receivedDate ?? p.proposalDate)}
                        </td>
                      )}
                      {isVisible('updated_at') && (
                        <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                          {formatDate(p.updatedAt)}
                        </td>
                      )}
                      <td
                        className={LIST_ARCHIVE_TD_CLASS}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <ListArchiveButton
                          entityType="proposal"
                          entityId={p.id}
                          statusName={statusName}
                          entityLabel={num}
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
            <TablePagination page={page} pageSize={PAGE_SIZE} total={data.total} onPageChange={handlePageChange} />
          </div>
      </div>

      <CaptureEstimateDrawer
        open={captureDrawerOpen}
        onOpenChange={setCaptureDrawerOpen}
        jobId={jobId ?? job?.id ?? undefined}
        claimId={parentClaim?.id ?? job?.claimId ?? undefined}
      />
    </div>
  );
}
