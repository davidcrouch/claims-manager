'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Receipt, Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { StatusBadge } from '@/components/ui/status-badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  type StatusOption,
  formatDate,
  isArchivedStatus,
  commitColumnFilterSelection,
  columnFilterToIdsParam,
  columnFilterKey,
  buildColumnFilterOptions,
  ValueFilterMenu,
  SortableColumnHeader,
  TableEmptyRow,
} from '@/components/shared/list-filters';
import { resolveJobName } from '@/components/shared/job-label';
import { SetPageHeader } from '@/components/layout/SetPageHeader';
import { EntityPageHeader, type EntityBreakdownItem } from '@/components/shared/EntityPageHeader';
import { computeStatusBreakdown } from '@/components/layout/ListPageHeader';
import { fetchInvoicesAction } from '@/app/(app)/invoices/actions';
import { TablePagination } from '@/components/shared/table-pagination';
import {
  ColumnSettingsHeaderCell,
  useColumnVisibility,
} from '@/components/shared/column-visibility';
import { ListArchiveButton, LIST_ARCHIVE_TH_CLASS, LIST_ARCHIVE_TD_CLASS, LIST_ARCHIVE_SPACER_TD_CLASS } from '@/components/shared/ListArchiveButton';
import type { Claim, Invoice, Job, PaginatedResponse } from '@/types/api';
import { formatCurrency } from '@/components/shared/detail';

const PAGE_SIZE = 20;

type ListTab = 'active' | 'archived' | 'all';
const VALID_TABS = new Set<ListTab>(['active', 'archived', 'all']);
function parseTab(param: string | null): ListTab {
  if (param && VALID_TABS.has(param as ListTab)) return param as ListTab;
  return 'active';
}

type InvSortField =
  | 'invoice_number'
  | 'job'
  | 'status'
  | 'total_amount'
  | 'issue_date'
  | 'created_at'
  | 'updated_at';

interface ColDef { key: InvSortField; label: string; filterable?: boolean; locked?: boolean }

const TABLE_COLUMNS: ColDef[] = [
  { key: 'invoice_number', label: 'Invoice #', locked: true },
  { key: 'job', label: 'Job', filterable: true },
  { key: 'status', label: 'Status', filterable: true },
  { key: 'total_amount', label: 'Total' },
  { key: 'issue_date', label: 'Issue Date' },
  { key: 'created_at', label: 'Created' },
  { key: 'updated_at', label: 'Updated' },
];

export interface InvoicesListClientProps {
  initialData: PaginatedResponse<Invoice>;
  statusOptions: StatusOption[];
  jobNameById?: Record<string, string>;
  headerAction?: React.ReactNode;
  job?: Job | null;
  parentClaim?: Claim | null;
}

export function InvoicesListClient({
  initialData,
  statusOptions,
  jobNameById,
  headerAction,
  job,
  parentClaim,
}: InvoicesListClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const jobId = searchParams.get('jobId');
  const [data, setData] = useState(initialData);
  const [search, setSearch] = useState(searchParams.get('search') ?? '');
  const [debouncedSearch, setDebouncedSearch] = useState(search);
  const [tab, setTab] = useState<ListTab>(() => parseTab(searchParams.get('tab')));
  const [page, setPage] = useState(() => {
    const p = parseInt(searchParams.get('page') ?? '1', 10);
    return Number.isFinite(p) && p > 0 ? p : 1;
  });
  const [columnSort, setColumnSort] = useState<{ field: InvSortField; order: 'asc' | 'desc' }>({
    field: 'updated_at',
    order: 'desc',
  });
  const [statusNameFilter, setStatusNameFilter] = useState<Set<string>>(new Set());
  const [statusFilterActive, setStatusFilterActive] = useState(false);
  const [jobFilter, setJobFilter] = useState<Set<string>>(new Set());
  const [jobFilterActive, setJobFilterActive] = useState(false);
  const { isVisible, toggle, visibleCount } = useColumnVisibility(
    'invoices',
    TABLE_COLUMNS,
  );

  const lastFetchKeyRef = useRef<string | null>(null);
  const statusParam = useMemo(
    () => columnFilterToIdsParam(statusFilterActive, statusNameFilter, statusOptions),
    [statusFilterActive, statusNameFilter, statusOptions],
  );

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const sortParam = `${columnSort.field}_${columnSort.order}`;

  useEffect(() => {
    const statusKey = statusParam === null ? '__none__' : (statusParam ?? '');
    const fetchKey = `${debouncedSearch}|${sortParam}|${tab}|${page}|${statusKey}|${jobId ?? ''}`;

    const params = new URLSearchParams(searchParams.toString());
    params.set('search', debouncedSearch);
    params.set('tab', tab);
    params.set('page', String(page));
    params.set('sort', sortParam);
    if (statusParam) params.set('status', statusParam);
    else params.delete('status');
    if (jobId) params.set('jobId', jobId);
    else params.delete('jobId');
    router.replace(`/invoices?${params}`, { scroll: false });

    if (lastFetchKeyRef.current === fetchKey) return;
    lastFetchKeyRef.current = fetchKey;

    if (statusParam === null) {
      setData({ data: [], total: 0 });
      return;
    }

    fetchInvoicesAction({
      page,
      limit: PAGE_SIZE,
      sort: sortParam,
      status: statusParam,
      jobId: jobId ?? undefined,
    }).then((res) => res && setData(res));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- searchParams excluded to avoid infinite loop: router.replace updates URL -> searchParams changes -> effect re-runs
  }, [debouncedSearch, sortParam, tab, page, statusParam, jobId]);

  const handleColumnSort = (field: InvSortField) => {
    setColumnSort((prev) => {
      if (prev.field === field) {
        return { field, order: prev.order === 'asc' ? 'desc' : 'asc' };
      }
      return { field, order: field === 'invoice_number' ? 'asc' : 'desc' };
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

  const uniqueStatuses = useMemo(() => {
    const fromOptions = statusOptions
      .map((s) => s.name?.trim())
      .filter((n): n is string => !!n);
    if (fromOptions.length > 0) {
      return [...new Set(fromOptions)].sort((a, b) => a.localeCompare(b));
    }
    const names = new Set<string>();
    for (const inv of data.data) {
      const name = inv.status?.name?.trim();
      if (name) names.add(name);
    }
    return [...names].sort((a, b) => a.localeCompare(b));
  }, [data.data, statusOptions]);

  const uniqueJobs = useMemo(
    () =>
      buildColumnFilterOptions(
        data.data.map((row) => resolveJobName(row.jobId, jobNameById)),
      ),
    [data.data, jobNameById],
  );

  const toggleStatusName = (name: string) => {
    const working = statusFilterActive
      ? new Set(statusNameFilter)
      : new Set(uniqueStatuses);
    if (working.has(name)) working.delete(name);
    else working.add(name);
    const committed = commitColumnFilterSelection({
      next: working,
      optionCount: uniqueStatuses.length,
    });
    setStatusNameFilter(committed.selected);
    setStatusFilterActive(committed.active);
    setPage(1);
  };

  const applyStatusFilter = (next: Set<string>) => {
    const committed = commitColumnFilterSelection({
      next,
      optionCount: uniqueStatuses.length,
    });
    setStatusNameFilter(committed.selected);
    setStatusFilterActive(committed.active);
    setPage(1);
  };

  const applyJobFilter = (next: Set<string>) => {
    const committed = commitColumnFilterSelection({
      next,
      optionCount: uniqueJobs.length,
    });
    setJobFilter(committed.selected);
    setJobFilterActive(committed.active);
    setPage(1);
  };

  const visibleRows = useMemo(() => {
    const query = debouncedSearch.trim().toLowerCase();
    let rows = data.data;

    if (tab !== 'all') {
      rows = rows.filter((inv) => {
        const archived = isArchivedStatus(inv.status?.name);
        return tab === 'archived' ? archived : !archived;
      });
    }

    if (jobFilterActive) {
      if (jobFilter.size === 0) rows = [];
      else rows = rows.filter((row) =>
        jobFilter.has(columnFilterKey(resolveJobName(row.jobId, jobNameById))),
      );
    }

    if (query) {
      rows = rows.filter((inv) =>
        (inv.invoiceNumber ?? '').toLowerCase().includes(query),
      );
    }

    return rows;
  }, [data.data, tab, debouncedSearch, jobFilterActive, jobFilter, jobNameById]);

  const breakdown = computeStatusBreakdown(visibleRows, (i) => i.status?.name);
  const totalValue = useMemo(() => {
    const sum = visibleRows.reduce((acc, inv) => {
      const n = Number(inv.totalAmount);
      return Number.isFinite(n) ? acc + n : acc;
    }, 0);
    if (sum === 0) return null;
    return sum.toLocaleString(undefined, {
      style: 'currency',
      currency: 'AUD',
      maximumFractionDigits: 0,
    });
  }, [visibleRows]);

  return (
    <div className="flex min-h-0 flex-1 flex-col" style={{ height: '100%' }}>
      <SetPageHeader>
        <EntityPageHeader
          icon={Receipt}
          title="Invoices"
          total={data.total}
          showing={visibleRows.length}
          search={debouncedSearch}
          breakdown={breakdown}
          stats={totalValue ? [{ label: 'Total value', value: totalValue }] : undefined}
          accent="teal"
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
              placeholder="Search invoices by invoice #..."
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
            selected={statusFilterActive ? statusNameFilter : new Set(uniqueStatuses)}
            onToggle={toggleStatusName}
            onClearAll={() => {
              setStatusNameFilter(new Set());
              setStatusFilterActive(false);
              setPage(1);
            }}
            onSelectAll={() => {
              setStatusNameFilter(new Set());
              setStatusFilterActive(false);
              setPage(1);
            }}
            emptyLabel="All statuses"
            menuTitle="Filter by status"
            itemNoun={{ singular: 'status', plural: 'statuses' }}
          />

          {headerAction}
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
                              selected: jobFilter,
                              active: jobFilterActive,
                              onApply: applyJobFilter,
                              menuTitle: 'Filter by job',
                              itemNoun: { singular: 'job', plural: 'jobs' },
                            }
                          : col.key === 'status'
                            ? {
                                options: uniqueStatuses,
                                selected: statusNameFilter,
                                active: statusFilterActive,
                                onApply: applyStatusFilter,
                                menuTitle: 'Filter by status',
                                itemNoun: { singular: 'status', plural: 'statuses' },
                              }
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
                  <TableEmptyRow colSpan={visibleCount + 2} label="No invoices found." />
                ) : (
                  visibleRows.map((inv) => {
                  const num = inv.invoiceNumber ?? inv.id;
                  const statusName = inv.status?.name ?? 'Unknown';
                  return (
                    <tr
                      key={inv.id}
                      onClick={() => {
                        const jobId = searchParams.get('jobId');
                        const href = jobId ? `/invoices/${inv.id}?jobId=${jobId}` : `/invoices/${inv.id}`;
                        router.push(href);
                      }}
                      className="cursor-pointer transition-colors hover:bg-slate-50"
                    >
                      {isVisible('invoice_number') && (
                        <td className="whitespace-nowrap px-4 py-3 font-medium text-slate-900">
                          {num}
                        </td>
                      )}
                      {isVisible('job') && (
                        <td className="px-4 py-3 text-slate-600">
                          {resolveJobName(inv.jobId, jobNameById)}
                        </td>
                      )}
                      {isVisible('status') && (
                        <td className="whitespace-nowrap px-4 py-3">
                          <StatusBadge status={statusName} />
                        </td>
                      )}
                      {isVisible('total_amount') && (
                        <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                          {formatCurrency(inv.totalAmount)}
                        </td>
                      )}
                      {isVisible('issue_date') && (
                        <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                          {formatDate(inv.issueDate)}
                        </td>
                      )}
                      {isVisible('created_at') && (
                        <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                          {formatDate(inv.createdAt)}
                        </td>
                      )}
                      {isVisible('updated_at') && (
                        <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                          {formatDate(inv.updatedAt)}
                        </td>
                      )}
                      <td
                        className={LIST_ARCHIVE_TD_CLASS}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <ListArchiveButton
                          entityType="invoice"
                          entityId={inv.id}
                          statusName={statusName}
                          entityLabel={num}
                          onArchived={(id) => {
                            setData((prev) => ({
                              ...prev,
                              data: prev.data.filter((row) => row.id !== id),
                              total: Math.max(0, prev.total - 1),
                            }));
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
    </div>
  );
}
