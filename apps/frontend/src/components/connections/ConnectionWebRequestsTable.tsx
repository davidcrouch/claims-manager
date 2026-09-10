'use client';

import { useState, useEffect, useMemo } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  SortTabs,
  SearchInput,
  SortableColumnHeader,
  TableEmptyRow,
  commitColumnFilterSelection,
  columnFilterToValuesParam,
  buildColumnFilterOptions,
  type SortOption,
  type StatusOption,
  buildSortString,
  parseSort,
  COLUMN_FILTER_BLANK,
} from '@/components/shared/list-filters';
import {
  fetchConnectionWebRequestsAction,
  fetchConnectionWebRequestFilterOptionsAction,
} from '@/app/(app)/connections/actions';
import {
  createListFetchSession,
  useListFetchGate,
} from '@/components/shared/use-list-page-data';
import type { WebRequest, PaginatedResponse } from '@/types/api';
import { CopyablePayload, CopyIconButton } from './CopyablePayload';

const SORT_OPTIONS: SortOption[] = [
  { key: 'created_at', label: 'Created' },
  { key: 'http_method', label: 'Method' },
  { key: 'entity_type', label: 'Entity' },
  { key: 'initiated_by_name', label: 'User' },
  { key: 'status_code', label: 'Status' },
  { key: 'duration_ms', label: 'Duration' },
];
const ALLOWED_SORT_FIELDS = SORT_OPTIONS.map((o) => o.key);

const OUTCOME_OPTIONS: StatusOption[] = [
  { id: 'success', name: 'Success' },
  { id: 'failed', name: 'Failed' },
];
const OUTCOME_FILTER_OPTIONS = OUTCOME_OPTIONS.map((option) => option.name);
const OUTCOME_NAME_BY_ID = new Map(OUTCOME_OPTIONS.map((option) => [option.id, option.name]));
const OUTCOME_ID_BY_NAME = new Map(OUTCOME_OPTIONS.map((option) => [option.name, option.id]));

const METHOD_OPTIONS = ['GET', 'POST'];

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function outcomeBadgeClass(outcome: string): string {
  switch (outcome) {
    case 'success':
      return 'bg-emerald-100 text-emerald-700';
    case 'failed':
      return 'bg-rose-100 text-rose-700';
    default:
      return 'bg-slate-100 text-slate-700';
  }
}

function methodBadgeClass(method: string): string {
  return method === 'POST'
    ? 'bg-violet-100 text-violet-700'
    : 'bg-slate-100 text-slate-700';
}

export interface ConnectionWebRequestsTableProps {
  connectionId: string;
  onTotalChange?: (total: number) => void;
}

export function ConnectionWebRequestsTable({
  connectionId,
  onTotalChange,
}: ConnectionWebRequestsTableProps) {
  const [data, setData] = useState<PaginatedResponse<WebRequest> | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [sort, setSort] = useState<string>(
    buildSortString('created_at', 'desc'),
  );
  const [outcomeFilter, setOutcomeFilter] = useState<Set<string>>(new Set());
  const [outcomeFilterActive, setOutcomeFilterActive] = useState(false);
  const [methodFilter, setMethodFilter] = useState<Set<string>>(new Set());
  const [methodFilterActive, setMethodFilterActive] = useState(false);
  const [entityTypeFilter, setEntityTypeFilter] = useState<Set<string>>(new Set());
  const [entityTypeFilterActive, setEntityTypeFilterActive] = useState(false);
  const [entityTypeOptions, setEntityTypeOptions] = useState<string[]>([]);
  const [userFilter, setUserFilter] = useState<Set<string>>(new Set());
  const [userFilterActive, setUserFilterActive] = useState(false);
  const [userOptions, setUserOptions] = useState<string[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const { beginFetch, abortFetch } = useListFetchGate();
  const limit = 20;

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const outcomeParam = useMemo(() => {
    const names = columnFilterToValuesParam(outcomeFilterActive, outcomeFilter);
    if (names === undefined || names === null) return names;
    return names
      .split(',')
      .map((name) => OUTCOME_ID_BY_NAME.get(name) ?? name)
      .filter(Boolean)
      .sort()
      .join(',');
  }, [outcomeFilterActive, outcomeFilter]);

  const methodParam = useMemo(
    () => columnFilterToValuesParam(methodFilterActive, methodFilter),
    [methodFilterActive, methodFilter],
  );

  const entityTypeParam = useMemo(
    () => columnFilterToValuesParam(entityTypeFilterActive, entityTypeFilter),
    [entityTypeFilterActive, entityTypeFilter],
  );

  const userParam = useMemo(() => {
    const names = columnFilterToValuesParam(userFilterActive, userFilter);
    if (names === undefined || names === null) return names;
    return names
      .split(',')
      .map((name) => (name === COLUMN_FILTER_BLANK ? '__blank__' : name))
      .filter(Boolean)
      .sort()
      .join(',');
  }, [userFilterActive, userFilter]);

  useEffect(() => {
    setOutcomeFilter(new Set());
    setOutcomeFilterActive(false);
    setMethodFilter(new Set());
    setMethodFilterActive(false);
    setEntityTypeFilter(new Set());
    setEntityTypeFilterActive(false);
    setUserFilter(new Set());
    setUserFilterActive(false);
    void fetchConnectionWebRequestFilterOptionsAction(connectionId).then(
      (result) => {
        setEntityTypeOptions(result?.entityTypes ?? []);
        setUserOptions(result?.users ?? []);
      },
    );
  }, [connectionId]);

  useEffect(() => {
    const fetchKey = `${connectionId}|${page}|${debouncedSearch}|${sort}|${outcomeParam ?? ''}|${methodParam ?? ''}|${entityTypeParam ?? ''}|${userParam ?? ''}`;
    const session = createListFetchSession({ fetchKey, beginFetch, abortFetch });
    if (!session) return;

    if (outcomeParam === null || methodParam === null || entityTypeParam === null || userParam === null) {
      setData({ data: [], total: 0 });
      setLoading(false);
      return session.cleanup;
    }

    setLoading(true);
    void fetchConnectionWebRequestsAction(connectionId, {
      page,
      limit,
      outcome: outcomeParam || undefined,
      method: methodParam || undefined,
      entityType: entityTypeParam,
      user: userParam || undefined,
      search: debouncedSearch || undefined,
      sort,
    }).then((result) => {
      if (session.cancelled) return;
      setData(result);
      if (result) onTotalChange?.(result.total);
      setLoading(false);
    });
    return session.cleanup;
  }, [connectionId, page, debouncedSearch, sort, outcomeParam, methodParam, entityTypeParam, userParam, beginFetch, abortFetch, limit]);

  const { field: activeSortField, order: sortOrder } = parseSort({
    sortParam: sort,
    allowedFields: ALLOWED_SORT_FIELDS,
    defaultField: 'created_at',
  });

  const handleSort = (field: string) => {
    if (activeSortField === field) {
      setSort(buildSortString(field, sortOrder === 'asc' ? 'desc' : 'asc'));
    } else {
      const defaultOrder = field === 'created_at' || field === 'duration_ms' ? 'desc' : 'asc';
      setSort(buildSortString(field, defaultOrder));
    }
    setPage(1);
  };

  const uniqueEntityTypes = useMemo(
    () =>
      buildColumnFilterOptions(
        [...entityTypeOptions, ...(data?.data ?? []).map((row) => row.entityType ?? '')],
        { alwaysIncludeBlank: false },
      ),
    [entityTypeOptions, data],
  );

  const applyEntityTypeFilter = (next: Set<string>) => {
    const committed = commitColumnFilterSelection({
      next,
      optionCount: uniqueEntityTypes.length,
    });
    setEntityTypeFilter(committed.selected);
    setEntityTypeFilterActive(committed.active);
    setPage(1);
  };

  const uniqueUsers = useMemo(
    () =>
      buildColumnFilterOptions(
        [...userOptions, ...(data?.data ?? []).map((row) => row.initiatedByName)],
        { alwaysIncludeBlank: true },
      ),
    [userOptions, data],
  );

  const applyUserFilter = (next: Set<string>) => {
    const committed = commitColumnFilterSelection({
      next,
      optionCount: uniqueUsers.length,
    });
    setUserFilter(committed.selected);
    setUserFilterActive(committed.active);
    setPage(1);
  };

  const uniqueOutcomes = useMemo(
    () =>
      buildColumnFilterOptions(
        [
          ...OUTCOME_FILTER_OPTIONS,
          ...(data?.data ?? []).map(
            (row) => OUTCOME_NAME_BY_ID.get(row.outcome) ?? row.outcome,
          ),
        ],
        { alwaysIncludeBlank: false },
      ),
    [data],
  );

  const applyOutcomeFilter = (next: Set<string>) => {
    const committed = commitColumnFilterSelection({
      next,
      optionCount: uniqueOutcomes.length,
    });
    setOutcomeFilter(committed.selected);
    setOutcomeFilterActive(committed.active);
    setPage(1);
  };

  const uniqueMethods = useMemo(
    () =>
      buildColumnFilterOptions(
        [...METHOD_OPTIONS, ...(data?.data ?? []).map((row) => row.httpMethod)],
        { alwaysIncludeBlank: false },
      ),
    [data],
  );

  const applyMethodFilter = (next: Set<string>) => {
    const committed = commitColumnFilterSelection({
      next,
      optionCount: uniqueMethods.length,
    });
    setMethodFilter(committed.selected);
    setMethodFilterActive(committed.active);
    setPage(1);
  };

  const visibleRows = data?.data ?? [];
  const totalPages = data ? Math.max(1, Math.ceil(data.total / limit)) : 1;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
        <SortTabs
          options={SORT_OPTIONS}
          activeField={activeSortField}
          sortOrder={sortOrder}
          onSort={handleSort}
        />

        <SearchInput
          placeholder="Search by path, entity, or user..."
          value={search}
          onChange={(value) => {
            setSearch(value);
            setPage(1);
          }}
        />
      </div>

      {loading ? (
        <div className="flex h-32 items-center justify-center rounded-lg border border-slate-200 bg-white text-sm text-slate-400">
          Loading requests...
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr className="text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                <th scope="col" className="w-8 px-2 py-3" aria-label="Expand" />
                <SortableColumnHeader
                  columnKey="http_method"
                  label="Method"
                  activeField={activeSortField}
                  sortOrder={sortOrder}
                  onSort={handleSort}
                  filter={{
                    options: uniqueMethods,
                    selected: methodFilter,
                    active: methodFilterActive,
                    onApply: applyMethodFilter,
                    menuTitle: 'Filter by method',
                    itemNoun: { singular: 'method', plural: 'methods' },
                  }}
                />
                <th scope="col" className="px-4 py-3">Path</th>
                <SortableColumnHeader
                  columnKey="entity_type"
                  label="Entity"
                  activeField={activeSortField}
                  sortOrder={sortOrder}
                  onSort={handleSort}
                  filter={{
                    options: uniqueEntityTypes,
                    selected: entityTypeFilter,
                    active: entityTypeFilterActive,
                    onApply: applyEntityTypeFilter,
                    menuTitle: 'Filter by entity type',
                    itemNoun: { singular: 'entity type', plural: 'entity types' },
                  }}
                />
                <SortableColumnHeader
                  columnKey="initiated_by_name"
                  label="User"
                  activeField={activeSortField}
                  sortOrder={sortOrder}
                  onSort={handleSort}
                  filter={{
                    options: uniqueUsers,
                    selected: userFilter,
                    active: userFilterActive,
                    onApply: applyUserFilter,
                    menuTitle: 'Filter by user',
                    itemNoun: { singular: 'user', plural: 'users' },
                  }}
                />
                <SortableColumnHeader
                  columnKey="status_code"
                  label="Status"
                  activeField={activeSortField}
                  sortOrder={sortOrder}
                  onSort={handleSort}
                  filter={{
                    options: uniqueOutcomes,
                    selected: outcomeFilter,
                    active: outcomeFilterActive,
                    onApply: applyOutcomeFilter,
                    menuTitle: 'Filter by status',
                    itemNoun: { singular: 'status', plural: 'statuses' },
                  }}
                />
                <th scope="col" className="px-4 py-3">Duration</th>
                <th scope="col" className="px-4 py-3">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visibleRows.length === 0 ? (
                <TableEmptyRow colSpan={8} label="No web requests found." />
              ) : (
                visibleRows.map((row) => (
                  <RequestRow
                    key={row.id}
                    request={row}
                    expanded={expandedId === row.id}
                    onToggle={() =>
                      setExpandedId(expandedId === row.id ? null : row.id)
                    }
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            Previous
          </Button>
          <span className="text-sm text-slate-500">
            Page {page} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}

function RequestRow({
  request,
  expanded,
  onToggle,
}: {
  request: WebRequest;
  expanded: boolean;
  onToggle: () => void;
}) {
  const entityLabel = [request.entityType, request.entityId]
    .filter(Boolean)
    .join(' / ') || '—';
  const requestUrl = formatRequestUrl(request.url, request.queryParams);

  return (
    <>
      <tr
        className="cursor-pointer transition-colors hover:bg-slate-50"
        onClick={onToggle}
      >
        <td className="px-2 py-3">
          {expanded ? (
            <ChevronDown className="h-4 w-4 text-slate-400" />
          ) : (
            <ChevronRight className="h-4 w-4 text-slate-400" />
          )}
        </td>
        <td className="whitespace-nowrap px-4 py-3">
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${methodBadgeClass(
              request.httpMethod,
            )}`}
          >
            {request.httpMethod}
          </span>
        </td>
        <td className="max-w-[280px] truncate px-4 py-3 font-mono text-xs text-slate-900">
          {request.path}
        </td>
        <td className="max-w-[220px] truncate px-4 py-3 font-mono text-xs text-slate-600">
          {entityLabel}
        </td>
        <td className="max-w-[180px] truncate px-4 py-3 text-xs text-slate-700">
          {request.initiatedByName || '—'}
        </td>
        <td className="whitespace-nowrap px-4 py-3">
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${outcomeBadgeClass(
              request.outcome,
            )}`}
          >
            {request.statusCode != null
              ? `${request.statusCode} ${OUTCOME_NAME_BY_ID.get(request.outcome) ?? request.outcome}`
              : (OUTCOME_NAME_BY_ID.get(request.outcome) ?? request.outcome)}
          </span>
        </td>
        <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-600">
          {request.durationMs} ms
        </td>
        <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-600">
          {formatTimestamp(request.createdAt)}
        </td>
      </tr>
      {expanded && (
        <tr className="bg-slate-50">
          <td colSpan={8} className="px-4 py-3">
            <p className="mb-2 flex items-start gap-1 font-mono text-xs text-slate-500">
              <span className="min-w-0 flex-1 break-all">{requestUrl}</span>
              <CopyIconButton text={requestUrl} label="URL" />
            </p>
            {request.errorMessage && (
              <p className="mb-2 flex items-start gap-1 text-sm text-rose-700">
                <span className="min-w-0 flex-1">Error: {request.errorMessage}</span>
                <CopyIconButton text={request.errorMessage} label="Error" />
              </p>
            )}
            <div className="grid gap-3 md:grid-cols-2">
              <CopyablePayload
                label="Request Body"
                text={formatJson(request.requestBody)}
              />
              <CopyablePayload
                label="Response Body"
                text={formatJson(request.responseBody)}
              />
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function formatRequestUrl(url: string, queryParams: unknown): string {
  const entries =
    queryParams && typeof queryParams === 'object' && !Array.isArray(queryParams)
      ? Object.entries(queryParams as Record<string, unknown>).filter(
          ([, value]) => value != null && String(value).length > 0,
        )
      : [];
  if (entries.length === 0) return url;
  try {
    const parsed = new URL(url);
    for (const [key, value] of entries) {
      if (!parsed.searchParams.has(key)) {
        parsed.searchParams.append(key, String(value));
      }
    }
    return parsed.toString();
  } catch {
    const qs = new URLSearchParams(
      entries.map(([key, value]) => [key, String(value)]),
    ).toString();
    if (!qs) return url;
    const separator = url.includes('?')
      ? url.endsWith('?') || url.endsWith('&')
        ? ''
        : '&'
      : '?';
    return `${url}${separator}${qs}`;
  }
}

function formatJson(value: unknown): string {
  if (value == null) return 'No data';
  if (typeof value === 'string') {
    try {
      return JSON.stringify(JSON.parse(value), null, 2);
    } catch {
      return value;
    }
  }
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}
