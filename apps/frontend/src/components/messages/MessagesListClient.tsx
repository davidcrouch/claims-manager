'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Mail, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SetPageHeader } from '@/components/layout/SetPageHeader';
import { SetHeaderActions } from '@/components/layout/SetHeaderActions';
import { PrintButton } from '@/components/shared/PrintButton';
import { EntityPageHeader } from '@/components/shared/EntityPageHeader';
import { MessageFormDrawer } from '@/components/forms/MessageFormDrawer';
import {
  SortTabs,
  SearchInput,
  StatusFilterMenu,
  SortableColumnHeader,
  TableEmptyRow,
  commitColumnFilterSelection,
  buildColumnFilterOptions,
  columnFilterKey,
  type SortOption,
} from '@/components/shared/list-filters';
import {
  ColumnSettingsHeaderCell,
  useColumnVisibility,
  type ColumnVisibilityDef,
} from '@/components/shared/column-visibility';
import { TablePagination } from '@/components/shared/table-pagination';
import { formatDateTime } from '@/components/shared/detail';
import { resolveJobName } from '@/components/shared/job-label';
import { MessageDetailDrawer } from '@/components/messages/MessageDetailDrawer';
import { fetchMessagesAction } from '@/app/(app)/messages/actions';
import type { Job, Claim, Message } from '@/types/api';

const SORT_OPTIONS: SortOption[] = [
  { key: 'created_at', label: 'Date' },
  { key: 'subject', label: 'Subject' },
];

const READ_OPTIONS = [
  { id: 'read', name: 'Read' },
  { id: 'unread', name: 'Unread' },
];

const STATUS_FILTER_OPTIONS = ['Read', 'Unread'];

const MESSAGES_COLUMNS: ColumnVisibilityDef[] = [
  { key: 'job', label: 'Job' },
  { key: 'subject', label: 'Subject', locked: true },
  { key: 'from', label: 'From' },
  { key: 'to', label: 'To' },
  { key: 'date', label: 'Date' },
  { key: 'status', label: 'Status' },
  { key: 'attachments', label: 'Attachments' },
];

function messageSender(message: Message): string {
  const payload = message.messagePayload ?? {};
  const createdBy = payload.createdBy as Record<string, unknown> | undefined;
  const createdByUser = payload.createdByUser as Record<string, unknown> | undefined;
  return (
    (createdByUser?.name as string | undefined)?.trim() ||
    (createdBy?.name as string | undefined)?.trim() ||
    message.createdByUserId ||
    'System'
  );
}

function messageRecipient(message: Message): string {
  const payload = message.messagePayload ?? {};
  const toUser = payload.toUser as Record<string, unknown> | undefined;
  return (toUser?.name as string | undefined)?.trim() || '—';
}

function messageJobId(message: Message): string | null {
  return message.toJobId ?? message.fromJobId ?? null;
}

function messageStatusLabel(message: Message): 'Read' | 'Unread' {
  if (message.acknowledgementRequired && !message.acknowledgedAt) return 'Unread';
  return 'Read';
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

export function MessagesListClient({
  job,
  parentClaim,
  jobNameById,
}: {
  job?: Job | null;
  parentClaim?: Claim | null;
  jobNameById?: Record<string, string>;
} = {}) {
  const searchParams = useSearchParams();
  const jobId = searchParams.get('jobId') ?? job?.id ?? undefined;

  const [messages, setMessages] = useState<Message[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [readFilter, setReadFilter] = useState<Set<string>>(new Set());
  const [jobFilter, setJobFilter] = useState<Set<string>>(new Set());
  const [jobFilterActive, setJobFilterActive] = useState(false);
  const [fromFilter, setFromFilter] = useState<Set<string>>(new Set());
  const [fromFilterActive, setFromFilterActive] = useState(false);
  const [toFilter, setToFilter] = useState<Set<string>>(new Set());
  const [toFilterActive, setToFilterActive] = useState(false);
  const [statusFilter, setStatusFilter] = useState<Set<string>>(new Set());
  const [statusFilterActive, setStatusFilterActive] = useState(false);
  const [page, setPage] = useState(1);
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [composeOpen, setComposeOpen] = useState(false);
  const limit = 20;
  const { isVisible, toggle, visibleCount } = useColumnVisibility(
    'messages',
    MESSAGES_COLUMNS,
  );

  const openMessage = (message: Message) => {
    setSelectedMessage(message);
    setDetailOpen(true);
  };

  const handleDetailOpenChange = (open: boolean) => {
    setDetailOpen(open);
    if (!open) setSelectedMessage(null);
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchMessagesAction({
        page,
        limit,
        jobId,
      });
      setMessages(res.data);
      setTotal(res.total);
    } finally {
      setLoading(false);
    }
  }, [page, jobId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [search, sortField, sortOrder, jobId, readFilter]);

  const uniqueJobs = useMemo(
    () =>
      buildColumnFilterOptions(
        messages.map((m) => resolveJobName(messageJobId(m), jobNameById ?? {})),
        { alwaysIncludeBlank: true },
      ),
    [messages, jobNameById],
  );

  const uniqueFrom = useMemo(
    () =>
      buildColumnFilterOptions(messages.map((m) => messageSender(m)), {
        alwaysIncludeBlank: true,
      }),
    [messages],
  );

  const uniqueTo = useMemo(
    () =>
      buildColumnFilterOptions(messages.map((m) => messageRecipient(m)), {
        alwaysIncludeBlank: true,
      }),
    [messages],
  );

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortOrder((o) => (o === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  const applyJobFilter = (next: Set<string>) => {
    const committed = commitColumnFilterSelection({
      next,
      optionCount: uniqueJobs.length,
    });
    setJobFilter(committed.selected);
    setJobFilterActive(committed.active);
  };

  const applyFromFilter = (next: Set<string>) => {
    const committed = commitColumnFilterSelection({
      next,
      optionCount: uniqueFrom.length,
    });
    setFromFilter(committed.selected);
    setFromFilterActive(committed.active);
  };

  const applyToFilter = (next: Set<string>) => {
    const committed = commitColumnFilterSelection({
      next,
      optionCount: uniqueTo.length,
    });
    setToFilter(committed.selected);
    setToFilterActive(committed.active);
  };

  const applyStatusColumnFilter = (next: Set<string>) => {
    const committed = commitColumnFilterSelection({
      next,
      optionCount: STATUS_FILTER_OPTIONS.length,
    });
    setStatusFilter(committed.selected);
    setStatusFilterActive(committed.active);
  };

  const visibleMessages = useMemo(() => {
    let rows = [...messages];

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      rows = rows.filter((m) => {
        const subject = (m.subject ?? '').toLowerCase();
        const body = stripHtml(m.body ?? '').toLowerCase();
        const from = messageSender(m).toLowerCase();
        const jobName = resolveJobName(messageJobId(m), jobNameById ?? {}).toLowerCase();
        return (
          subject.includes(q) ||
          body.includes(q) ||
          from.includes(q) ||
          jobName.includes(q)
        );
      });
    }

    if (readFilter.size > 0) {
      rows = rows.filter((m) => {
        const status = messageStatusLabel(m).toLowerCase();
        return readFilter.has(status);
      });
    }

    if (jobFilterActive) {
      if (jobFilter.size === 0) {
        rows = [];
      } else {
        rows = rows.filter((m) =>
          jobFilter.has(
            columnFilterKey(resolveJobName(messageJobId(m), jobNameById ?? {})),
          ),
        );
      }
    }

    if (fromFilterActive) {
      if (fromFilter.size === 0) {
        rows = [];
      } else {
        rows = rows.filter((m) => fromFilter.has(columnFilterKey(messageSender(m))));
      }
    }

    if (toFilterActive) {
      if (toFilter.size === 0) {
        rows = [];
      } else {
        rows = rows.filter((m) =>
          toFilter.has(columnFilterKey(messageRecipient(m))),
        );
      }
    }

    if (statusFilterActive) {
      if (statusFilter.size === 0) {
        rows = [];
      } else {
        rows = rows.filter((m) => statusFilter.has(messageStatusLabel(m)));
      }
    }

    rows.sort((a, b) => {
      let cmp = 0;
      if (sortField === 'subject') {
        cmp = (a.subject ?? '').localeCompare(b.subject ?? '');
      } else {
        cmp = (a.createdAt ?? '').localeCompare(b.createdAt ?? '');
      }
      return sortOrder === 'asc' ? cmp : -cmp;
    });

    return rows;
  }, [
    messages,
    search,
    readFilter,
    jobFilterActive,
    jobFilter,
    fromFilterActive,
    fromFilter,
    toFilterActive,
    toFilter,
    statusFilterActive,
    statusFilter,
    sortField,
    sortOrder,
    jobNameById,
  ]);

  return (
    <div className="flex min-h-0 flex-1 flex-col" style={{ height: '100%' }}>
      <SetPageHeader>
        <EntityPageHeader
          icon={MessageSquare}
          title="Communications"
          total={total}
          showing={visibleMessages.length}
          accent="slate"
          job={job}
          parentClaim={parentClaim}
        />
      </SetPageHeader>
      <SetHeaderActions>
        {jobId ? (
          <Button
            size="default"
            onClick={() => setComposeOpen(true)}
            className="mr-3 h-9 gap-1.5 px-4 bg-blue-600 text-white hover:bg-blue-500"
          >
            <Mail className="h-3.5 w-3.5" />
            Send Message
          </Button>
        ) : null}
        <PrintButton documentType="messages_list" entityId="list" />
      </SetHeaderActions>

      <div className="flex flex-col gap-4 px-6 pb-4 pt-1">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
          <SortTabs
            options={SORT_OPTIONS}
            activeField={sortField}
            sortOrder={sortOrder}
            onSort={handleSort}
          />
          <SearchInput
            placeholder="Search messages by subject, sender, or job reference..."
            value={search}
            onChange={setSearch}
          />
          <StatusFilterMenu
            options={READ_OPTIONS}
            selected={readFilter}
            onSelectionChange={(id, checked) => {
              setReadFilter((prev) => {
                const next = new Set(prev);
                if (checked) next.add(id);
                else next.delete(id);
                return next;
              });
            }}
            onClearAll={() => setReadFilter(new Set())}
            onSelectAll={() => setReadFilter(new Set(READ_OPTIONS.map((o) => o.id)))}
            triggerEmptyLabel="All messages"
            menuTitle="Filter by status"
            itemNoun={{ singular: 'status', plural: 'statuses' }}
          />
        </div>
      </div>

      <div className="flex-1 px-6 pb-6" style={{ minHeight: 0, overflow: 'auto' }}>
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr className="text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                {isVisible('job') && (
                  <SortableColumnHeader
                    columnKey="job"
                    label="Job"
                    activeField={sortField}
                    sortOrder={sortOrder}
                    onSort={handleSort}
                    filter={{
                      options: uniqueJobs,
                      selected: jobFilter,
                      active: jobFilterActive,
                      onApply: applyJobFilter,
                      menuTitle: 'Filter by job',
                      itemNoun: { singular: 'job', plural: 'jobs' },
                    }}
                  />
                )}
                {isVisible('subject') && (
                  <th scope="col" className="px-4 py-3">Subject</th>
                )}
                {isVisible('from') && (
                  <SortableColumnHeader
                    columnKey="from"
                    label="From"
                    activeField={sortField}
                    sortOrder={sortOrder}
                    onSort={handleSort}
                    filter={{
                      options: uniqueFrom,
                      selected: fromFilter,
                      active: fromFilterActive,
                      onApply: applyFromFilter,
                      menuTitle: 'Filter by from',
                      itemNoun: { singular: 'sender', plural: 'senders' },
                    }}
                  />
                )}
                {isVisible('to') && (
                  <SortableColumnHeader
                    columnKey="to"
                    label="To"
                    activeField={sortField}
                    sortOrder={sortOrder}
                    onSort={handleSort}
                    filter={{
                      options: uniqueTo,
                      selected: toFilter,
                      active: toFilterActive,
                      onApply: applyToFilter,
                      menuTitle: 'Filter by to',
                      itemNoun: { singular: 'recipient', plural: 'recipients' },
                    }}
                  />
                )}
                {isVisible('date') && (
                  <th scope="col" className="px-4 py-3">Date</th>
                )}
                {isVisible('status') && (
                  <SortableColumnHeader
                    columnKey="status"
                    label="Status"
                    activeField={sortField}
                    sortOrder={sortOrder}
                    onSort={handleSort}
                    filter={{
                      options: STATUS_FILTER_OPTIONS,
                      selected: statusFilter,
                      active: statusFilterActive,
                      onApply: applyStatusColumnFilter,
                      menuTitle: 'Filter by status',
                      itemNoun: { singular: 'status', plural: 'statuses' },
                    }}
                  />
                )}
                {isVisible('attachments') && (
                  <th scope="col" className="px-4 py-3">Attachments</th>
                )}
                <th scope="col" className="px-4 py-3">Actions</th>
                <ColumnSettingsHeaderCell
                  columns={MESSAGES_COLUMNS}
                  isVisible={isVisible}
                  onToggle={toggle}
                />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <TableEmptyRow
                  colSpan={visibleCount + 1 + 1}
                  label="Loading messages…"
                />
              ) : visibleMessages.length === 0 ? (
                <TableEmptyRow
                  colSpan={visibleCount + 1 + 1}
                  label="No messages found."
                />
              ) : (
                visibleMessages.map((message) => {
                  const jobLabel = resolveJobName(
                    messageJobId(message),
                    jobNameById ?? {},
                  );
                  const status = messageStatusLabel(message);
                  const preview = stripHtml(message.body ?? '').slice(0, 80);
                  return (
                    <tr
                      key={message.id}
                      className="cursor-pointer hover:bg-slate-50/80"
                      onClick={() => openMessage(message)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          openMessage(message);
                        }
                      }}
                      tabIndex={0}
                      role="button"
                      aria-label={`Open message: ${message.subject || 'No subject'}`}
                    >
                      {isVisible('job') && (
                        <td className="px-4 py-3 text-slate-700">{jobLabel || '—'}</td>
                      )}
                      {isVisible('subject') && (
                        <td className="px-4 py-3">
                          <div className="font-medium text-slate-900">
                            {message.subject || '(No subject)'}
                          </div>
                          {preview && (
                            <div className="mt-0.5 text-xs text-slate-500 truncate max-w-md">
                              {preview}
                            </div>
                          )}
                        </td>
                      )}
                      {isVisible('from') && (
                        <td className="px-4 py-3 text-slate-700">
                          {messageSender(message)}
                        </td>
                      )}
                      {isVisible('to') && (
                        <td className="px-4 py-3 text-slate-700">
                          {messageRecipient(message)}
                        </td>
                      )}
                      {isVisible('date') && (
                        <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                          {formatDateTime(message.createdAt)}
                        </td>
                      )}
                      {isVisible('status') && (
                        <td className="px-4 py-3">
                          <span
                            className={
                              status === 'Unread'
                                ? 'inline-flex rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700'
                                : 'inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600'
                            }
                          >
                            {status}
                          </span>
                        </td>
                      )}
                      {isVisible('attachments') && (
                        <td className="px-4 py-3 text-slate-500">—</td>
                      )}
                      <td className="px-4 py-3 text-slate-500">—</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
          <TablePagination
            page={page}
            pageSize={limit}
            total={total}
            onPageChange={setPage}
          />
        </div>
      </div>

      <MessageDetailDrawer
        open={detailOpen}
        onOpenChange={handleDetailOpenChange}
        message={selectedMessage}
        jobNameById={jobNameById}
      />
      {jobId && (
        <MessageFormDrawer
          open={composeOpen}
          onOpenChange={(open) => {
            setComposeOpen(open);
            if (!open) void load();
          }}
          jobId={jobId}
        />
      )}
    </div>
  );
}
