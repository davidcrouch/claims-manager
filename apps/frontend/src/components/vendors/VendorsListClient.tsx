'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Building2 } from 'lucide-react';
import {
  SortTabs,
  SearchInput,
  StatusFilterMenu,
  TableEmptyRow,
  type SortOption,
  type StatusOption,
  buildSortString,
  parseSort,
  statusIdsKey,
  parseStatusIdsFromSearchParam,
  formatDate,
} from '@/components/shared/list-filters';
import {
  ColumnSettingsHeaderCell,
  useColumnVisibility,
  type ColumnVisibilityDef,
} from '@/components/shared/column-visibility';
import { SetPageHeader } from '@/components/layout/SetPageHeader';
import { ListPageHeader } from '@/components/layout/ListPageHeader';
import { fetchVendorsAction } from '@/app/(app)/vendors/actions';
import {
  createListFetchSession,
  replaceListQueryIfNeeded,
  useListPageData,
} from '@/components/shared/use-list-page-data';
import type { Vendor, PaginatedResponse } from '@/types/api';

const PAGE_SIZE = 20;

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

const TABLE_COLUMNS: ColumnVisibilityDef[] = [
  { key: 'name', label: 'Name', locked: true },
  { key: 'reference', label: 'Reference' },
  { key: 'created', label: 'Created' },
  { key: 'updated', label: 'Updated' },
];

export interface VendorsListClientProps {
  initialData: PaginatedResponse<Vendor>;
}

export function VendorsListClient({ initialData }: VendorsListClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data, setData, beginFetch, abortFetch } = useListPageData(initialData);
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
  const { isVisible, toggle, visibleCount } = useColumnVisibility(
    'vendors',
    TABLE_COLUMNS,
  );

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    const linkKey = statusIdsKey(linkFilter);
    const fetchKey = `${debouncedSearch}|${sort}|${linkKey}`;
    const params = new URLSearchParams(searchParams.toString());
    if (debouncedSearch) params.set('search', debouncedSearch);
    else params.delete('search');
    if (sort !== 'name_asc') params.set('sort', sort);
    else params.delete('sort');
    params.delete('page');
    if (linkKey) params.set('link', linkKey);
    else params.delete('link');
    if (
      !replaceListQueryIfNeeded({
        router,
        pathname: '/vendors',
        currentQuery: searchParams.toString(),
        nextQuery: params.toString(),
      })
    ) {
      return;
    }
    const session = createListFetchSession({ fetchKey, beginFetch, abortFetch });
    if (!session) return;

    const linked =
      linkFilter.size === 1
        ? [...linkFilter][0] === LINK_STATE_LINKED
          ? true
          : [...linkFilter][0] === LINK_STATE_UNLINKED
            ? false
            : undefined
        : undefined;

    fetchVendorsAction({
      page: 1,
      limit: PAGE_SIZE,
      search: debouncedSearch || undefined,
      sort,
      linked,
    }).then((res) => {
      if (!session.cancelled && res) setData(res);
    });
    return session.cleanup;
  }, [debouncedSearch, sort, linkFilter, searchParams, router, beginFetch, abortFetch]);

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

  const visibleRows = data.data;

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
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr className="text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                {isVisible('name') && (
                  <th scope="col" className="px-4 py-3">Name</th>
                )}
                {isVisible('reference') && (
                  <th scope="col" className="px-4 py-3">Reference</th>
                )}
                {isVisible('created') && (
                  <th scope="col" className="px-4 py-3">Created</th>
                )}
                {isVisible('updated') && (
                  <th scope="col" className="px-4 py-3">Updated</th>
                )}
                <ColumnSettingsHeaderCell
                  columns={TABLE_COLUMNS}
                  isVisible={isVisible}
                  onToggle={toggle}
                />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visibleRows.length === 0 ? (
                <TableEmptyRow colSpan={visibleCount + 1} label="No vendors found." />
              ) : (
                visibleRows.map((vendor) => (
                  <tr
                    key={vendor.id}
                    onClick={() => router.push(`/vendors/${vendor.id}`)}
                    className="cursor-pointer transition-colors hover:bg-slate-50"
                  >
                    {isVisible('name') && (
                      <td className="px-4 py-3 font-medium text-slate-900">
                        {vendor.name}
                      </td>
                    )}
                    {isVisible('reference') && (
                      <td className="px-4 py-3 text-slate-600">
                        {vendor.externalReference ?? ''}
                      </td>
                    )}
                    {isVisible('created') && (
                      <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                        {formatDate(vendor.createdAt)}
                      </td>
                    )}
                    {isVisible('updated') && (
                      <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                        {formatDate(vendor.updatedAt)}
                      </td>
                    )}
                    <td className="px-2 py-3" aria-hidden />
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
