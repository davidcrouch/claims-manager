'use client';

import { useCallback, useEffect, useState, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Loader2,
  MessageSquareWarning,
  Bug,
  Lightbulb,
  HelpCircle,
  MessageCircle,
  Sparkles,
  ChevronDown,
  Search,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { SetPageHeader } from '@/components/layout/SetPageHeader';
import { ListPageHeader } from '@/components/layout/ListPageHeader';
import { TablePagination } from '@/components/shared/table-pagination';
import { FeedbackDetailDrawer } from '@/components/admin/FeedbackDetailDrawer';
import {
  fetchFeedbackAction,
  fetchFeedbackByIdAction,
  fetchFeedbackStatsAction,
  updateFeedbackAction,
} from '@/app/(app)/admin/feedback/actions';
import type {
  FeedbackItem,
  FeedbackStats,
  FeedbackType,
  FeedbackPriority,
  FeedbackStatus,
} from '@/types/api';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TYPE_LABELS: Record<FeedbackType, string> = {
  bug: 'Bug',
  feature_request: 'Feature Request',
  enhancement: 'Enhancement',
  question: 'Question',
  comment: 'Comment',
};

const TYPE_ICONS: Record<FeedbackType, typeof Bug> = {
  bug: Bug,
  feature_request: Lightbulb,
  enhancement: Sparkles,
  question: HelpCircle,
  comment: MessageCircle,
};

const TYPE_COLORS: Record<FeedbackType, string> = {
  bug: 'bg-red-50 text-red-700',
  feature_request: 'bg-violet-50 text-violet-700',
  enhancement: 'bg-blue-50 text-blue-700',
  question: 'bg-amber-50 text-amber-700',
  comment: 'bg-slate-100 text-slate-600',
};

const PRIORITY_COLORS: Record<FeedbackPriority, string> = {
  low: 'bg-slate-100 text-slate-600',
  medium: 'bg-blue-50 text-blue-700',
  high: 'bg-orange-50 text-orange-700',
  critical: 'bg-red-50 text-red-700',
};

const STATUS_COLORS: Record<FeedbackStatus, string> = {
  open: 'bg-blue-50 text-blue-700',
  in_progress: 'bg-amber-50 text-amber-700',
  resolved: 'bg-emerald-50 text-emerald-700',
  closed: 'bg-slate-100 text-slate-600',
};

const STATUS_LABELS: Record<FeedbackStatus, string> = {
  open: 'Open',
  in_progress: 'In Progress',
  resolved: 'Resolved',
  closed: 'Closed',
};

const ALL_STATUSES: FeedbackStatus[] = ['open', 'in_progress', 'resolved', 'closed'];
const ALL_TYPES: FeedbackType[] = ['bug', 'feature_request', 'enhancement', 'question', 'comment'];
const ALL_PRIORITIES: FeedbackPriority[] = ['low', 'medium', 'high', 'critical'];

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function looksLikeUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value.trim(),
  );
}

function stripTrailingEmail(label: string): string {
  const stripped = label.replace(/\s*\([^)]*@[^)]*\)\s*$/, '').trim();
  return stripped || label;
}

function formatReporter(item: FeedbackItem): string {
  const label = item.reportedByName?.trim();
  if (label && !looksLikeUuid(label)) return stripTrailingEmail(label);
  const id = item.reportedByUserId?.trim();
  if (id && !looksLikeUuid(id)) return id;
  return 'Unknown user';
}

function Badge({ label, className }: { label: string; className: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium ${className}`}
    >
      {label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function FeedbackListClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const openIdFromUrl = searchParams.get('open');
  const [items, setItems] = useState<FeedbackItem[]>([]);
  const [stats, setStats] = useState<FeedbackStats | null>(null);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  // Filters
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<FeedbackStatus | ''>('');
  const [typeFilter, setTypeFilter] = useState<FeedbackType | ''>('');
  const [priorityFilter, setPriorityFilter] = useState<FeedbackPriority | ''>('');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');

  const [selectedItem, setSelectedItem] = useState<FeedbackItem | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const PAGE_SIZE = 20;

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [listResult, statsResult] = await Promise.all([
        fetchFeedbackAction({
          page,
          limit: PAGE_SIZE,
          status: statusFilter || undefined,
          type: typeFilter || undefined,
          priority: priorityFilter || undefined,
          search: search || undefined,
        }),
        fetchFeedbackStatsAction(),
      ]);
      setItems(listResult.data);
      setTotal(listResult.total);
      setStats(statsResult);
    } catch (err) {
      console.error('FeedbackListClient.loadData - failed:', err);
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, typeFilter, priorityFilter, search]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    if (!openIdFromUrl) return;
    let cancelled = false;
    const match = items.find((item) => item.id === openIdFromUrl);
    const openFromUrl = async () => {
      const item = match ?? (await fetchFeedbackByIdAction(openIdFromUrl));
      if (cancelled || !item) return;
      setSelectedItem(item);
      setDetailOpen(true);
      const params = new URLSearchParams(searchParams.toString());
      params.delete('open');
      const qs = params.toString();
      router.replace(qs ? `/admin/feedback?${qs}` : '/admin/feedback', { scroll: false });
    };
    void openFromUrl();
    return () => {
      cancelled = true;
    };
    // Open once per `open` query value; list contents are read inside.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openIdFromUrl]);

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPage(1);
    setSearch(searchInput);
  }

  function applyUpdatedItem(updated: FeedbackItem) {
    setItems((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
    setSelectedItem((prev) => (prev?.id === updated.id ? updated : prev));
  }

  function openFeedback(item: FeedbackItem) {
    setSelectedItem(item);
    setDetailOpen(true);
  }

  function handleDetailOpenChange(open: boolean) {
    setDetailOpen(open);
    if (!open) setSelectedItem(null);
  }

  function handleStatusChange(id: string, newStatus: FeedbackStatus) {
    startTransition(async () => {
      try {
        const updated = await updateFeedbackAction(id, { status: newStatus });
        applyUpdatedItem(updated);
        void fetchFeedbackStatsAction().then(setStats);
        toast.success(`Status updated to ${STATUS_LABELS[newStatus]}`);
      } catch {
        toast.error('Failed to update status');
      }
    });
  }

  function handlePriorityChange(id: string, newPriority: FeedbackPriority) {
    startTransition(async () => {
      try {
        const updated = await updateFeedbackAction(id, { priority: newPriority });
        applyUpdatedItem(updated);
        toast.success(`Priority updated to ${newPriority}`);
      } catch {
        toast.error('Failed to update priority');
      }
    });
  }

  const statusTabs = [
    { key: '' as const, label: 'All', count: stats?.total ?? 0 },
    ...ALL_STATUSES.map((s) => ({
      key: s,
      label: STATUS_LABELS[s],
      count: stats?.byStatus[s] ?? 0,
    })),
  ];

  return (
    <div className="flex min-h-0 flex-1 flex-col" style={{ height: '100%' }}>
      <SetPageHeader>
        <ListPageHeader
          icon={MessageSquareWarning}
          title="Feedback"
          total={total}
          accent="slate"
        />
      </SetPageHeader>

      <div className="flex-1 px-6 pb-6 pt-1" style={{ minHeight: 0, overflow: 'auto' }}>
        {/* Status tabs */}
        <div className="mb-4 flex items-center gap-1 border-b border-slate-200">
          {statusTabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => {
                setPage(1);
                setStatusFilter(tab.key as FeedbackStatus | '');
              }}
              className={`relative px-3 py-2 text-sm font-medium transition ${
                statusFilter === tab.key
                  ? 'text-blue-600 after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-blue-600'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {tab.label}
              <span className="ml-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-slate-100 px-1.5 text-[11px] font-semibold tabular-nums text-slate-600">
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* Filters row */}
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <form onSubmit={handleSearchSubmit} className="flex items-center gap-1.5">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <Input
                placeholder="Search title or description..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="h-8 w-64 pl-8 text-sm"
              />
            </div>
          </form>

          {/* Type filter */}
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button variant="outline" size="sm" className="h-8 text-xs">
                  {typeFilter ? TYPE_LABELS[typeFilter] : 'All Types'}
                  <ChevronDown className="ml-1 h-3 w-3" />
                </Button>
              }
            />
            <DropdownMenuContent align="start" className="min-w-36">
              <DropdownMenuItem
                onClick={() => {
                  setPage(1);
                  setTypeFilter('');
                }}
              >
                All Types
              </DropdownMenuItem>
              {ALL_TYPES.map((t) => (
                <DropdownMenuItem
                  key={t}
                  onClick={() => {
                    setPage(1);
                    setTypeFilter(t);
                  }}
                >
                  {TYPE_LABELS[t]}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Priority filter */}
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button variant="outline" size="sm" className="h-8 text-xs">
                  {priorityFilter
                    ? `${priorityFilter.charAt(0).toUpperCase()}${priorityFilter.slice(1)}`
                    : 'All Priorities'}
                  <ChevronDown className="ml-1 h-3 w-3" />
                </Button>
              }
            />
            <DropdownMenuContent align="start" className="min-w-36">
              <DropdownMenuItem
                onClick={() => {
                  setPage(1);
                  setPriorityFilter('');
                }}
              >
                All Priorities
              </DropdownMenuItem>
              {ALL_PRIORITIES.map((p) => (
                <DropdownMenuItem
                  key={p}
                  onClick={() => {
                    setPage(1);
                    setPriorityFilter(p);
                  }}
                >
                  {p.charAt(0).toUpperCase() + p.slice(1)}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Table */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-lg border border-slate-200 bg-white px-5 py-12 text-center">
            <MessageSquareWarning className="mx-auto mb-4 h-12 w-12 text-muted-foreground/30" />
            <h2 className="text-lg font-semibold">No feedback items</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Users can log bugs, feature requests, and questions via the AI chat.
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/60 text-left">
                  <th className="px-4 py-3 font-medium text-slate-600">Title</th>
                  <th className="px-4 py-3 font-medium text-slate-600">Type</th>
                  <th className="px-4 py-3 font-medium text-slate-600">Priority</th>
                  <th className="px-4 py-3 font-medium text-slate-600">Status</th>
                  <th className="px-4 py-3 font-medium text-slate-600">Reported By</th>
                  <th className="px-4 py-3 font-medium text-slate-600">Page</th>
                  <th className="px-4 py-3 font-medium text-slate-600">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((item) => {
                  const TypeIcon = TYPE_ICONS[item.type] ?? MessageCircle;
                  const isSelected = selectedItem?.id === item.id && detailOpen;
                  return (
                    <tr
                      key={item.id}
                      className={`cursor-pointer hover:bg-slate-50/50 ${isSelected ? 'bg-slate-50' : ''}`}
                      onClick={() => openFeedback(item)}
                    >
                      <td className="px-4 py-3 font-medium text-slate-900">
                        <div className="flex items-center gap-2">
                          <TypeIcon className="h-4 w-4 shrink-0 text-slate-400" />
                          <span className="truncate max-w-xs">{item.title}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge label={TYPE_LABELS[item.type]} className={TYPE_COLORS[item.type]} />
                      </td>
                      <td className="px-4 py-3">
                        <DropdownMenu>
                          <DropdownMenuTrigger
                            render={
                              <button
                                type="button"
                                className="cursor-pointer"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <Badge
                                  label={item.priority.charAt(0).toUpperCase() + item.priority.slice(1)}
                                  className={PRIORITY_COLORS[item.priority]}
                                />
                              </button>
                            }
                          />
                          <DropdownMenuContent align="start" className="min-w-28">
                            {ALL_PRIORITIES.map((p) => (
                              <DropdownMenuItem
                                key={p}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handlePriorityChange(item.id, p);
                                }}
                              >
                                {p.charAt(0).toUpperCase() + p.slice(1)}
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                      <td className="px-4 py-3">
                        <DropdownMenu>
                          <DropdownMenuTrigger
                            render={
                              <button
                                type="button"
                                className="cursor-pointer"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <Badge
                                  label={STATUS_LABELS[item.status]}
                                  className={STATUS_COLORS[item.status]}
                                />
                              </button>
                            }
                          />
                          <DropdownMenuContent align="start" className="min-w-28">
                            {ALL_STATUSES.map((s) => (
                              <DropdownMenuItem
                                key={s}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleStatusChange(item.id, s);
                                }}
                              >
                                {STATUS_LABELS[s]}
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {formatReporter(item)}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {item.pageContext?.pageLabel || item.pageContext?.pathname || '—'}
                      </td>
                      <td className="px-4 py-3 text-slate-600">{formatDate(item.createdAt)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <TablePagination
              page={page}
              pageSize={PAGE_SIZE}
              total={total}
              onPageChange={setPage}
            />
          </div>
        )}
      </div>

      <FeedbackDetailDrawer
        open={detailOpen}
        onOpenChange={handleDetailOpenChange}
        item={selectedItem}
        isPending={isPending}
        onStatusChange={handleStatusChange}
        onUpdated={applyUpdatedItem}
      />
    </div>
  );
}
