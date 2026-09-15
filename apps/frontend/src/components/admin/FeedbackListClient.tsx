'use client';

import { useCallback, useEffect, useMemo, useState, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Loader2,
  MessageSquareWarning,
  Bug,
  Lightbulb,
  HelpCircle,
  MessageCircle,
  Sparkles,
  Search,
} from 'lucide-react';
import { toast } from 'sonner';
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
import {
  SortableColumnHeader,
  TableEmptyRow,
  commitColumnFilterSelection,
  columnFilterToIdsParam,
  columnFilterToValuesParam,
  buildColumnFilterOptions,
  COLUMN_FILTER_BLANK,
  buildSortString,
  type ColumnValueFilter,
} from '@/components/shared/list-filters';
import { FeedbackDetailDrawer } from '@/components/admin/FeedbackDetailDrawer';
import {
  fetchFeedbackAction,
  fetchFeedbackByIdAction,
  fetchFeedbackFilterOptionsAction,
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

const PRIORITY_LABELS: Record<FeedbackPriority, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  critical: 'Critical',
};

const ALL_STATUSES: FeedbackStatus[] = ['open', 'in_progress', 'resolved', 'closed'];
const ALL_TYPES: FeedbackType[] = ['bug', 'feature_request', 'enhancement', 'question', 'comment'];
const ALL_PRIORITIES: FeedbackPriority[] = ['low', 'medium', 'high', 'critical'];

type FeedbackSortField =
  | 'title'
  | 'type'
  | 'priority'
  | 'status'
  | 'reported_by'
  | 'page'
  | 'created_at';

interface ColDef {
  key: FeedbackSortField;
  label: string;
  filterable?: boolean;
}

const TABLE_COLUMNS: ColDef[] = [
  { key: 'title', label: 'Title' },
  { key: 'type', label: 'Type', filterable: true },
  { key: 'priority', label: 'Priority', filterable: true },
  { key: 'status', label: 'Status', filterable: true },
  { key: 'reported_by', label: 'Reported By', filterable: true },
  { key: 'page', label: 'Page', filterable: true },
  { key: 'created_at', label: 'Created' },
];

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

function formatPageLabel(item: FeedbackItem): string {
  return item.pageContext?.pageLabel || item.pageContext?.pathname || '';
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

function toApiValuesParam(
  active: boolean,
  selected: Set<string>,
): string | undefined | null {
  const raw = columnFilterToValuesParam(active, selected);
  if (raw === undefined || raw === null) return raw;
  return raw
    .split(',')
    .map((value) => (value === COLUMN_FILTER_BLANK ? '__blank__' : value))
    .filter(Boolean)
    .sort()
    .join(',');
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

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [columnSort, setColumnSort] = useState<{
    field: FeedbackSortField;
    order: 'asc' | 'desc';
  }>({ field: 'created_at', order: 'desc' });

  const [typeFilter, setTypeFilter] = useState<Set<string>>(new Set());
  const [typeFilterActive, setTypeFilterActive] = useState(false);
  const [priorityFilter, setPriorityFilter] = useState<Set<string>>(new Set());
  const [priorityFilterActive, setPriorityFilterActive] = useState(false);
  const [statusFilter, setStatusFilter] = useState<Set<string>>(new Set());
  const [statusFilterActive, setStatusFilterActive] = useState(false);
  const [reporterFilter, setReporterFilter] = useState<Set<string>>(new Set());
  const [reporterFilterActive, setReporterFilterActive] = useState(false);
  const [pageFilter, setPageFilter] = useState<Set<string>>(new Set());
  const [pageFilterActive, setPageFilterActive] = useState(false);

  const [reporterOptions, setReporterOptions] = useState<{ id: string; name: string }[]>([]);
  const [pageOptions, setPageOptions] = useState<string[]>([]);

  const [selectedItem, setSelectedItem] = useState<FeedbackItem | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const PAGE_SIZE = 20;
  const sortParam = buildSortString(columnSort.field, columnSort.order);

  const reporterOptionsForIds = useMemo(() => {
    const byName = new Map<string, { id: string; name: string }>();
    for (const option of reporterOptions) {
      byName.set(option.name, option);
    }
    for (const item of items) {
      const name = formatReporter(item);
      if (!byName.has(name)) {
        byName.set(name, { id: item.reportedByUserId, name });
      }
    }
    return [...byName.values()];
  }, [reporterOptions, items]);

  const typeParam = useMemo(
    () => columnFilterToValuesParam(typeFilterActive, typeFilter),
    [typeFilterActive, typeFilter],
  );
  const priorityParam = useMemo(
    () => columnFilterToValuesParam(priorityFilterActive, priorityFilter),
    [priorityFilterActive, priorityFilter],
  );
  const statusParam = useMemo(
    () => columnFilterToValuesParam(statusFilterActive, statusFilter),
    [statusFilterActive, statusFilter],
  );
  const reporterParam = useMemo(
    () => columnFilterToIdsParam(reporterFilterActive, reporterFilter, reporterOptionsForIds),
    [reporterFilterActive, reporterFilter, reporterOptionsForIds],
  );
  const pageLabelParam = useMemo(
    () => toApiValuesParam(pageFilterActive, pageFilter),
    [pageFilterActive, pageFilter],
  );

  const loadData = useCallback(async () => {
    if (
      typeParam === null ||
      priorityParam === null ||
      statusParam === null ||
      reporterParam === null ||
      pageLabelParam === null
    ) {
      setItems([]);
      setTotal(0);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const [listResult, statsResult] = await Promise.all([
        fetchFeedbackAction({
          page,
          limit: PAGE_SIZE,
          type: typeParam,
          status: statusParam,
          priority: priorityParam,
          reportedBy: reporterParam,
          pageLabel: pageLabelParam,
          search: search || undefined,
          sort: sortParam,
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
  }, [
    page,
    typeParam,
    statusParam,
    priorityParam,
    reporterParam,
    pageLabelParam,
    search,
    sortParam,
  ]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    void fetchFeedbackFilterOptionsAction().then((options) => {
      setReporterOptions(options.reporters);
      setPageOptions(options.pages);
    });
  }, []);

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
        toast.success(`Priority updated to ${PRIORITY_LABELS[newPriority]}`);
      } catch {
        toast.error('Failed to update priority');
      }
    });
  }

  const handleColumnSort = (field: FeedbackSortField) => {
    setColumnSort((prev) => {
      if (prev.field === field) {
        return { field, order: prev.order === 'asc' ? 'desc' : 'asc' };
      }
      return { field, order: field === 'title' || field === 'reported_by' || field === 'page' ? 'asc' : 'desc' };
    });
    setPage(1);
  };

  const uniqueTypes = useMemo(
    () =>
      buildColumnFilterOptions(
        [...ALL_TYPES, ...items.map((item) => item.type)],
        { alwaysIncludeBlank: false },
      ),
    [items],
  );

  const uniquePriorities = useMemo(
    () =>
      buildColumnFilterOptions(
        [...ALL_PRIORITIES, ...items.map((item) => item.priority)],
        { alwaysIncludeBlank: false },
      ),
    [items],
  );

  const uniqueStatuses = useMemo(
    () =>
      buildColumnFilterOptions(
        [...ALL_STATUSES, ...items.map((item) => item.status)],
        { alwaysIncludeBlank: false },
      ),
    [items],
  );

  const uniqueReporters = useMemo(() => {
    const names = reporterOptions.map((option) => option.name);
    for (const item of items) {
      names.push(formatReporter(item));
    }
    return buildColumnFilterOptions(names, { alwaysIncludeBlank: false });
  }, [reporterOptions, items]);

  const uniquePages = useMemo(() => {
    const values = [
      ...pageOptions,
      ...items.map((item) => formatPageLabel(item)),
    ];
    return buildColumnFilterOptions(values);
  }, [pageOptions, items]);

  const applyTypeFilter = (next: Set<string>) => {
    const committed = commitColumnFilterSelection({
      next,
      optionCount: uniqueTypes.length,
    });
    setTypeFilter(committed.selected);
    setTypeFilterActive(committed.active);
    setPage(1);
  };

  const applyPriorityFilter = (next: Set<string>) => {
    const committed = commitColumnFilterSelection({
      next,
      optionCount: uniquePriorities.length,
    });
    setPriorityFilter(committed.selected);
    setPriorityFilterActive(committed.active);
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

  const applyReporterFilter = (next: Set<string>) => {
    const committed = commitColumnFilterSelection({
      next,
      optionCount: uniqueReporters.length,
    });
    setReporterFilter(committed.selected);
    setReporterFilterActive(committed.active);
    setPage(1);
  };

  const applyPageColumnFilter = (next: Set<string>) => {
    const committed = commitColumnFilterSelection({
      next,
      optionCount: uniquePages.length,
    });
    setPageFilter(committed.selected);
    setPageFilterActive(committed.active);
    setPage(1);
  };

  const setStatusTab = (status: FeedbackStatus | '') => {
    if (!status) {
      setStatusFilter(new Set());
      setStatusFilterActive(false);
    } else {
      setStatusFilter(new Set([status]));
      setStatusFilterActive(true);
    }
    setPage(1);
  };

  const activeStatusTab: FeedbackStatus | '' | null =
    !statusFilterActive
      ? ''
      : statusFilter.size === 1
        ? ([...statusFilter][0] as FeedbackStatus)
        : null;

  const typeFilterProps: ColumnValueFilter = {
    options: uniqueTypes,
    selected: typeFilter,
    active: typeFilterActive,
    onApply: applyTypeFilter,
    menuTitle: 'Filter by type',
    itemNoun: { singular: 'type', plural: 'types' },
    formatOption: (name) => TYPE_LABELS[name as FeedbackType] ?? name,
  };

  const priorityFilterProps: ColumnValueFilter = {
    options: uniquePriorities,
    selected: priorityFilter,
    active: priorityFilterActive,
    onApply: applyPriorityFilter,
    menuTitle: 'Filter by priority',
    itemNoun: { singular: 'priority', plural: 'priorities' },
    formatOption: (name) => PRIORITY_LABELS[name as FeedbackPriority] ?? name,
  };

  const statusFilterProps: ColumnValueFilter = {
    options: uniqueStatuses,
    selected: statusFilter,
    active: statusFilterActive,
    onApply: applyStatusFilter,
    menuTitle: 'Filter by status',
    itemNoun: { singular: 'status', plural: 'statuses' },
    formatOption: (name) => STATUS_LABELS[name as FeedbackStatus] ?? name,
  };

  const reporterFilterProps: ColumnValueFilter = {
    options: uniqueReporters,
    selected: reporterFilter,
    active: reporterFilterActive,
    onApply: applyReporterFilter,
    menuTitle: 'Filter by reporter',
    itemNoun: { singular: 'reporter', plural: 'reporters' },
  };

  const pageFilterProps: ColumnValueFilter = {
    options: uniquePages,
    selected: pageFilter,
    active: pageFilterActive,
    onApply: applyPageColumnFilter,
    menuTitle: 'Filter by page',
    itemNoun: { singular: 'page', plural: 'pages' },
  };

  const statusTabs = [
    { key: '' as const, label: 'All', count: stats?.total ?? 0 },
    ...ALL_STATUSES.map((s) => ({
      key: s,
      label: STATUS_LABELS[s],
      count: stats?.byStatus[s] ?? 0,
    })),
  ];

  const columnFilterFor = (key: FeedbackSortField): ColumnValueFilter | undefined => {
    switch (key) {
      case 'type':
        return typeFilterProps;
      case 'priority':
        return priorityFilterProps;
      case 'status':
        return statusFilterProps;
      case 'reported_by':
        return reporterFilterProps;
      case 'page':
        return pageFilterProps;
      default:
        return undefined;
    }
  };

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
              onClick={() => setStatusTab(tab.key as FeedbackStatus | '')}
              className={`relative px-3 py-2 text-sm font-medium transition ${
                activeStatusTab === tab.key
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

        {/* Search */}
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
        </div>

        {/* Table */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/60 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                  {TABLE_COLUMNS.map((col) => (
                    <SortableColumnHeader
                      key={col.key}
                      columnKey={col.key}
                      label={col.label}
                      activeField={columnSort.field}
                      sortOrder={columnSort.order}
                      onSort={handleColumnSort}
                      filter={col.filterable ? columnFilterFor(col.key) : undefined}
                    />
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.length === 0 ? (
                  <TableEmptyRow
                    colSpan={TABLE_COLUMNS.length}
                    label={
                      search ||
                      typeFilterActive ||
                      priorityFilterActive ||
                      statusFilterActive ||
                      reporterFilterActive ||
                      pageFilterActive
                        ? 'No feedback items match the current filters.'
                        : 'No feedback items yet. Feedback is created when a user asks the Help Assistant to log a bug, feature request, or question.'
                    }
                  />
                ) : (
                  items.map((item) => {
                    const TypeIcon = TYPE_ICONS[item.type] ?? MessageCircle;
                    const isSelected = selectedItem?.id === item.id && detailOpen;
                    const pageLabel = formatPageLabel(item);
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
                                    label={PRIORITY_LABELS[item.priority]}
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
                                  {PRIORITY_LABELS[p]}
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
                          {pageLabel || '—'}
                        </td>
                        <td className="px-4 py-3 text-slate-600">{formatDate(item.createdAt)}</td>
                      </tr>
                    );
                  })
                )}
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
