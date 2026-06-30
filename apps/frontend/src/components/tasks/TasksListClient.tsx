'use client';

import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { CheckSquare, Plus, Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { StatusBadge } from '@/components/ui/status-badge';
import { TypeBadge } from '@/components/ui/type-badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SetPageHeader } from '@/components/layout/SetPageHeader';
import {
  ListPageHeader,
  computeStatusBreakdown,
} from '@/components/layout/ListPageHeader';
import {
  formatDate,
  ValueFilterMenu,
  SortableColumnHeader,
} from '@/components/shared/list-filters';
import { TaskFormDrawer } from '@/components/forms/TaskFormDrawer';
import {
  BottomFormDrawer,
  BottomFormDrawerBody,
  BottomFormDrawerFooter,
} from '@/components/forms/BottomFormDrawer';
import { TablePagination } from '@/components/shared/table-pagination';
import { fetchTasksAction } from '@/app/(app)/tasks/actions';
import type { Task, LookupRef } from '@/types/api';

type ListTab = 'open' | 'completed' | 'all';

function refName(value: string | LookupRef | null | undefined): string {
  if (!value) return '—';
  if (typeof value === 'string') return value;
  return value.name ?? value.externalReference ?? '—';
}

type TaskSortField =
  | 'name'
  | 'status'
  | 'priority'
  | 'task_type'
  | 'assignee'
  | 'due_date'
  | 'updated_at';

interface ColDef { key: TaskSortField; label: string }

const TABLE_COLUMNS: ColDef[] = [
  { key: 'name', label: 'Task' },
  { key: 'status', label: 'Status' },
  { key: 'priority', label: 'Priority' },
  { key: 'task_type', label: 'Type' },
  { key: 'assignee', label: 'Assigned to' },
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

function DetailField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <span className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</span>
      <div>{children}</div>
    </div>
  );
}

function isCompletedStatus(name: string | null | undefined): boolean {
  if (!name) return false;
  const lower = name.trim().toLowerCase();
  return lower === 'completed' || lower === 'cancelled' || lower === 'closed';
}

const PAGE_SIZE = 20;

export function TasksListClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
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
  const [showCreateTask, setShowCreateTask] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const lastFetchKeyRef = useRef<string | null>(null);

  const sortParam = `${columnSort.field}_${columnSort.order}`;

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchTasksAction({
        page,
        limit: PAGE_SIZE,
        search: debouncedSearch || undefined,
        sort: sortParam,
      });
      setTasks(res.data);
      setTotal(res.total);
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, page, sortParam]);

  useEffect(() => {
    const fetchKey = `${debouncedSearch}|${sortParam}|${tab}|${page}`;
    const params = new URLSearchParams(searchParams.toString());
    params.set('search', debouncedSearch);
    params.set('tab', tab);
    params.set('page', String(page));
    params.set('sort', sortParam);
    router.replace(`/tasks?${params}`, { scroll: false });
    if (lastFetchKeyRef.current === fetchKey) return;
    lastFetchKeyRef.current = fetchKey;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- searchParams excluded to avoid infinite loop
  }, [debouncedSearch, sortParam, tab, page]);

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

  const uniquePriorities = useMemo(() => {
    const names = new Set<string>();
    for (const task of tasks) {
      const name = refName(task.priority)?.trim();
      if (name && name !== '—') names.add(name);
    }
    return [...names].sort((a, b) => a.localeCompare(b));
  }, [tasks]);

  const togglePriority = (name: string) => {
    setPriorityFilter((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const visibleRows = useMemo(() => {
    let rows = tasks;

    if (tab !== 'all') {
      rows = rows.filter((task) => {
        const completed = isCompletedStatus(refName(task.status));
        return tab === 'completed' ? completed : !completed;
      });
    }

    if (priorityFilter.size > 0) {
      rows = rows.filter((task) => {
        const name = refName(task.priority)?.trim();
        return name ? priorityFilter.has(name) : false;
      });
    }

    const query = debouncedSearch.trim().toLowerCase();
    if (query) {
      rows = rows.filter((task) => {
        const name = (task.name ?? '').toLowerCase();
        const type = refName(task.taskType).toLowerCase();
        const assignee = (task.assigneeName ?? '').toLowerCase();
        return name.includes(query) || type.includes(query) || assignee.includes(query);
      });
    }

    return rows;
  }, [tasks, tab, priorityFilter, debouncedSearch]);

  const breakdown = computeStatusBreakdown(visibleRows, (t) => refName(t.status));

  function handleDrawerClose(open: boolean) {
    setShowCreateTask(open);
    if (!open) load();
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col" style={{ height: '100%' }}>
      <SetPageHeader>
        <ListPageHeader
          icon={CheckSquare}
          title="Tasks"
          total={total}
          showing={visibleRows.length}
          search={debouncedSearch}
          breakdown={breakdown}
          accent="slate"
        />
      </SetPageHeader>

      <div className="flex flex-col gap-4 px-6 pb-4 pt-1">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
          <Tabs value={tab} onValueChange={handleTabChange}>
            <TabsList>
              <TabsTrigger value="open">Open</TabsTrigger>
              <TabsTrigger value="completed">Completed</TabsTrigger>
              <TabsTrigger value="all">All</TabsTrigger>
            </TabsList>
          </Tabs>

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
            selected={priorityFilter}
            onToggle={togglePriority}
            onClearAll={() => setPriorityFilter(new Set())}
            onSelectAll={() => setPriorityFilter(new Set(uniquePriorities))}
            emptyLabel="All priorities"
            menuTitle="Filter by priority"
            itemNoun={{ singular: 'priority', plural: 'priorities' }}
          />

          <Button size="sm" className="shrink-0 bg-blue-600 text-white hover:bg-blue-500" onClick={() => setShowCreateTask(true)}>
            <Plus className="mr-1 h-4 w-4" />
            Create Task
          </Button>
        </div>
      </div>

      <div
        className="flex-1 px-6 pb-6"
        style={{ minHeight: 0, overflow: 'auto' }}
      >
        {visibleRows.length > 0 ? (
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
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visibleRows.map((task) => {
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
                      <td className="px-4 py-3 font-medium text-slate-900">{task.name}</td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <StatusBadge status={statusName} />
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <PriorityBadge priority={refName(task.priority)} />
                      </td>
                      <td className="px-4 py-3">
                        <TypeBadge type={taskTypeName} />
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {task.assigneeName ?? task.assignedToUserId ?? '—'}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                        {formatDate(task.dueDate)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                        {formatDate(task.updatedAt)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <TablePagination page={page} pageSize={PAGE_SIZE} total={total} onPageChange={handlePageChange} />
          </div>
        ) : (
          <div className="flex h-64 items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50">
            <div className="flex flex-col items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-slate-100">
                <Search size={24} className="text-slate-400" />
              </div>
              <p className="text-sm text-slate-400">No tasks found.</p>
            </div>
          </div>
        )}
      </div>

      <TaskFormDrawer open={showCreateTask} onOpenChange={handleDrawerClose} />

      <BottomFormDrawer
        open={!!selectedTask}
        onOpenChange={(open) => { if (!open) setSelectedTask(null); }}
        title={selectedTask?.name ?? 'Task Detail'}
        description="View task details"
        icon={<CheckSquare className="h-5 w-5" />}
      >
        {selectedTask && (
          <>
            <BottomFormDrawerBody>
              <div className="grid grid-cols-1 gap-x-8 gap-y-5 md:grid-cols-2">
                <DetailField label="Status">
                  <StatusBadge status={refName(selectedTask.status)} />
                </DetailField>
                <DetailField label="Priority">
                  <PriorityBadge priority={refName(selectedTask.priority)} />
                </DetailField>
                <DetailField label="Type">
                  <TypeBadge
                    type={
                      typeof selectedTask.taskType === 'string'
                        ? selectedTask.taskType
                        : selectedTask.taskType?.name ?? selectedTask.taskType?.externalReference
                    }
                  />
                </DetailField>
                <DetailField label="Assigned to">
                  <span className="text-sm text-slate-700">
                    {selectedTask.assigneeName ?? selectedTask.assignedToUserId ?? '—'}
                  </span>
                </DetailField>
                <DetailField label="Due Date">
                  <span className="text-sm text-slate-700">{formatDate(selectedTask.dueDate)}</span>
                </DetailField>
                <DetailField label="Completed">
                  <span className="text-sm text-slate-700">{formatDate(selectedTask.completedAt)}</span>
                </DetailField>
                <DetailField label="Created">
                  <span className="text-sm text-slate-700">{formatDate(selectedTask.createdAt)}</span>
                </DetailField>
                <DetailField label="Updated">
                  <span className="text-sm text-slate-700">{formatDate(selectedTask.updatedAt)}</span>
                </DetailField>
                {selectedTask.description && (
                  <div className="md:col-span-2">
                    <DetailField label="Description">
                      <p className="whitespace-pre-wrap text-sm text-slate-700">{selectedTask.description}</p>
                    </DetailField>
                  </div>
                )}
              </div>
            </BottomFormDrawerBody>
            <BottomFormDrawerFooter>
              <div />
              <Button variant="outline" onClick={() => setSelectedTask(null)}>
                Close
              </Button>
            </BottomFormDrawerFooter>
          </>
        )}
      </BottomFormDrawer>
    </div>
  );
}
