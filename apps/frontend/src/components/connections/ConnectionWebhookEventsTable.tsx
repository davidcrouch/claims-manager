'use client';

import { useState, useEffect, useCallback } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { StatusBadge } from '@/components/ui/status-badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { fetchConnectionWebhookEventsAction } from '@/app/(app)/connections/actions';
import type { WebhookEvent, PaginatedResponse } from '@/types/api';

function statusVariant(status: string): 'active' | 'inactive' | 'custom' {
  if (status === 'processed') return 'active';
  if (status === 'failed') return 'inactive';
  return 'custom';
}

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
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
  const [statusFilter, setStatusFilter] = useState('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const limit = 10;

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    const result = await fetchConnectionWebhookEventsAction(connectionId, {
      page,
      limit,
      status: statusFilter === 'all' ? undefined : statusFilter,
    });
    setData(result);
    setLoading(false);
  }, [connectionId, page, statusFilter]);

  useEffect(() => {
    void fetchEvents();
  }, [fetchEvents]);

  const totalPages = data ? Math.ceil(data.total / limit) : 0;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {data ? `${data.total} event${data.total !== 1 ? 's' : ''}` : ''}
        </p>
        <Select
          value={statusFilter}
          onValueChange={(v) => {
            if (v) setStatusFilter(v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-[130px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="processed">Processed</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
          Loading events...
        </div>
      ) : !data || data.data.length === 0 ? (
        <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
          No webhook events found.
        </div>
      ) : (
        <div className="rounded-md border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="w-8 px-2 py-2" />
                <th className="px-3 py-2 text-left font-medium">Event Type</th>
                <th className="px-3 py-2 text-left font-medium">Entity ID</th>
                <th className="px-3 py-2 text-left font-medium">Status</th>
                <th className="px-3 py-2 text-left font-medium">HMAC</th>
                <th className="px-3 py-2 text-left font-medium">Created</th>
              </tr>
            </thead>
            <tbody>
              {data.data.map((event) => (
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
          <span className="text-sm text-muted-foreground">
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
        className="border-b cursor-pointer hover:bg-muted/30 transition-colors"
        onClick={onToggle}
      >
        <td className="px-2 py-2">
          {expanded ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
        </td>
        <td className="px-3 py-2 font-mono text-xs">{event.eventType}</td>
        <td className="px-3 py-2 font-mono text-xs truncate max-w-[140px]">
          {event.payloadEntityId ?? '—'}
        </td>
        <td className="px-3 py-2">
          <StatusBadge
            status={event.processingStatus}
            variant={statusVariant(event.processingStatus)}
          />
        </td>
        <td className="px-3 py-2">
          {event.hmacVerified === true ? (
            <span className="text-emerald-600">✓</span>
          ) : event.hmacVerified === false ? (
            <span className="text-destructive">✗</span>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </td>
        <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">
          {formatTimestamp(event.createdAt)}
        </td>
      </tr>
      {expanded && (
        <tr className="border-b bg-muted/20">
          <td colSpan={6} className="px-4 py-3">
            {event.processingError && (
              <p className="mb-2 text-sm text-destructive">
                Error: {event.processingError}
              </p>
            )}
            <details open>
              <summary className="cursor-pointer text-xs font-medium text-muted-foreground mb-1">
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
