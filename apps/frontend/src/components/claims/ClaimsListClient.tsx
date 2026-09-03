'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Search, X } from 'lucide-react';
import { FileText } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { StatusBadge } from '@/components/ui/status-badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SetPageHeader } from '@/components/layout/SetPageHeader';
import {
  ListPageHeader,
  computeStatusBreakdown,
} from '@/components/layout/ListPageHeader';
import { fetchClaimsAction } from '@/app/(app)/claims/actions';
import {
  createListFetchSession,
  replaceListQueryIfNeeded,
  useListPageData,
} from '@/components/shared/use-list-page-data';
import { usePersistedListTab } from '@/components/shared/list-tab-storage';
import type { Claim, PaginatedResponse } from '@/types/api';
import {
  columnFilterFromIdsParam,
  normalizeSortParam,
  parseClaimsListTab,
  isClaimsMineTab,
  archiveStateLabel,
  buildClaimsListFetchKey,
  DEFAULT_CLAIMS_SORT,
  type ClaimsListTab,
} from './claims-list-helpers';
import {
  compareValues,
  compareDates,
  ValueFilterMenu,
  SortableColumnHeader,
  commitColumnFilterSelection,
  columnFilterToIdsParam,
  columnFilterToValuesParam,
  TableEmptyRow,
} from '@/components/shared/list-filters';
import { columnFilterFromValuesParam } from '@/components/jobs/jobs-list-helpers';
import {
  statusIdsForArchiveListTab,
  mergeStatusParamWithTab,
  isArchivedStatus,
  type ArchiveListTab,
} from '@/components/shared/archive-list';
import { columnFilterToArchiveStateStatusIds } from '@/components/shared/list-mine-tab';
import {
  ColumnSettingsHeaderCell,
  useColumnVisibility,
} from '@/components/shared/column-visibility';
import { ListArchiveButton, LIST_ARCHIVE_TH_CLASS, LIST_ARCHIVE_TD_CLASS, LIST_ARCHIVE_SPACER_TD_CLASS } from '@/components/shared/ListArchiveButton';
import { TablePagination } from '@/components/shared/table-pagination';
import { formatAddress } from '@/components/shared/detail';
import { ClaimJobCell } from './ClaimJobCell';
import { ClaimJobTypeCell } from './ClaimJobTypeCell';

type ClaimTab = ClaimsListTab;

const PAGE_SIZE = 20;

function claimListAddress(claim: Claim): string {
  return formatAddress(claim.address as Record<string, unknown> | undefined, {
    fallback: { suburb: claim.addressSuburb },
  });
}

function formatDate(value?: string | null): string {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString();
}

type ColumnSortField =
  | 'claim_number'
  | 'job_type'
  | 'status'
  | 'archive_state'
  | 'insured'
  | 'policy'
  | 'address'
  | 'account'
  | 'lodgement_date'
  | 'updated_at';

type ColumnKey = ColumnSortField | 'jobs';

interface ColumnDef {
  key: ColumnKey;
  label: string;
  filterable?: boolean;
  locked?: boolean;
  sortable?: boolean;
  defaultHidden?: boolean;
}

const TABLE_COLUMNS: ColumnDef[] = [
  { key: 'claim_number', label: 'Claim #', locked: true },
  { key: 'jobs', label: 'Job', sortable: false },
  { key: 'job_type', label: 'Job Type', filterable: true },
  { key: 'status', label: 'Status', filterable: true },
  { key: 'archive_state', label: 'State', filterable: true, sortable: false },
  { key: 'insured', label: 'Client / Insured' },
  { key: 'policy', label: 'Policy', defaultHidden: true },
  { key: 'address', label: 'Address' },
  { key: 'account', label: 'Account', filterable: true },
  { key: 'lodgement_date', label: 'Lodged' },
  { key: 'updated_at', label: 'Updated' },
];

function getClaimSortValue(
  claim: Claim,
  field: ColumnSortField,
): string | null | undefined {
  switch (field) {
    case 'claim_number':
      return claim.claimNumber ?? claim.externalReference ?? claim.id;
    case 'job_type':
      return claim.jobs?.[0]?.jobType?.name ?? null;
    case 'status':
      return (claim.status as { name?: string })?.name;
    case 'insured':
      return claim.insuredName;
    case 'policy':
      return claim.policyNumber ?? claim.policyName;
    case 'address':
      return claimListAddress(claim) || null;
    case 'account':
      return (claim.account as { name?: string })?.name;
    case 'lodgement_date':
      return claim.lodgementDate;
    case 'updated_at':
      return claim.updatedAt;
    default:
      return null;
  }
}

export interface ClaimsListClientProps {
  initialData: PaginatedResponse<Claim>;
  initialFetchKey: string;
  statusOptions: { id: string; name: string }[];
  accountOptions: { id: string; name: string }[];
  jobTypes?: { id: string; name?: string }[];
  /** Logged-in org user id — required for the My Claims tab filter. */
  currentUserId?: string | null;
  /**
   * `page` (default): full claims list with URL sync + page header.
   * `picker`: embedded list for drawers; no URL sync / page header.
   */
  variant?: 'page' | 'picker';
  /** Highlight the current claim in picker mode. */
  selectedClaimId?: string;
  /** When set (picker), called instead of navigating to `/claims/:id`. */
  onClaimSelect?: (claim: Claim) => void;
  /** Extra class on the outer wrapper (e.g. drawer padding). */
  className?: string;
}

export function ClaimsListClient({
  initialData,
  initialFetchKey,
  statusOptions,
  accountOptions,
  jobTypes = [],
  currentUserId,
  variant = 'page',
  selectedClaimId,
  onClaimSelect,
  className,
}: ClaimsListClientProps) {
  const isPicker = variant === 'picker';
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data, setData, beginFetch, abortFetch } = useListPageData(initialData, {
    initialFetchKey,
  });
  const initialArchiveStateFilter = useMemo(
    () =>
      isPicker
        ? { selected: new Set<string>(), active: false }
        : columnFilterFromValuesParam(searchParams.get('archiveState')),
    [isPicker, searchParams],
  );
  const [search, setSearch] = useState(() =>
    isPicker ? '' : (searchParams.get('search') ?? ''),
  );
  const [debouncedSearch, setDebouncedSearch] = useState(search);
  const [sort, setSort] = useState(() =>
    isPicker
      ? DEFAULT_CLAIMS_SORT
      : normalizeSortParam(searchParams.get('sort')),
  );
  const assignedToUserId = searchParams.get('assignedToUserId');
  const legacyMineTab =
    !isPicker &&
    !!assignedToUserId &&
    !!currentUserId &&
    assignedToUserId === currentUserId;
  const [tab, setTab] = usePersistedListTab<ClaimTab>({
    storageKey: 'claims',
    urlTab: isPicker ? null : searchParams.get('tab'),
    parse: parseClaimsListTab,
    fallbackTab: legacyMineTab ? 'mine' : undefined,
    disabled: isPicker,
  });
  const [page, setPage] = useState(() => {
    if (isPicker) return 1;
    const p = parseInt(searchParams.get('page') ?? '1', 10);
    return Number.isFinite(p) && p > 0 ? p : 1;
  });
  const [columnSort, setColumnSort] = useState<{
    field: ColumnSortField;
    order: 'asc' | 'desc';
  } | null>(null);
  const [accountFilter, setAccountFilter] = useState<Set<string>>(new Set());
  const [accountFilterActive, setAccountFilterActive] = useState(false);
  const [statusFilter, setStatusFilter] = useState<Set<string>>(new Set());
  const [statusFilterActive, setStatusFilterActive] = useState(false);
  const [typeFilter, setTypeFilter] = useState<Set<string>>(new Set());
  const [typeFilterActive, setTypeFilterActive] = useState(false);
  const [archiveStateFilter, setArchiveStateFilter] = useState(initialArchiveStateFilter.selected);
  const [archiveStateFilterActive, setArchiveStateFilterActive] = useState(
    initialArchiveStateFilter.active,
  );
  const [filtersHydrated, setFiltersHydrated] = useState(isPicker);

  const isMineTab = isClaimsMineTab(tab);
  const showArchiveStateColumn = isMineTab;

  const listColumns = useMemo(
    () =>
      TABLE_COLUMNS.filter(
        (col) => col.key !== 'archive_state' || showArchiveStateColumn,
      ),
    [showArchiveStateColumn],
  );

  const { isVisible, toggle, visibleCount } = useColumnVisibility(
    'claims-v2',
    listColumns,
  );

  const assignedToUserIdParam = useMemo(
    () => (isMineTab && currentUserId ? currentUserId : undefined),
    [isMineTab, currentUserId],
  );

  const tabStatusIds = useMemo(() => {
    if (isMineTab) return undefined;
    return statusIdsForArchiveListTab(tab as ArchiveListTab, statusOptions);
  }, [isMineTab, tab, statusOptions]);

  const typeOptions = useMemo(
    () =>
      jobTypes
        .map((t) => ({
          id: t.id,
          name: t.name?.trim() ? t.name.trim() : 'Unknown',
        }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [jobTypes],
  );

  const typeNames = useMemo(
    () => [...new Set(typeOptions.map((t) => t.name))].sort((a, b) => a.localeCompare(b)),
    [typeOptions],
  );

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    if (isPicker || filtersHydrated) return;
    if (searchParams.get('jobType') && typeOptions.length === 0) return;

    const hydrated = columnFilterFromIdsParam(
      searchParams.get('jobType'),
      typeOptions,
    );
    setTypeFilter(hydrated.selected);
    setTypeFilterActive(hydrated.active);
    setFiltersHydrated(true);
  }, [isPicker, filtersHydrated, searchParams, typeOptions]);

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

  const accountParam = useMemo(
    () => columnFilterToIdsParam(accountFilterActive, accountFilter, accountOptions),
    [accountFilterActive, accountFilter, accountOptions],
  );

  const jobTypeParam = useMemo(
    () => columnFilterToIdsParam(typeFilterActive, typeFilter, typeOptions),
    [typeFilterActive, typeFilter, typeOptions],
  );

  const runClaimsFetch = (fetchKey: string) => {
    const session = createListFetchSession({ fetchKey, beginFetch, abortFetch });
    if (!session) return undefined;

    setColumnSort(null);

    if (
      statusParam === null ||
      accountParam === null ||
      jobTypeParam === null ||
      (isMineTab && !currentUserId)
    ) {
      setData({ data: [], total: 0 });
      return session.cleanup;
    }

    fetchClaimsAction({
      search: debouncedSearch || undefined,
      sort,
      status: statusParam,
      account: accountParam,
      jobType: jobTypeParam,
      page,
      limit: PAGE_SIZE,
      assignedToUserId: assignedToUserIdParam,
    }).then((res) => {
      if (!session.cancelled && res) setData(res);
    });

    return session.cleanup;
  };

  const fetchDeps = [
    filtersHydrated,
    debouncedSearch,
    sort,
    tab,
    statusParam,
    accountParam,
    jobTypeParam,
    assignedToUserIdParam,
    archiveStateFilterActive,
    archiveStateFilter,
    isMineTab,
    currentUserId,
    page,
    beginFetch,
    abortFetch,
    setData,
  ] as const;

  const fetchKey = buildClaimsListFetchKey({
    search: debouncedSearch,
    sort,
    tab,
    page,
    status: statusParam,
    account: accountParam,
    jobType: jobTypeParam,
    assignedToUserId: assignedToUserIdParam,
    archiveState: isMineTab
      ? columnFilterToValuesParam(archiveStateFilterActive, archiveStateFilter)
      : undefined,
  });

  // Page list: sync URL first, then fetch once the query string has settled.
  useEffect(() => {
    if (isPicker || !filtersHydrated) return;

    const params = new URLSearchParams(searchParams.toString());
    if (debouncedSearch) params.set('search', debouncedSearch);
    else params.delete('search');
    if (sort !== 'updated_at_desc') params.set('sort', sort);
    else params.delete('sort');
    if (page > 1) params.set('page', String(page));
    else params.delete('page');
    if (tab !== 'active') params.set('tab', tab);
    else params.delete('tab');
    params.delete('assignedToUserId');
    if (statusParam) {
      params.set('status', statusParam);
    } else {
      params.delete('status');
    }
    if (accountParam) {
      params.set('account', accountParam);
    } else {
      params.delete('account');
    }
    if (jobTypeParam) {
      params.set('jobType', jobTypeParam);
    } else {
      params.delete('jobType');
    }
    const archiveStateValuesParam = isMineTab
      ? columnFilterToValuesParam(archiveStateFilterActive, archiveStateFilter)
      : null;
    if (archiveStateValuesParam) params.set('archiveState', archiveStateValuesParam);
    else params.delete('archiveState');
    const next = params.toString();
    if (
      !replaceListQueryIfNeeded({
        router,
        pathname: '/claims',
        currentQuery: searchParams.toString(),
        nextQuery: next,
      })
    ) {
      return;
    }

    return runClaimsFetch(fetchKey);
  }, [...fetchDeps, isPicker, searchParams, router, fetchKey]);

  // Picker: isolated from parent-page URL churn.
  useEffect(() => {
    if (!isPicker || !filtersHydrated) return;
    return runClaimsFetch(fetchKey);
  }, [...fetchDeps, isPicker, fetchKey]);

  const SERVER_SORT_FIELDS = new Set(['claim_number', 'updated_at', 'created_at']);

  const handleColumnSort = (field: ColumnSortField) => {
    if (field === 'archive_state') return;
    if (SERVER_SORT_FIELDS.has(field)) {
      const serverField = field === 'lodgement_date' ? 'created_at' : field;
      const currentServerField = sort.replace(/_(?:asc|desc)$/, '');
      if (currentServerField === serverField) {
        const currentOrder = sort.endsWith('_asc') ? 'asc' : 'desc';
        setSort(`${serverField}_${currentOrder === 'asc' ? 'desc' : 'asc'}`);
      } else {
        const defaultOrder = serverField === 'claim_number' ? 'asc' : 'desc';
        setSort(`${serverField}_${defaultOrder}`);
      }
      setColumnSort(null);
      setPage(1);
      return;
    }

    setColumnSort((prev) => {
      if (prev?.field === field) {
        return { field, order: prev.order === 'asc' ? 'desc' : 'asc' };
      }
      return { field, order: 'asc' };
    });
  };

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
  };

  const handleSearchChange = (value: string) => {
    setSearch(value);
    setPage(1);
  };

  const handleTabChange = (val: string) => {
    setTab(val as ClaimTab);
    if (val !== 'mine') {
      setArchiveStateFilter(new Set());
      setArchiveStateFilterActive(false);
    }
    setPage(1);
  };

  const activeColumnField: ColumnSortField | null = columnSort
    ? columnSort.field
    : SERVER_SORT_FIELDS.has(sort.replace(/_(?:asc|desc)$/, ''))
      ? (sort.replace(/_(?:asc|desc)$/, '') as ColumnSortField)
      : null;
  const activeColumnOrder: 'asc' | 'desc' = columnSort
    ? columnSort.order
    : sort.endsWith('_asc')
      ? 'asc'
      : 'desc';

  const uniqueAccounts = useMemo(() => {
    const fromOptions = accountOptions
      .map((a) => a.name?.trim())
      .filter((n): n is string => !!n);
    if (fromOptions.length > 0) {
      return [...new Set(fromOptions)].sort((a, b) => a.localeCompare(b));
    }
    const names = new Set<string>();
    for (const claim of data.data) {
      const name = (claim.account as { name?: string })?.name?.trim();
      if (name) names.add(name);
    }
    return [...names].sort((a, b) => a.localeCompare(b));
  }, [data.data, accountOptions]);

  const uniqueStatuses = useMemo(() => {
    const fromOptions = statusOptions
      .map((s) => s.name?.trim())
      .filter((n): n is string => !!n);
    return [...new Set(fromOptions)].sort((a, b) => a.localeCompare(b));
  }, [statusOptions]);

  const toggleAccount = (name: string) => {
    const working = accountFilterActive
      ? new Set(accountFilter)
      : new Set(uniqueAccounts);
    if (working.has(name)) working.delete(name);
    else working.add(name);
    const committed = commitColumnFilterSelection({
      next: working,
      optionCount: uniqueAccounts.length,
    });
    setAccountFilter(committed.selected);
    setAccountFilterActive(committed.active);
    setPage(1);
  };

  const applyStatusFilter = (next: Set<string>) => {
    const committed = commitColumnFilterSelection({
      next,
      optionCount: uniqueStatuses.length,
    });
    setStatusFilter(committed.selected);
    setStatusFilterActive(committed.active);
    setPage(1);
  };

  const applyAccountFilter = (next: Set<string>) => {
    const committed = commitColumnFilterSelection({
      next,
      optionCount: uniqueAccounts.length,
    });
    setAccountFilter(committed.selected);
    setAccountFilterActive(committed.active);
    setPage(1);
  };

  const applyTypeFilter = (next: Set<string>) => {
    const committed = commitColumnFilterSelection({
      next,
      optionCount: typeNames.length,
    });
    setTypeFilter(committed.selected);
    setTypeFilterActive(committed.active);
    setPage(1);
  };

  const filteredAndSortedData = useMemo(() => {
    const rows = data.data;
    if (!columnSort) return rows;
    const isDate = columnSort.field === 'lodgement_date' || columnSort.field === 'updated_at';
    return [...rows].sort((a, b) => {
      const aVal = getClaimSortValue(a, columnSort.field);
      const bVal = getClaimSortValue(b, columnSort.field);
      return isDate
        ? compareDates(aVal, bVal, columnSort.order)
        : compareValues(aVal, bVal, columnSort.order);
    });
  }, [data.data, columnSort]);

  const breakdown = computeStatusBreakdown(
    data.data,
    (c) => (c.status as { name?: string } | undefined)?.name,
  );

  const statusFilterProps = {
    options: uniqueStatuses,
    selected: statusFilter,
    active: statusFilterActive,
    onApply: applyStatusFilter,
    menuTitle: 'Filter by status',
    itemNoun: { singular: 'status', plural: 'statuses' },
  };

  const accountFilterProps = {
    options: uniqueAccounts,
    selected: accountFilter,
    active: accountFilterActive,
    onApply: applyAccountFilter,
    menuTitle: 'Filter by account',
    itemNoun: { singular: 'account', plural: 'accounts' },
  };

  const jobTypeFilterProps = {
    options: typeNames,
    selected: typeFilter,
    active: typeFilterActive,
    onApply: applyTypeFilter,
    menuTitle: 'Filter by job type',
    itemNoun: { singular: 'job type', plural: 'job types' },
  };

  const archiveStateNames = useMemo(() => ['Active', 'Archived'], []);

  const applyArchiveStateFilter = (next: Set<string>) => {
    const committed = commitColumnFilterSelection({
      next,
      optionCount: archiveStateNames.length,
    });
    setArchiveStateFilter(committed.selected);
    setArchiveStateFilterActive(committed.active);
    setPage(1);
  };

  const archiveStateFilterProps = {
    options: archiveStateNames,
    selected: archiveStateFilter,
    active: archiveStateFilterActive,
    onApply: applyArchiveStateFilter,
    menuTitle: 'Filter by state',
    itemNoun: { singular: 'state', plural: 'states' },
  };

  const visibleTableColumns = useMemo(
    () => listColumns.filter((col) => isVisible(col.key)),
    [listColumns, isVisible],
  );

  const handleRowClick = (claim: Claim) => {
    if (onClaimSelect) {
      onClaimSelect(claim);
      return;
    }
    router.push(`/claims/${claim.id}`);
  };

  return (
    <div
      className={`flex min-h-0 flex-1 flex-col${className ? ` ${className}` : ''}`}
      style={{ height: '100%' }}
    >
      {!isPicker && (
        <SetPageHeader>
          <ListPageHeader
            icon={FileText}
            title="Claims"
            total={data.total}
            showing={data.data.length}
            search={debouncedSearch}
            breakdown={breakdown}
            accent="blue"
          />
        </SetPageHeader>
      )}
      <div
        className={`flex flex-col gap-4 pb-4 pt-1 ${
          isPicker
            ? 'sticky top-0 z-10 border-b border-slate-200 bg-background px-4'
            : 'px-6'
        }`}
      >
        {isPicker && (
          <p className="text-sm text-slate-500">
            Showing {filteredAndSortedData.length.toLocaleString()} of{' '}
            {data.total.toLocaleString()} claims
            {debouncedSearch ? (
              <>
                {' '}
                matching &ldquo;{debouncedSearch}&rdquo;
              </>
            ) : null}
          </p>
        )}
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
          <Tabs
            value={tab}
            onValueChange={handleTabChange}
          >
            <TabsList>
              {!isPicker && <TabsTrigger value="mine">My Claims</TabsTrigger>}
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
              placeholder="Search by claim #, job, client/insured, address, or policy no..."
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
            options={uniqueAccounts}
            selected={accountFilterActive ? accountFilter : new Set(uniqueAccounts)}
            onToggle={toggleAccount}
            onClearAll={() => {
              setAccountFilter(new Set());
              setAccountFilterActive(false);
              setPage(1);
            }}
            onSelectAll={() => {
              setAccountFilter(new Set());
              setAccountFilterActive(false);
              setPage(1);
            }}
            emptyLabel="All accounts"
            menuTitle="Filter by account"
            itemNoun={{ singular: 'account', plural: 'accounts' }}
          />
        </div>
      </div>

      <div
        className={`flex-1 pb-6 ${isPicker ? 'px-4' : 'px-6'}`}
        style={{ minHeight: 0, overflow: 'auto' }}
      >
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50">
                <tr className="text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                  {visibleTableColumns.map((col) => {
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
                    if (col.sortable === false) {
                      return (
                        <th key={col.key} scope="col" className="px-4 py-3">
                          {col.label}
                        </th>
                      );
                    }
                    return (
                      <SortableColumnHeader
                        key={col.key}
                        columnKey={col.key as ColumnSortField}
                        label={col.label}
                        activeField={activeColumnField}
                        sortOrder={activeColumnOrder}
                        onSort={handleColumnSort}
                        filter={
                          col.key === 'status'
                            ? statusFilterProps
                            : col.key === 'account'
                              ? accountFilterProps
                              : col.key === 'job_type'
                                ? jobTypeFilterProps
                                : undefined
                        }
                      />
                    );
                  })}
                  {!isPicker && (
                    <th scope="col" className={LIST_ARCHIVE_TH_CLASS}>
                      <span className="sr-only">Actions</span>
                    </th>
                  )}
                  <ColumnSettingsHeaderCell
                    columns={listColumns}
                    isVisible={isVisible}
                    onToggle={toggle}
                  />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredAndSortedData.length === 0 ? (
                  <TableEmptyRow
                    colSpan={visibleCount + (isPicker ? 1 : 2)}
                    label="No claims found."
                  />
                ) : (
                  filteredAndSortedData.map((claim) => {
                  const claimNo =
                    claim.claimNumber ?? claim.externalReference ?? claim.id;
                  const statusName =
                    (claim.status as { name?: string })?.name ?? 'Unknown';
                  const accountName =
                    (claim.account as { name?: string })?.name ?? '';
                  const policy =
                    claim.policyNumber ?? claim.policyName ?? '';
                  const isSelected = selectedClaimId === claim.id;

                  return (
                    <tr
                      key={claim.id}
                      onClick={() => handleRowClick(claim)}
                      className={`cursor-pointer transition-colors hover:bg-slate-50 ${
                        isSelected
                          ? 'bg-emerald-50 ring-1 ring-inset ring-emerald-200'
                          : ''
                      }`}
                    >
                      {isVisible('claim_number') && (
                        <td className="whitespace-nowrap px-4 py-3 font-medium text-slate-900">
                          {claimNo}
                        </td>
                      )}
                      {isVisible('jobs') && (
                        <td className="relative overflow-visible whitespace-nowrap px-4 py-3">
                          <ClaimJobCell jobs={claim.jobs} />
                        </td>
                      )}
                      {isVisible('job_type') && (
                        <td className="whitespace-nowrap px-4 py-3">
                          <ClaimJobTypeCell jobs={claim.jobs} />
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
                      {isVisible('insured') && (
                        <td className="px-4 py-3 text-slate-600">
                          {claim.insuredName?.trim() || '—'}
                        </td>
                      )}
                      {isVisible('policy') && (
                        <td className="px-4 py-3 text-slate-600">{policy}</td>
                      )}
                      {isVisible('address') && (
                        <td className="px-4 py-3 text-slate-600">
                          {claimListAddress(claim)}
                        </td>
                      )}
                      {isVisible('account') && (
                        <td className="px-4 py-3 text-slate-600">
                          {accountName}
                        </td>
                      )}
                      {isVisible('lodgement_date') && (
                        <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                          {formatDate(claim.lodgementDate)}
                        </td>
                      )}
                      {isVisible('updated_at') && (
                        <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                          {formatDate(claim.updatedAt)}
                        </td>
                      )}
                      {!isPicker && (
                        <td
                          className={LIST_ARCHIVE_TD_CLASS}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <ListArchiveButton
                            entityType="claim"
                            entityId={claim.id}
                            statusName={statusName}
                            entityLabel={claimNo}
                            onArchived={(id) => {
                              setData((prev) => ({
                                ...prev,
                                data: prev.data.filter((row) => row.id !== id),
                                total: Math.max(0, prev.total - 1),
                              }));
                            }}
                          />
                        </td>
                      )}
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
