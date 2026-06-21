'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowDown, ArrowUp, Briefcase, Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
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
  compareDates,
  compareValues,
  formatDate,
  isArchivedStatus,
  ValueFilterMenu,
  SortableColumnHeader,
} from '@/components/shared/list-filters';

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

function getJobSortValue(job: Job, field: JobSortField): string | null | undefined {
  switch (field) {
    case 'external_reference': return job.externalReference ?? job.id;
    case 'status': return job.status?.name;
    case 'job_type': return job.jobType?.name;
    case 'address': return formatAddress(job) || null;
    case 'request_date': return job.requestDate;
    case 'updated_at': return job.updatedAt;
    default: return null;
  }
}

export interface JobsListClientProps {
  initialData: PaginatedResponse<Job>;
  statusOptions: StatusOption[];
  headerAction?: React.ReactNode;
}

export function JobsListClient({
  initialData,
  statusOptions,
  headerAction,
}: JobsListClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [data, setData] = useState(initialData);
  const [search, setSearch] = useState(searchParams.get('search') ?? '');
  const [debouncedSearch, setDebouncedSearch] = useState(search);
  const [tab, setTab] = useState<ListTab>(() => parseTab(searchParams.get('tab')));
  const [columnSort, setColumnSort] = useState<{ field: JobSortField; order: 'asc' | 'desc' }>({
    field: 'updated_at',
    order: 'desc',
  });
  const [typeFilter, setTypeFilter] = useState<Set<string>>(new Set());

  const lastSearchRef = useRef<string | null>(debouncedSearch);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('search', debouncedSearch);
    params.set('tab', tab);
    params.set('page', '1');
    router.replace(`/jobs?${params}`, { scroll: false });

    if (lastSearchRef.current !== debouncedSearch) {
      lastSearchRef.current = debouncedSearch;
      fetchJobsAction({ search: debouncedSearch || undefined }).then(
        (res) => res && setData(res),
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- searchParams excluded to avoid infinite loop
  }, [debouncedSearch, tab]);

  const handleColumnSort = (field: JobSortField) => {
    setColumnSort((prev) => {
      if (prev.field === field) {
        return { field, order: prev.order === 'asc' ? 'desc' : 'asc' };
      }
      return { field, order: field === 'external_reference' ? 'asc' : 'desc' };
    });
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

    const query = debouncedSearch.trim().toLowerCase();
    if (query) {
      rows = rows.filter((job) => {
        const ref = (job.externalReference ?? '').toLowerCase();
        const suburb = (job.addressSuburb ?? '').toLowerCase();
        return ref.includes(query) || suburb.includes(query);
      });
    }

    const isDate = columnSort.field === 'request_date' || columnSort.field === 'updated_at';
    return [...rows].sort((a, b) => {
      const aVal = getJobSortValue(a, columnSort.field);
      const bVal = getJobSortValue(b, columnSort.field);
      return isDate
        ? compareDates(aVal, bVal, columnSort.order)
        : compareValues(aVal, bVal, columnSort.order);
    });
  }, [data.data, tab, typeFilter, debouncedSearch, columnSort]);

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
          <Tabs value={tab} onValueChange={(val) => setTab(val as ListTab)}>
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
              onChange={(e) => setSearch(e.target.value)}
              className="h-10 w-full pl-9 pr-9"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
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
                  const ref = job.externalReference ?? job.id;
                  const statusName = job.status?.name ?? 'Unknown';
                  const jobTypeName = job.jobType?.name ?? '';
                  return (
                    <tr
                      key={job.id}
                      onClick={() => router.push(`/jobs/${job.id}`)}
                      className="cursor-pointer transition-colors hover:bg-slate-50"
                    >
                      <td className="whitespace-nowrap px-4 py-3 font-medium text-slate-900">
                        {ref}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                          {statusName}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{jobTypeName}</td>
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
