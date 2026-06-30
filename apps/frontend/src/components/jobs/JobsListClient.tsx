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

interface ColDef { key: JobSortField; label: string }

const TABLE_COLUMNS: ColDef[] = [
  { key: 'external_reference', label: 'Job Ref' },
  { key: 'status', label: 'Status' },
  { key: 'job_type', label: 'Type' },
  { key: 'address', label: 'Address' },
  { key: 'request_date', label: 'Requested' },
  { key: 'updated_at', label: 'Updated' },
];

export interface JobsListClientProps {
 initialData: PaginatedResponse<Job>;
 statusOptions: StatusOption[];
 unreadJobIds?: string[];
 headerAction?: React.ReactNode;
}

export function JobsListClient({
 initialData,
 statusOptions,
 unreadJobIds,
 headerAction,
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

  const lastFetchKeyRef = useRef<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const sortParam = `${columnSort.field}_${columnSort.order}`;

  useEffect(() => {
    const fetchKey = `${debouncedSearch}|${sortParam}|${tab}|${page}`;

    const params = new URLSearchParams(searchParams.toString());
    params.set('search', debouncedSearch);
    params.set('tab', tab);
    params.set('page', String(page));
    params.set('sort', sortParam);
    router.replace(`/jobs?${params}`, { scroll: false });

    if (lastFetchKeyRef.current === fetchKey) return;
    lastFetchKeyRef.current = fetchKey;

    fetchJobsAction({
      search: debouncedSearch || undefined,
      page,
      limit: PAGE_SIZE,
      sort: sortParam,
    }).then((res) => res && setData(res));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, sortParam, tab, page]);

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

  const uniqueTypes = useMemo(() => {
    const names = new Set<string>();
    for (const job of data.data) {
      const name = job.jobType?.name?.trim();
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
    let rows = data.data;

    if (tab !== 'all') {
      rows = rows.filter((job) => {
        const archived = isArchivedStatus(job.status?.name);
        return tab === 'archived' ? archived : !archived;
      });
    }

    if (typeFilter.size > 0) {
      rows = rows.filter((job) => {
        const name = job.jobType?.name?.trim();
        return name ? typeFilter.has(name) : false;
      });
    }

    return rows;
  }, [data.data, tab, typeFilter]);

  const breakdown = computeStatusBreakdown(visibleRows, (j) => j.status?.name);

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
            options={uniqueTypes}
            selected={typeFilter}
            onToggle={toggleType}
            onClearAll={() => setTypeFilter(new Set())}
            onSelectAll={() => setTypeFilter(new Set(uniqueTypes))}
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
                    />
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visibleRows.map((job) => {
                  const ref = job.externalJobId ?? job.externalReference ?? job.id;
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
