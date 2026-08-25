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
} from '@/components/shared/list-filters';
import {
  fetchConnectionWebhookEventsAction,
  fetchConnectionWebhookEventFilterOptionsAction,
} from '@/app/(app)/connections/actions';
import {
  createListFetchSession,
  useListFetchGate,
} from '@/components/shared/use-list-page-data';
import type { WebhookEvent, PaginatedResponse } from '@/types/api';

const SORT_OPTIONS: SortOption[] = [
  { key: 'created_at', label: 'Created' },
  { key: 'event_type', label: 'Event Type' },
  { key: 'processing_status', label: 'Status' },
];
const ALLOWED_SORT_FIELDS = SORT_OPTIONS.map((o) => o.key);

const STATUS_OPTIONS: StatusOption[] = [
  { id: 'pending', name: 'Pending' },
  { id: 'fetched', name: 'Fetched' },
  { id: 'completed', name: 'Completed' },
  { id: 'completed_unmapped', name: 'Unmapped' },
  { id: 'dispatched', name: 'Dispatched' },
  { id: 'retry_scheduled', name: 'Retry Scheduled' },
  { id: 'fetch_failed', name: 'Fetch Failed' },
  { id: 'dispatch_failed', name: 'Dispatch Failed' },
  { id: 'mapper_failed', name: 'Mapper Failed' },
  { id: 'failed', name: 'Failed' },
];
const STATUS_FILTER_OPTIONS = STATUS_OPTIONS.map((option) => option.name);
const STATUS_NAME_BY_ID = new Map(STATUS_OPTIONS.map((option) => [option.id, option.name]));
const STATUS_ID_BY_NAME = new Map(STATUS_OPTIONS.map((option) => [option.name, option.id]));

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function statusBadgeClass(status: string): string {
  switch (status) {
    case 'completed':
      return 'bg-emerald-100 text-emerald-700';
    case 'dispatched':
    case 'fetched':
      return 'bg-sky-100 text-sky-700';
    case 'pending':
      return 'bg-amber-100 text-amber-700';
    case 'retry_scheduled':
      return 'bg-orange-100 text-orange-700';
    case 'completed_unmapped':
      return 'bg-slate-100 text-slate-600';
    case 'failed':
    case 'fetch_failed':
    case 'dispatch_failed':
    case 'mapper_failed':
      return 'bg-rose-100 text-rose-700';
    default:
      return 'bg-slate-100 text-slate-700';
  }
}

export interface ConnectionWebhookEventsTableProps {
  connectionId: string;
}

export function ConnectionWebhookEventsTable({
  connectionId,
}: ConnectionWebhookEventsTableProps) {
  const [data, setData] = useState<PaginatedResponse<WebhookEvent> | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [sort, setSort] = useState<string>(
    buildSortString('created_at', 'desc'),
  );
  const [statusFilter, setStatusFilter] = useState<Set<string>>(new Set());
  const [statusFilterActive, setStatusFilterActive] = useState(false);
  const [eventTypeFilter, setEventTypeFilter] = useState<Set<string>>(new Set());
  const [eventTypeFilterActive, setEventTypeFilterActive] = useState(false);
  const [eventTypeOptions, setEventTypeOptions] = useState<string[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const { beginFetch, abortFetch } = useListFetchGate();
  const limit = 20;

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const statusParam = useMemo(() => {
    const names = columnFilterToValuesParam(statusFilterActive, statusFilter);
    if (names === undefined || names === null) return names;
    return names
      .split(',')
      .map((name) => STATUS_ID_BY_NAME.get(name) ?? name)
      .filter(Boolean)
      .sort()
      .join(',');
  }, [statusFilterActive, statusFilter]);

  const eventTypeParam = useMemo(
    () => columnFilterToValuesParam(eventTypeFilterActive, eventTypeFilter),
    [eventTypeFilterActive, eventTypeFilter],
  );

  useEffect(() => {
    setStatusFilter(new Set());
    setStatusFilterActive(false);
    setEventTypeFilter(new Set());
    setEventTypeFilterActive(false);
    void fetchConnectionWebhookEventFilterOptionsAction(connectionId).then(
      (result) => {
        setEventTypeOptions(result?.eventTypes ?? []);
      },
    );
  }, [connectionId]);

  useEffect(() => {
    const fetchKey = `${connectionId}|${page}|${debouncedSearch}|${sort}|${statusParam ?? ''}|${eventTypeParam ?? ''}`;
    const session = createListFetchSession({ fetchKey, beginFetch, abortFetch });
    if (!session) return;

    if (eventTypeParam === null || statusParam === null) {
      setData({ data: [], total: 0 });
      setLoading(false);
      return session.cleanup;
    }

    setLoading(true);
    void fetchConnectionWebhookEventsAction(connectionId, {
      page,
      limit,
      status: statusParam || undefined,
      eventType: eventTypeParam,
      search: debouncedSearch || undefined,
      sort,
    }).then((result) => {
      if (session.cancelled) return;
      setData(result);
      setLoading(false);
    });
    return session.cleanup;
  }, [connectionId, page, debouncedSearch, sort, statusParam, eventTypeParam, beginFetch, abortFetch, limit]);

  const { field: activeSortField, order: sortOrder } = parseSort({
    sortParam: sort,
    allowedFields: ALLOWED_SORT_FIELDS,
    defaultField: 'created_at',
  });

  const handleSort = (field: string) => {
    if (activeSortField === field) {
      setSort(buildSortString(field, sortOrder === 'asc' ? 'desc' : 'asc'));
    } else {
      const defaultOrder = field === 'created_at' ? 'desc' : 'asc';
      setSort(buildSortString(field, defaultOrder));
    }
    setPage(1);
  };

  const uniqueEventTypes = useMemo(
    () =>
      buildColumnFilterOptions(
        [...eventTypeOptions, ...(data?.data ?? []).map((event) => event.eventType)],
        { alwaysIncludeBlank: false },
      ),
    [eventTypeOptions, data],
  );

  const applyEventTypeFilter = (next: Set<string>) => {
    const committed = commitColumnFilterSelection({
      next,
      optionCount: uniqueEventTypes.length,
    });
    setEventTypeFilter(committed.selected);
    setEventTypeFilterActive(committed.active);
    setPage(1);
  };

  const uniqueStatuses = useMemo(
    () =>
      buildColumnFilterOptions(
        [
          ...STATUS_FILTER_OPTIONS,
          ...(data?.data ?? []).map(
            (event) =>
              STATUS_NAME_BY_ID.get(event.processingStatus) ?? event.processingStatus,
          ),
        ],
        { alwaysIncludeBlank: false },
      ),
    [data],
  );

  const applyStatusFilter = (next: Set<string>) => {
    const committed = commitColumnFilterSelection({
      next,
      optionCount: uniqueStatuses.length,
    });
    setStatusFilter(committed.selected);
    setStatusFilterActive(committed.active);
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
          placeholder="Search by event type or entity ID..."
          value={search}
          onChange={(value) => {
            setSearch(value);
            setPage(1);
          }}
        />
      </div>

      {loading ? (
        <div className="flex h-32 items-center justify-center rounded-lg border border-slate-200 bg-white text-sm text-slate-400">
          Loading events...
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr className="text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                <th scope="col" className="w-8 px-2 py-3" aria-label="Expand" />
                <SortableColumnHeader
                  columnKey="event_type"
                  label="Event Type"
                  activeField={activeSortField}
                  sortOrder={sortOrder}
                  onSort={handleSort}
                  filter={{
                    options: uniqueEventTypes,
                    selected: eventTypeFilter,
                    active: eventTypeFilterActive,
                    onApply: applyEventTypeFilter,
                    menuTitle: 'Filter by event type',
                    itemNoun: { singular: 'event type', plural: 'event types' },
                  }}
                />
                <th scope="col" className="px-4 py-3">Entity ID</th>
                <SortableColumnHeader
                  columnKey="processing_status"
                  label="Status"
                  activeField={activeSortField}
                  sortOrder={sortOrder}
                  onSort={handleSort}
                  filter={{
                    options: uniqueStatuses,
                    selected: statusFilter,
                    active: statusFilterActive,
                    onApply: applyStatusFilter,
                    menuTitle: 'Filter by status',
                    itemNoun: { singular: 'status', plural: 'statuses' },
                  }}
                />
                <th scope="col" className="px-4 py-3">HMAC</th>
                <th scope="col" className="px-4 py-3">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visibleRows.length === 0 ? (
                <TableEmptyRow colSpan={6} label="No webhook events found." />
              ) : (
                visibleRows.map((event) => (
                  <EventRow
                    key={event.id}
                    event={event}
                    expanded={expandedId === event.id}
                    onToggle={() =>
                      setExpandedId(expandedId === event.id ? null : event.id)
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

function EventRow({
  event,
  expanded,
  onToggle,
}: {
  event: WebhookEvent;
  expanded: boolean;
  onToggle: () => void;
}) {
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
        <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-slate-900">
          {event.eventType}
        </td>
        <td className="max-w-[180px] truncate px-4 py-3 font-mono text-xs text-slate-600">
          {event.payloadEntityId ?? '—'}
        </td>
        <td className="whitespace-nowrap px-4 py-3">
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${statusBadgeClass(
              event.processingStatus,
            )}`}
          >
            {STATUS_NAME_BY_ID.get(event.processingStatus) ?? event.processingStatus}
          </span>
        </td>
        <td className="whitespace-nowrap px-4 py-3 text-slate-600">
          {event.hmacVerified === true ? (
            <span className="text-emerald-600">✓</span>
          ) : event.hmacVerified === false ? (
            <span className="text-rose-600">✗</span>
          ) : (
            <span className="text-slate-400">—</span>
          )}
        </td>
        <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-600">
          {formatTimestamp(event.createdAt)}
        </td>
      </tr>
      {expanded && (
        <tr className="bg-slate-50">
          <td colSpan={6} className="px-4 py-3">
            {event.processingError && (
              <p className="mb-2 text-sm text-rose-700">
                Error: {event.processingError}
              </p>
            )}
            <details open>
              <summary className="mb-1 cursor-pointer text-xs font-medium text-slate-500">
                Raw Payload
              </summary>
              <pre className="max-h-64 overflow-auto rounded bg-slate-900 p-3 text-xs text-slate-200">
                {event.rawBodyJson
                  ? JSON.stringify(event.rawBodyJson, null, 2)
                  : 'No payload data'}
              </pre>
            </details>
          </td>
        </tr>
      )}
    </>
  );
}
