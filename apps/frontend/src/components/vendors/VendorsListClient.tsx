'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Building2 } from 'lucide-react';
import {
  SortTabs,
  SearchInput,
  StatusFilterMenu,
  ListEmptyState,
  type SortOption,
  type StatusOption,
  buildSortString,
  parseSort,
  statusIdsKey,
  parseStatusIdsFromSearchParam,
  compareDates,
  compareValues,
  formatDate,
} from '@/components/shared/list-filters';
import { SetPageHeader } from '@/components/layout/SetPageHeader';
import { ListPageHeader } from '@/components/layout/ListPageHeader';
import type { Vendor, PaginatedResponse } from '@/types/api';

const SORT_OPTIONS: SortOption[] = [
  { key: 'name', label: 'Name' },
  { key: 'updated_at', label: 'Updated' },
  { key: 'created_at', label: 'Created' },
];
const ALLOWED_SORT_FIELDS = SORT_OPTIONS.map((o) => o.key);

const LINK_STATE_LINKED = 'linked';
const LINK_STATE_UNLINKED = 'unlinked';
const LINK_STATE_OPTIONS: StatusOption[] = [
  { id: LINK_STATE_LINKED, name: 'Linked' },
  { id: LINK_STATE_UNLINKED, name: 'Unlinked' },
];
const LINK_STATE_NOUN = { singular: 'link state', plural: 'link states' };

export interface VendorsListClientProps {
  initialData: PaginatedResponse<Vendor>;
}

export function VendorsListClient({ initialData }: VendorsListClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [data] = useState(initialData);
  const [search, setSearch] = useState(searchParams.get('search') ?? '');
  const [debouncedSearch, setDebouncedSearch] = useState(search);
  const [sort, setSort] = useState(() => {
    const parsed = parseSort({
      sortParam: searchParams.get('sort'),
      allowedFields: ALLOWED_SORT_FIELDS,
      defaultField: 'name',
      defaultOrder: 'asc',
    });
    return buildSortString(parsed.field, parsed.order);
  });
  const [linkFilter, setLinkFilter] = useState<Set<string>>(() =>
    parseStatusIdsFromSearchParam(searchParams.get('link')),
  );

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    const linkKey = statusIdsKey(linkFilter);
    const params = new URLSearchParams(searchParams.toString());
    params.set('search', debouncedSearch);
    params.set('sort', sort);
    params.set('page', '1');
    if (linkKey) params.set('link', linkKey);
    else params.delete('link');
    router.replace(`/vendors?${params}`, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- searchParams excluded to avoid infinite loop: router.replace updates URL -> searchParams changes -> effect re-runs
  }, [debouncedSearch, sort, linkFilter]);

  const { field: activeSortField, order: sortOrder } = parseSort({
    sortParam: sort,
    allowedFields: ALLOWED_SORT_FIELDS,
    defaultField: 'name',
    defaultOrder: 'asc',
  });

  const handleSort = (field: string) => {
    if (activeSortField === field) {
      setSort(buildSortString(field, sortOrder === 'asc' ? 'desc' : 'asc'));
    } else {
      const defaultOrder = field === 'name' ? 'asc' : 'desc';
      setSort(buildSortString(field, defaultOrder));
    }
  };

  const setLinkChecked = (id: string, checked: boolean) => {
    setLinkFilter((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const clearLinkFilter = () => setLinkFilter(new Set());
  const selectAllLinkStates = () =>
    setLinkFilter(new Set(LINK_STATE_OPTIONS.map((o) => o.id)));

  const visibleRows = useMemo(() => {
    const query = debouncedSearch.trim().toLowerCase();
    let rows = data.data;

    if (linkFilter.size > 0) {
      rows = rows.filter((v) => {
        const key = v.externalReference ? LINK_STATE_LINKED : LINK_STATE_UNLINKED;
        return linkFilter.has(key);
      });
    }

    if (query) {
      rows = rows.filter((v) => {
        const name = v.name.toLowerCase();
        const ref = (v.externalReference ?? '').toLowerCase();
        return name.includes(query) || ref.includes(query);
      });
    }

    const sorted = [...rows].sort((a, b) => {
      switch (activeSortField) {
        case 'name':
          return compareValues(a.name, b.name, sortOrder);
        case 'created_at':
          return compareDates(a.createdAt, b.createdAt, sortOrder);
        case 'updated_at':
        default:
          return compareDates(a.updatedAt, b.updatedAt, sortOrder);
      }
    });

    return sorted;
  }, [data.data, debouncedSearch, linkFilter, activeSortField, sortOrder]);

  const withReferenceCount = useMemo(
    () =>
      visibleRows.reduce(
        (acc, v) => acc + (v.externalReference ? 1 : 0),
        0,
      ),
    [visibleRows],
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col" style={{ height: '100%' }}>
      <SetPageHeader>
        <ListPageHeader
          icon={Building2}
          title="Vendors"
          total={data.total}
          showing={visibleRows.length}
          search={debouncedSearch}
          statusSelectedCount={linkFilter.size}
          statusFilterNoun={LINK_STATE_NOUN}
          stats={[
            { label: 'Linked', value: withReferenceCount },
          ]}
          accent="rose"
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
            placeholder="Search vendors by name or reference..."
            value={search}
            onChange={setSearch}
          />

          <StatusFilterMenu
            options={LINK_STATE_OPTIONS}
            selected={linkFilter}
            onSelectionChange={setLinkChecked}
            onClearAll={clearLinkFilter}
            onSelectAll={selectAllLinkStates}
            triggerEmptyLabel="All vendors"
            menuTitle="Filter by link state"
            itemNoun={LINK_STATE_NOUN}
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
                  <th scope="col" className="px-4 py-3">Name</th>
                  <th scope="col" className="px-4 py-3">Reference</th>
                  <th scope="col" className="px-4 py-3">Created</th>
                  <th scope="col" className="px-4 py-3">Updated</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visibleRows.map((vendor) => (
                  <tr
                    key={vendor.id}
                    onClick={() => router.push(`/vendors/${vendor.id}`)}
                    className="cursor-pointer transition-colors hover:bg-slate-50"
                  >
                    <td className="px-4 py-3 font-medium text-slate-900">
                      {vendor.name}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {vendor.externalReference ?? ''}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                      {formatDate(vendor.createdAt)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                      {formatDate(vendor.updatedAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <ListEmptyState label="No vendors found." />
        )}
      </div>
    </div>
  );
}
