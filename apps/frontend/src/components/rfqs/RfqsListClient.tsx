'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { FileQuestion } from 'lucide-react';
import {
  SortTabs,
  SearchInput,
  StatusFilterMenu,
  ListEmptyState,
  type StatusOption,
  type SortOption,
  buildSortString,
  parseSort,
  statusIdsKey,
  parseStatusIdsFromSearchParam,
  compareDates,
  compareValues,
  formatDate,
} from '@/components/shared/list-filters';
import { SetPageHeader } from '@/components/layout/SetPageHeader';
import {
  ListPageHeader,
  computeStatusBreakdown,
} from '@/components/layout/ListPageHeader';
import type { Rfq, PaginatedResponse } from '@/types/api';

const SORT_OPTIONS: SortOption[] = [
  { key: 'updated_at', label: 'Updated' },
  { key: 'created_at', label: 'Created' },
  { key: 'rfq_number', label: 'RFQ Number' },
];
const ALLOWED_SORT_FIELDS = SORT_OPTIONS.map((o) => o.key);

export interface RfqsListClientProps {
  initialData: PaginatedResponse<Rfq>;
  statusOptions: StatusOption[];
}

export function RfqsListClient({
  initialData,
  statusOptions,
}: RfqsListClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [data] = useState(initialData);
  const [search, setSearch] = useState(searchParams.get('search') ?? '');
  const [debouncedSearch, setDebouncedSearch] = useState(search);
  const [sort, setSort] = useState(() => {
    const parsed = parseSort({
      sortParam: searchParams.get('sort'),
      allowedFields: ALLOWED_SORT_FIELDS,
      defaultField: 'updated_at',
    });
    return buildSortString(parsed.field, parsed.order);
  });
  const [statusFilter, setStatusFilter] = useState<Set<string>>(() =>
    parseStatusIdsFromSearchParam(searchParams.get('status')),
  );

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    const statusKey = statusIdsKey(statusFilter);
    const params = new URLSearchParams(searchParams.toString());
    params.set('search', debouncedSearch);
    params.set('sort', sort);
    params.set('page', '1');
    if (statusKey) params.set('status', statusKey);
    else params.delete('status');
    router.replace(`/rfqs?${params}`, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- searchParams excluded to avoid infinite loop
  }, [debouncedSearch, sort, statusFilter]);

  const { field: activeSortField, order: sortOrder } = parseSort({
    sortParam: sort,
    allowedFields: ALLOWED_SORT_FIELDS,
    defaultField: 'updated_at',
  });

  const handleSort = (field: string) => {
    if (activeSortField === field) {
      setSort(buildSortString(field, sortOrder === 'asc' ? 'desc' : 'asc'));
    } else {
      const defaultOrder = field === 'rfq_number' ? 'asc' : 'desc';
      setSort(buildSortString(field, defaultOrder));
    }
  };

  const setStatusChecked = (id: string, checked: boolean) => {
    setStatusFilter((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const clearStatuses = () => setStatusFilter(new Set());
  const selectAllStatuses = () =>
    setStatusFilter(new Set(statusOptions.map((o) => o.id)));

  const visibleRows = useMemo(() => {
    const query = debouncedSearch.trim().toLowerCase();
    let rows = data.data;

    if (statusFilter.size > 0) {
      rows = rows.filter((rfq) => {
        const sid = rfq.statusLookupId ?? rfq.status?.id;
        return sid ? statusFilter.has(sid) : false;
      });
    }

    if (query) {
      rows = rows.filter((rfq) => {
        const num = (rfq.rfqNumber ?? '').toLowerCase();
        const name = (rfq.name ?? '').toLowerCase();
        const vendor = (rfq.rfqToName ?? '').toLowerCase();
        return num.includes(query) || name.includes(query) || vendor.includes(query);
      });
    }

    const sorted = [...rows].sort((a, b) => {
      switch (activeSortField) {
        case 'rfq_number':
          return compareValues(
            a.rfqNumber ?? '',
            b.rfqNumber ?? '',
            sortOrder,
          );
        case 'created_at':
          return compareDates(a.createdAt, b.createdAt, sortOrder);
        case 'updated_at':
        default:
          return compareDates(a.updatedAt, b.updatedAt, sortOrder);
      }
    });

    return sorted;
  }, [data.data, debouncedSearch, statusFilter, activeSortField, sortOrder]);

  const breakdown = computeStatusBreakdown(
    visibleRows,
    (rfq) => rfq.status?.name,
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col" style={{ height: '100%' }}>
      <SetPageHeader>
        <ListPageHeader
          icon={FileQuestion}
          title="RFQs"
          total={data.total}
          showing={visibleRows.length}
          search={debouncedSearch}
          statusSelectedCount={statusFilter.size}
          breakdown={breakdown}
          accent="violet"
        />
      </SetPageHeader>
      <div className="flex flex-col gap-4 px-6 pb-4 pt-1">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
          <SortTabs
            options={SORT_OPTIONS}
            activeField={activeSortField}
            sortOrder={sortOrder}
            onSort={handleSort}
          />

          <SearchInput
            placeholder="Search RFQs by number, name or vendor..."
            value={search}
            onChange={setSearch}
          />

          <StatusFilterMenu
            options={statusOptions}
            selected={statusFilter}
            onSelectionChange={setStatusChecked}
            onClearAll={clearStatuses}
            onSelectAll={selectAllStatuses}
          />
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
                  <th scope="col" className="px-4 py-3">RFQ #</th>
                  <th scope="col" className="px-4 py-3">Status</th>
                  <th scope="col" className="px-4 py-3">Vendor (sub)</th>
                  <th scope="col" className="px-4 py-3">Job Ref</th>
                  <th scope="col" className="px-4 py-3">Sent</th>
                  <th scope="col" className="px-4 py-3">Due</th>
                  <th scope="col" className="px-4 py-3">Updated</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visibleRows.map((rfq) => {
                  const num = rfq.rfqNumber ?? rfq.name ?? rfq.id;
                  const statusName = rfq.status?.name ?? 'Unknown';
                  const vendor = rfq.rfqToName ?? '';
                  return (
                    <tr
                      key={rfq.id}
                      onClick={() => router.push(`/rfqs/${rfq.id}`)}
                      className="cursor-pointer transition-colors hover:bg-slate-50"
                    >
                      <td className="whitespace-nowrap px-4 py-3 font-medium text-slate-900">
                        {num}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                          {statusName}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{vendor}</td>
                      <td className="px-4 py-3 text-slate-600">
                        {rfq.jobId ? rfq.jobId.slice(0, 8) : ''}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                        {formatDate(rfq.sentDate)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                        {formatDate(rfq.dueDate)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                        {formatDate(rfq.updatedAt)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <ListEmptyState label="No RFQs found." />
        )}
      </div>
    </div>
  );
}
