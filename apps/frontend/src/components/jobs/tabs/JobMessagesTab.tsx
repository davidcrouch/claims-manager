'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { MessageSquarePlus, Check, Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MessageFormDrawer } from '@/components/forms/MessageFormDrawer';
import {
  fetchJobMessagesAction,
  acknowledgeMessageAction,
} from '@/app/(app)/jobs/[id]/actions';
import { formatDateTime } from '@/components/shared/detail';
import {
  compareDates,
  SortableColumnHeader,
} from '@/components/shared/list-filters';
import type { Message } from '@/types/api';

type ListTab = 'all' | 'pending' | 'acknowledged';

type MsgSortField = 'subject' | 'status' | 'created_at';

interface ColDef { key: MsgSortField; label: string }

const TABLE_COLUMNS: ColDef[] = [
  { key: 'subject', label: 'Subject' },
  { key: 'status', label: 'Status' },
  { key: 'created_at', label: 'Created' },
];

function getSortValue(m: Message, field: MsgSortField): string | null | undefined {
  switch (field) {
    case 'subject': return m.subject;
    case 'status': return m.acknowledgedAt ? 'Acknowledged' : 'Pending';
    case 'created_at': return m.createdAt;
    default: return null;
  }
}

export function JobMessagesTab({
  jobId,
  claimId,
}: {
  jobId: string;
  claimId: string;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [tab, setTab] = useState<ListTab>('all');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [columnSort, setColumnSort] = useState<{ field: MsgSortField; order: 'asc' | 'desc' }>({
    field: 'created_at',
    order: 'desc',
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchJobMessagesAction(jobId);
      setMessages(data ?? []);
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const handleColumnSort = (field: MsgSortField) => {
    setColumnSort((prev) => {
      if (prev.field === field) return { field, order: prev.order === 'asc' ? 'desc' : 'asc' };
      return { field, order: field === 'subject' ? 'asc' : 'desc' };
    });
  };

  async function handleAcknowledge(e: React.MouseEvent, id: string) {
    e.stopPropagation();
    const result = await acknowledgeMessageAction(id);
    if (result.success) load();
  }

  const visibleRows = useMemo(() => {
    let rows = messages;

    if (tab === 'pending') rows = rows.filter((m) => !m.acknowledgedAt);
    else if (tab === 'acknowledged') rows = rows.filter((m) => !!m.acknowledgedAt);

    const query = debouncedSearch.trim().toLowerCase();
    if (query) {
      rows = rows.filter((m) => {
        const subj = (m.subject ?? '').toLowerCase();
        const body = (m.body ?? '').toLowerCase();
        return subj.includes(query) || body.includes(query);
      });
    }

    const isDate = columnSort.field === 'created_at';
    return [...rows].sort((a, b) => {
      const aVal = getSortValue(a, columnSort.field);
      const bVal = getSortValue(b, columnSort.field);
      return isDate
        ? compareDates(aVal, bVal, columnSort.order)
        : (aVal ?? '').localeCompare(bVal ?? '') * (columnSort.order === 'asc' ? 1 : -1);
    });
  }, [messages, tab, debouncedSearch, columnSort]);

  if (loading) {
    return <p className="text-sm text-slate-400">Loading...</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
        <Tabs value={tab} onValueChange={(val) => setTab(val as ListTab)}>
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="pending">Pending</TabsTrigger>
            <TabsTrigger value="acknowledged">Acknowledged</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <Input
            placeholder="Search messages..."
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

        <Button onClick={() => setDrawerOpen(true)} size="sm">
          <MessageSquarePlus className="h-4 w-4 mr-2" />
          Send Message
        </Button>
      </div>

      <MessageFormDrawer
        open={drawerOpen}
        onOpenChange={(open) => {
          setDrawerOpen(open);
          if (!open) load();
        }}
        jobId={jobId}
        claimId={claimId}
      />

      {visibleRows.length === 0 ? (
        <div className="flex h-48 items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50">
          <div className="flex flex-col items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-slate-100">
              <Search size={24} className="text-slate-400" />
            </div>
            <p className="text-sm text-slate-400">No messages found.</p>
          </div>
        </div>
      ) : (
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
                <th scope="col" className="px-4 py-3 w-24">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visibleRows.map((m) => {
                const isAcked = !!m.acknowledgedAt;
                const isExpanded = expandedId === m.id;
                return (
                  <tr
                    key={m.id}
                    onClick={() => setExpandedId(isExpanded ? null : m.id)}
                    className="cursor-pointer transition-colors hover:bg-slate-50"
                  >
                    <td className="px-4 py-3 align-top">
                      <p className="font-medium text-slate-900">{m.subject ?? '(No subject)'}</p>
                      {isExpanded && m.body && (
                        <p className="mt-2 whitespace-pre-wrap text-xs text-slate-500">{m.body}</p>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 align-top">
                      {isAcked ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                          <Check className="h-3 w-3" />
                          Acknowledged
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                          Pending
                        </span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 align-top text-slate-600">
                      {formatDateTime(m.createdAt)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 align-top text-center">
                      {!isAcked && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => handleAcknowledge(e, m.id)}
                          title="Acknowledge"
                        >
                          <Check className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
