'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  SortTabs,
  SearchInput,
  StatusFilterMenu,
  ListEmptyState,
  type SortOption,
  type StatusOption,
  buildSortString,
  parseSort,
  compareDates,
  compareValues,
} from '@/components/shared/list-filters';
import { fetchConnectionWebhookEventsAction } from '@/app/(app)/connections/actions';
import type { WebhookEvent, PaginatedResponse } from '@/types/api';

const SORT_OPTIONS: SortOption[] = [
  { key: 'created_at', label: 'Created' },
  { key: 'event_type', label: 'Event Type' },
  { key: 'processing_status', label: 'Status' },
];
const ALLOWED_SORT_FIELDS = SORT_OPTIONS.map((o) => o.key);

const STATUS_OPTIONS: StatusOption[] = [
  { id: 'pending', name: 'Pending' },
  { id: 'processed', name: 'Processed' },
  { id: 'failed', name: 'Failed' },
];

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
    case 'processed':
      return 'bg-emerald-100 text-emerald-700';
    case 'failed':
      return 'bg-rose-100 text-rose-700';
    case 'pending':
      return 'bg-amber-100 text-amber-700';
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
  const [sort, setSort] = useState<string>(
    buildSortString('created_at', 'desc'),
  );
  const [statusFilter, setStatusFilter] = useState<Set<string>>(new Set());
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const limit = 20;

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    // Backend accepts a single status; pass it only when exactly one is
    // selected. Multi-select status is filtered client-side on the page.
    const serverStatus =
      statusFilter.size === 1 ? [...statusFilter][0] : undefined;
    const result = await fetchConnectionWebhookEventsAction(connectionId, {
      page,
      limit,
      status: serverStatus,
    });
    setData(result);
    setLoading(false);
  }, [connectionId, page, statusFilter]);

  useEffect(() => {
    void fetchEvents();
  }, [fetchEvents]);

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
  };

  const setStatusChecked = (id: string, checked: boolean) => {
    setStatusFilter((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
    setPage(1);
  };

  const clearStatuses = () => {
    setStatusFilter(new Set());
    setPage(1);
  };

  const selectAllStatuses = () => {
    setStatusFilter(new Set(STATUS_OPTIONS.map((o) => o.id)));
    setPage(1);
  };

  const visibleRows = useMemo(() => {
    let rows = data?.data ?? [];

    if (statusFilter.size > 1) {
      rows = rows.filter((e) => statusFilter.has(e.processingStatus));
    }

    const q = search.trim().toLowerCase();
    if (q) {
      rows = rows.filter(
        (e) =>
          e.eventType.toLowerCase().includes(q) ||
          (e.payloadEntityId ?? '').toLowerCase().includes(q),
      );
    }

    const sorted = [...rows].sort((a, b) => {
      switch (activeSortField) {
        case 'event_type':
          return compareValues(a.eventType, b.eventType, sortOrder);
        case 'processing_status':
          return compareValues(
            a.processingStatus,
            b.processingStatus,
            sortOrder,
          );
        case 'created_at':
        default:
          return compareDates(a.createdAt, b.createdAt, sortOrder);
      }
    });

    return sorted;
  }, [data, search, statusFilter, activeSortField, sortOrder]);

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
          onChange={setSearch}
        />

        <StatusFilterMenu
          options={STATUS_OPTIONS}
          selected={statusFilter}
          onSelectionChange={setStatusChecked}
          onClearAll={clearStatuses}
          onSelectAll={selectAllStatuses}
        />
      </div>

      {loading ? (
        <div className="flex h-32 items-center justify-center rounded-lg border border-slate-200 bg-white text-sm text-slate-400">
          Loading events...
        </div>
      ) : visibleRows.length === 0 ? (
        <ListEmptyState label="No webhook events found." />
      ) : (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr className="text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                <th scope="col" className="w-8 px-2 py-3" aria-label="Expand" />
                <th scope="col" className="px-4 py-3">Event Type</th>
                <th scope="col" className="px-4 py-3">Entity ID</th>
                <th scope="col" className="px-4 py-3">Status</th>
                <th scope="col" className="px-4 py-3">HMAC</th>
                <th scope="col" className="px-4 py-3">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visibleRows.map((event) => (
                <EventRow
                  key={event.id}
                  event={event}
                  expanded={expandedId === event.id}
                  onToggle={() =>
                    setExpandedId(expandedId === event.id ? null : event.id)
                  }
                />
              ))}
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
            {event.processingStatus}
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
