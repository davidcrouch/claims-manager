'use client';

import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { CheckSquare, Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { StatusBadge } from '@/components/ui/status-badge';
import { TypeBadge } from '@/components/ui/type-badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SetPageHeader } from '@/components/layout/SetPageHeader';
import { SetHeaderActions } from '@/components/layout/SetHeaderActions';
import { PrintButton } from '@/components/shared/PrintButton';
import { EntityPageHeader } from '@/components/shared/EntityPageHeader';
import { computeStatusBreakdown } from '@/components/layout/ListPageHeader';
import {
  formatDate,
  ValueFilterMenu,
  SortableColumnHeader,
  commitColumnFilterSelection,
  columnFilterToValuesParam,
  columnFilterKey,
  buildColumnFilterOptions,
  TableEmptyRow,
} from '@/components/shared/list-filters';
import { TaskFormDrawer } from '@/components/forms/TaskFormDrawer';
import { TaskDetailDrawer } from '@/components/tasks/TaskDetailDrawer';
import { TablePagination } from '@/components/shared/table-pagination';
import {
  ColumnSettingsHeaderCell,
  useColumnVisibility,
} from '@/components/shared/column-visibility';
import { resolveJobName } from '@/components/shared/job-label';
import { useEntityDrawer } from '@/components/layout/EntityDrawerHost';
import { fetchTasksAction } from '@/app/(app)/tasks/actions';
import type { Task, LookupRef, Job, Claim } from '@/types/api';

type ListTab = 'open' | 'completed' | 'all';

function refName(value: string | LookupRef | null | undefined): string {
  if (!value) return '—';
  if (typeof value === 'string') return value;
  return value.name ?? value.externalReference ?? '—';
}

type TaskSortField =
  | 'name'
  | 'job'
  | 'status'
  | 'priority'
  | 'task_type'
  | 'assignee'
  | 'due_date'
  | 'updated_at';

interface ColDef { key: TaskSortField; label: string; filterable?: boolean; locked?: boolean }

const TABLE_COLUMNS: ColDef[] = [
  { key: 'name', label: 'Task', locked: true, filterable: true },
  { key: 'job', label: 'Job', filterable: true },
  { key: 'status', label: 'Status', filterable: true },
  { key: 'priority', label: 'Priority', filterable: true },
  { key: 'task_type', label: 'Type', filterable: true },
  { key: 'assignee', label: 'Assigned', filterable: true },
  { key: 'due_date', label: 'Due Date' },
  { key: 'updated_at', label: 'Updated' },
];

const PRIORITY_STYLES: Record<string, string> = {
  low: 'bg-green-100 text-green-700',
  medium: 'bg-amber-100 text-amber-700',
  high: 'bg-orange-100 text-orange-700',
  urgent: 'bg-red-100 text-red-700',
};

function PriorityBadge({ priority }: { priority: string }) {
  const cls = PRIORITY_STYLES[priority.toLowerCase()] ?? 'bg-muted text-muted-foreground';
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>
      {priority}
    </span>
  );
}

/** Calendar-day urgency for the Due Date column. */
function dueDateClassName(dueDate?: string | null): string {
  if (!dueDate) return 'text-slate-600';
  const due = new Date(dueDate);
  if (Number.isNaN(due.getTime())) return 'text-slate-600';

  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startDue = new Date(due.getFullYear(), due.getMonth(), due.getDate());
  const daysUntil = Math.round(
    (startDue.getTime() - startToday.getTime()) / (24 * 60 * 60 * 1000),
  );

  if (daysUntil < 0) return 'font-medium text-red-600';
  if (daysUntil <= 2) return 'font-medium text-orange-600';
  if (daysUntil <= 7) return 'font-medium text-green-600';
  return 'text-slate-600';
}

function isCompletedStatus(name: string | null | undefined): boolean {
  if (!name) return false;
  const lower = name.trim().toLowerCase();
  return lower === 'completed' || lower === 'cancelled' || lower === 'closed';
}

const PAGE_SIZE = 20;

export function TasksListClient({
  job,
  parentClaim,
  jobNameById,
}: {
  job?: Job | null;
  parentClaim?: Claim | null;
  jobNameById?: Record<string, string>;
} = {}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { openEntityDrawer } = useEntityDrawer();
  const jobId = searchParams.get('jobId');
  const overdue = searchParams.get('overdue') === 'true';
  const assignedToUserId = searchParams.get('assignedToUserId');
  const openTaskId = searchParams.get('open');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [tab, setTab] = useState<ListTab>('open');
  const [page, setPage] = useState(() => {
    const p = parseInt(searchParams.get('page') ?? '1', 10);
    return Number.isFinite(p) && p > 0 ? p : 1;
  });
  const [columnSort, setColumnSort] = useState<{ field: TaskSortField; order: 'asc' | 'desc' }>({
    field: 'updated_at',
    order: 'desc',
  });
  const [priorityFilter, setPriorityFilter] = useState<Set<string>>(new Set());
  const [priorityFilterActive, setPriorityFilterActive] = useState(false);
  const [statusFilter, setStatusFilter] = useState<Set<string>>(new Set());
  const [statusFilterActive, setStatusFilterActive] = useState(false);
  const [typeFilter, setTypeFilter] = useState<Set<string>>(new Set());
  const [typeFilterActive, setTypeFilterActive] = useState(false);
  const [nameFilter, setNameFilter] = useState<Set<string>>(new Set());
  const [nameFilterActive, setNameFilterActive] = useState(false);
  const [jobFilter, setJobFilter] = useState<Set<string>>(new Set());
  const [jobFilterActive, setJobFilterActive] = useState(false);
  const [assigneeFilter, setAssigneeFilter] = useState<Set<string>>(new Set());
  const [assigneeFilterActive, setAssigneeFilterActive] = useState(false);
  const [showCreateTask, setShowCreateTask] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const { isVisible, toggle, visibleCount } = useColumnVisibility(
    'tasks',
    TABLE_COLUMNS,
  );
  const lastFetchKeyRef = useRef<string | null>(null);
  const statusParam = useMemo(
    () => columnFilterToValuesParam(statusFilterActive, statusFilter),
    [statusFilterActive, statusFilter],
  );
  const priorityParam = useMemo(
    () => columnFilterToValuesParam(priorityFilterActive, priorityFilter),
    [priorityFilterActive, priorityFilter],
  );

  const sortParam = `${columnSort.field}_${columnSort.order}`;

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(async () => {
    if (statusParam === null || priorityParam === null) {
      setTasks([]);
      setTotal(0);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetchTasksAction({
        page,
        limit: PAGE_SIZE,
        search: debouncedSearch || undefined,
        status: statusParam || (overdue ? 'Open' : undefined),
        priority: priorityParam,
        sort: sortParam,
        jobId: jobId ?? undefined,
        assignedToUserId: assignedToUserId ?? undefined,
        overdue: overdue || undefined,
      });
      setTasks(res.data);
      setTotal(res.total);
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, page, sortParam, statusParam, priorityParam, jobId, overdue, assignedToUserId]);

  useEffect(() => {
    const statusKey = statusParam === null ? '__none__' : (statusParam ?? '');
    const priorityKey = priorityParam === null ? '__none__' : (priorityParam ?? '');
    const fetchKey = `${debouncedSearch}|${sortParam}|${tab}|${page}|${statusKey}|${priorityKey}|${jobId ?? ''}|${overdue}|${assignedToUserId ?? ''}`;
    const params = new URLSearchParams(searchParams.toString());
    params.set('search', debouncedSearch);
    params.set('tab', tab);
    params.set('page', String(page));
    params.set('sort', sortParam);
    if (statusParam) params.set('status', statusParam); else params.delete('status');
    if (priorityParam) params.set('priority', priorityParam); else params.delete('priority');
    if (jobId) params.set('jobId', jobId);
    else params.delete('jobId');
    if (overdue) params.set('overdue', 'true');
    else params.delete('overdue');
    if (assignedToUserId) params.set('assignedToUserId', assignedToUserId);
    else params.delete('assignedToUserId');
    router.replace(`/tasks?${params}`, { scroll: false });
    if (lastFetchKeyRef.current === fetchKey) return;
    lastFetchKeyRef.current = fetchKey;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- searchParams excluded to avoid infinite loop: router.replace updates URL -> searchParams changes -> effect re-runs
  }, [debouncedSearch, sortParam, tab, page, statusParam, priorityParam, jobId, overdue, assignedToUserId]);

  useEffect(() => {
    if (!openTaskId) return;
    openEntityDrawer({
      component: 'TaskDetailDrawer',
      props: { taskId: openTaskId },
    });
    const params = new URLSearchParams(searchParams.toString());
    params.delete('open');
    router.replace(`/tasks?${params}`, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- open once per openTaskId
  }, [openTaskId]);

  const handleColumnSort = (field: TaskSortField) => {
    setColumnSort((prev) => {
      if (prev.field === field) {
        return { field, order: prev.order === 'asc' ? 'desc' : 'asc' };
      }
      return { field, order: field === 'name' ? 'asc' : 'desc' };
    });
    setPage(1);
  };

  const handlePageChange = (newPage: number) => setPage(newPage);
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => { setSearch(e.target.value); setPage(1); };
  const handleTabChange = (val: string) => { setTab(val as ListTab); setPage(1); };

  const uniquePriorities = useMemo(
    () => ['Low', 'Medium', 'High', 'Critical'],
    [],
  );

  const uniqueStatuses = useMemo(
    () => ['Open', 'Completed', 'Failed'],
    [],
  );

  const uniqueTypes = useMemo(() => {
    const names = new Set<string>();
    for (const task of tasks) {
      const name = refName(task.taskType)?.trim();
      if (name && name !== '—') names.add(name);
    }
    return [...names].sort((a, b) => a.localeCompare(b));
  }, [tasks]);

  const uniqueNames = useMemo(
    () => buildColumnFilterOptions(tasks.map((task) => task.name)),
    [tasks],
  );

  const uniqueJobs = useMemo(
    () =>
      buildColumnFilterOptions(
        tasks.map((task) => resolveJobName(task.jobId, jobNameById)),
      ),
    [tasks, jobNameById],
  );

  const uniqueAssignees = useMemo(
    () => buildColumnFilterOptions(tasks.map((task) => task.assigneeName)),
    [tasks],
  );

  const togglePriority = (name: string) => {
    const working = priorityFilterActive
      ? new Set(priorityFilter)
      : new Set(uniquePriorities);
    if (working.has(name)) working.delete(name);
    else working.add(name);
    const committed = commitColumnFilterSelection({
      next: working,
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

  const applyPriorityFilter = (next: Set<string>) => {
    const committed = commitColumnFilterSelection({
      next,
      optionCount: uniquePriorities.length,
    });
    setPriorityFilter(committed.selected);
    setPriorityFilterActive(committed.active);
    setPage(1);
  };

  const applyTypeFilter = (next: Set<string>) => {
    const committed = commitColumnFilterSelection({
      next,
      optionCount: uniqueTypes.length,
    });
    setTypeFilter(committed.selected);
    setTypeFilterActive(committed.active);
    setPage(1);
  };

  const applyNameFilter = (next: Set<string>) => {
    const committed = commitColumnFilterSelection({
      next,
      optionCount: uniqueNames.length,
    });
    setNameFilter(committed.selected);
    setNameFilterActive(committed.active);
    setPage(1);
  };

  const applyJobFilter = (next: Set<string>) => {
    const committed = commitColumnFilterSelection({
      next,
      optionCount: uniqueJobs.length,
    });
    setJobFilter(committed.selected);
    setJobFilterActive(committed.active);
    setPage(1);
  };

  const applyAssigneeFilter = (next: Set<string>) => {
    const committed = commitColumnFilterSelection({
      next,
      optionCount: uniqueAssignees.length,
    });
    setAssigneeFilter(committed.selected);
    setAssigneeFilterActive(committed.active);
    setPage(1);
  };

  const visibleRows = useMemo(() => {
    let rows = tasks;

    if (tab !== 'all') {
      rows = rows.filter((task) => {
        const completed = isCompletedStatus(refName(task.status));
        return tab === 'completed' ? completed : !completed;
      });
    }

    if (nameFilterActive) {
      if (nameFilter.size === 0) {
        rows = [];
      } else {
        rows = rows.filter((task) => nameFilter.has(columnFilterKey(task.name)));
      }
    }

    if (jobFilterActive) {
      if (jobFilter.size === 0) {
        rows = [];
      } else {
        rows = rows.filter((task) =>
          jobFilter.has(columnFilterKey(resolveJobName(task.jobId, jobNameById))),
        );
      }
    }

    if (assigneeFilterActive) {
      if (assigneeFilter.size === 0) {
        rows = [];
      } else {
        rows = rows.filter((task) =>
          assigneeFilter.has(columnFilterKey(task.assigneeName)),
        );
      }
    }

    if (typeFilterActive) {
      if (typeFilter.size === 0) {
        rows = [];
      } else {
        rows = rows.filter((task) => {
          const name = refName(task.taskType)?.trim();
          return name ? typeFilter.has(name) : false;
        });
      }
    }

    const query = debouncedSearch.trim().toLowerCase();
    if (query) {
      rows = rows.filter((task) => {
        const name = (task.name ?? '').toLowerCase();
        const type = refName(task.taskType).toLowerCase();
        const assignee = (task.assigneeName ?? '').toLowerCase();
        const jobName = resolveJobName(task.jobId, jobNameById).toLowerCase();
        return (
          name.includes(query) ||
          type.includes(query) ||
          assignee.includes(query) ||
          jobName.includes(query)
        );
      });
    }

    return rows;
  }, [
    tasks,
    tab,
    nameFilterActive,
    nameFilter,
    jobFilterActive,
    jobFilter,
    assigneeFilterActive,
    assigneeFilter,
    typeFilterActive,
    typeFilter,
    debouncedSearch,
    jobNameById,
  ]);

  const breakdown = computeStatusBreakdown(visibleRows, (t) => refName(t.status));

  function handleDrawerClose(open: boolean) {
    setShowCreateTask(open);
    if (!open) load();
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col" style={{ height: '100%' }}>
      <SetPageHeader>
        <EntityPageHeader
          icon={CheckSquare}
          title="Tasks"
          total={total}
          showing={visibleRows.length}
          search={debouncedSearch}
          breakdown={breakdown}
          accent="slate"
          job={job}
          parentClaim={parentClaim}
        />
      </SetPageHeader>
      <SetHeaderActions>
        <Button
          size="default"
          onClick={() => setShowCreateTask(true)}
          className="mr-3 h-9 gap-1.5 px-4 bg-blue-600 text-white hover:bg-blue-500"
        >
          Create Task
        </Button>
        <PrintButton documentType="tasks_list" entityId="list" />
      </SetHeaderActions>

      <div className="flex flex-col gap-4 px-6 pb-4 pt-1">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
          <Tabs value={tab} onValueChange={handleTabChange}>
            <TabsList>
              <TabsTrigger value="open">Open</TabsTrigger>
              <TabsTrigger value="completed">Completed</TabsTrigger>
              <TabsTrigger value="all">All</TabsTrigger>
            </TabsList>
          </Tabs>
          {(overdue || assignedToUserId) && (
            <p className="text-sm text-muted-foreground">
              {overdue ? 'Showing overdue open tasks' : 'Showing assigned tasks'}
              {overdue && assignedToUserId ? ' assigned to you' : ''}.
            </p>
          )}

          <div className="relative flex-1">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              size={16}
            />
            <Input
              placeholder="Search tasks by name, type, or entity..."
              value={search}
              onChange={handleSearchChange}
              className="h-10 w-full pl-9 pr-9"
            />
            {search && (
              <button
                type="button"
                onClick={() => { setSearch(''); setPage(1); }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X size={14} />
              </button>
            )}
          </div>

          <ValueFilterMenu
            options={uniquePriorities}
            selected={priorityFilterActive ? priorityFilter : new Set(uniquePriorities)}
            onToggle={togglePriority}
            onClearAll={() => {
              setPriorityFilter(new Set());
              setPriorityFilterActive(false);
              setPage(1);
            }}
            onSelectAll={() => {
              setPriorityFilter(new Set());
              setPriorityFilterActive(false);
              setPage(1);
            }}
            emptyLabel="All priorities"
            menuTitle="Filter by priority"
            itemNoun={{ singular: 'priority', plural: 'priorities' }}
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
                  {TABLE_COLUMNS.filter((col) => isVisible(col.key)).map((col) => (
                    <SortableColumnHeader
                      key={col.key}
                      columnKey={col.key}
                      label={col.label}
                      activeField={columnSort.field}
                      sortOrder={columnSort.order}
                      onSort={handleColumnSort}
                      filter={
                        col.key === 'name'
                          ? {
                              options: uniqueNames,
                              selected: nameFilter,
                              active: nameFilterActive,
                              onApply: applyNameFilter,
                              menuTitle: 'Filter by task',
                              itemNoun: { singular: 'task', plural: 'tasks' },
                            }
                          : col.key === 'job'
                            ? {
                                options: uniqueJobs,
                                selected: jobFilter,
                                active: jobFilterActive,
                                onApply: applyJobFilter,
                                menuTitle: 'Filter by job',
                                itemNoun: { singular: 'job', plural: 'jobs' },
                              }
                            : col.key === 'status'
                              ? {
                                  options: uniqueStatuses,
                                  selected: statusFilter,
                                  active: statusFilterActive,
                                  onApply: applyStatusFilter,
                                  menuTitle: 'Filter by status',
                                  itemNoun: { singular: 'status', plural: 'statuses' },
                                }
                              : col.key === 'priority'
                                ? {
                                    options: uniquePriorities,
                                    selected: priorityFilter,
                                    active: priorityFilterActive,
                                    onApply: applyPriorityFilter,
                                    menuTitle: 'Filter by priority',
                                    itemNoun: { singular: 'priority', plural: 'priorities' },
                                  }
                                : col.key === 'task_type'
                                  ? {
                                      options: uniqueTypes,
                                      selected: typeFilter,
                                      active: typeFilterActive,
                                      onApply: applyTypeFilter,
                                      menuTitle: 'Filter by type',
                                      itemNoun: { singular: 'type', plural: 'types' },
                                    }
                                  : col.key === 'assignee'
                                    ? {
                                        options: uniqueAssignees,
                                        selected: assigneeFilter,
                                        active: assigneeFilterActive,
                                        onApply: applyAssigneeFilter,
                                        menuTitle: 'Filter by assignee',
                                        itemNoun: { singular: 'assignee', plural: 'assignees' },
                                      }
                                    : undefined
                      }
                    />
                  ))}
                  <ColumnSettingsHeaderCell
                    columns={TABLE_COLUMNS}
                    isVisible={isVisible}
                    onToggle={toggle}
                  />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visibleRows.length === 0 ? (
                  <TableEmptyRow colSpan={visibleCount + 1} label="No tasks found." />
                ) : (
                  visibleRows.map((task) => {
                  const statusName = refName(task.status);
                  const taskTypeName =
                    typeof task.taskType === 'string'
                      ? task.taskType
                      : task.taskType?.name ?? task.taskType?.externalReference;
                  return (
                    <tr
                      key={task.id}
                      onClick={() => setSelectedTask(task)}
                      className="cursor-pointer transition-colors hover:bg-slate-50"
                    >
                      {isVisible('name') && (
                        <td className="px-4 py-3 font-medium text-slate-900">{task.name}</td>
                      )}
                      {isVisible('job') && (
                        <td className="px-4 py-3 text-slate-600">
                          {resolveJobName(task.jobId, jobNameById)}
                        </td>
                      )}
                      {isVisible('status') && (
                        <td className="whitespace-nowrap px-4 py-3">
                          <StatusBadge status={statusName} />
                        </td>
                      )}
                      {isVisible('priority') && (
                        <td className="whitespace-nowrap px-4 py-3">
                          <PriorityBadge priority={refName(task.priority)} />
                        </td>
                      )}
                      {isVisible('task_type') && (
                        <td className="px-4 py-3">
                          <TypeBadge type={taskTypeName} />
                        </td>
                      )}
                      {isVisible('assignee') && (
                        <td className="px-4 py-3 text-slate-600">
                          {task.assigneeName ?? '—'}
                        </td>
                      )}
                      {isVisible('due_date') && (
                        <td
                          className={`whitespace-nowrap px-4 py-3 ${dueDateClassName(task.dueDate)}`}
                        >
                          {formatDate(task.dueDate)}
                        </td>
                      )}
                      {isVisible('updated_at') && (
                        <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                          {formatDate(task.updatedAt)}
                        </td>
                      )}
                      <td className="px-2 py-3" aria-hidden />
                    </tr>
                  );
                })
                )}
              </tbody>
            </table>
            <TablePagination page={page} pageSize={PAGE_SIZE} total={total} onPageChange={handlePageChange} />
          </div>
      </div>

      <TaskFormDrawer
        open={showCreateTask}
        onOpenChange={handleDrawerClose}
        jobId={job?.id}
        claimId={job?.claimId ?? parentClaim?.id}
      />

      <TaskDetailDrawer
        open={!!selectedTask}
        onOpenChange={(open) => {
          if (!open) setSelectedTask(null);
        }}
        task={selectedTask}
        jobNameById={jobNameById}
      />
    </div>
  );
}
