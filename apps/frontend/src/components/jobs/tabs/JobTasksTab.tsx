'use client';

import { useEffect, useState, useMemo } from 'react';
import { CheckSquare, Plus, Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { StatusBadge } from '@/components/ui/status-badge';
import { TypeBadge } from '@/components/ui/type-badge';
import { fetchJobTasksAction } from '@/app/(app)/jobs/[id]/actions';
import { PhaseUnavailable } from '@/components/shared/detail';
import { TaskFormDrawer } from '@/components/forms/TaskFormDrawer';
import {
  BottomFormDrawer,
  BottomFormDrawerBody,
  BottomFormDrawerFooter,
} from '@/components/forms/BottomFormDrawer';
import {
  isArchivedStatus,
  compareDates,
  compareValues,
  formatDate,
  ValueFilterMenu,
  SortableColumnHeader,
} from '@/components/shared/list-filters';
import type { Task, LookupRef } from '@/types/api';

type ListTab = 'active' | 'archived' | 'all';

function refName(value: string | LookupRef | null | undefined): string {
  if (!value) return '—';
  if (typeof value === 'string') return value;
  return value.name ?? value.externalReference ?? '—';
}

type TaskSortField =
  | 'name'
  | 'status'
  | 'priority'
  | 'type'
  | 'assignee'
  | 'due_date'
  | 'updated_at';

interface ColDef { key: TaskSortField; label: string }

const TABLE_COLUMNS: ColDef[] = [
  { key: 'name', label: 'Task' },
  { key: 'status', label: 'Status' },
  { key: 'priority', label: 'Priority' },
  { key: 'type', label: 'Type' },
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

function getSortValue(t: Task, field: TaskSortField): string | null | undefined {
  switch (field) {
    case 'name': return t.name;
    case 'status': return refName(t.status);
    case 'priority': return refName(t.priority);
    case 'type': return refName(t.taskType);
    case 'assignee': return t.assigneeName ?? t.assignedToUserId;
    case 'due_date': return t.dueDate;
    case 'updated_at': return t.updatedAt;
    default: return null;
  }
}

export function JobTasksTab({ jobId }: { jobId: string }) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [phaseUnavailable, setPhaseUnavailable] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  const [tab, setTab] = useState<ListTab>('active');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [priorityFilter, setPriorityFilter] = useState<Set<string>>(new Set());
  const [columnSort, setColumnSort] = useState<{ field: TaskSortField; order: 'asc' | 'desc' }>({
    field: 'updated_at',
    order: 'desc',
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetchJobTasksAction(jobId);
      if (cancelled) return;
      setTasks(res.data);
      setPhaseUnavailable(res.phaseUnavailable);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [jobId, refreshKey]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const handleColumnSort = (field: TaskSortField) => {
    setColumnSort((prev) => {
      if (prev.field === field) return { field, order: prev.order === 'asc' ? 'desc' : 'asc' };
      return { field, order: field === 'name' ? 'asc' : 'desc' };
    });
  };

  const uniquePriorities = useMemo(() => {
    const names = new Set<string>();
    for (const t of tasks) {
      const n = refName(t.priority).trim();
      if (n && n !== '—') names.add(n);
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
      rows = rows.filter((t) => {
        const statusName = refName(t.status);
        const archived = isArchivedStatus(statusName === '—' ? null : statusName);
        return tab === 'archived' ? archived : !archived;
      });
    }

    if (priorityFilter.size > 0) {
      rows = rows.filter((t) => {
        const n = refName(t.priority).trim();
        return n && n !== '—' ? priorityFilter.has(n) : false;
      });
    }

    const query = debouncedSearch.trim().toLowerCase();
    if (query) {
      rows = rows.filter((t) => {
        const name = (t.name ?? '').toLowerCase();
        const assignee = (t.assigneeName ?? '').toLowerCase();
        return name.includes(query) || assignee.includes(query);
      });
    }

    const isDate = columnSort.field === 'due_date' || columnSort.field === 'updated_at';
    return [...rows].sort((a, b) => {
      const aVal = getSortValue(a, columnSort.field);
      const bVal = getSortValue(b, columnSort.field);
      return isDate
        ? compareDates(aVal, bVal, columnSort.order)
        : compareValues(aVal, bVal, columnSort.order);
    });
  }, [tasks, tab, priorityFilter, debouncedSearch, columnSort]);

  if (loading) {
    return <p className="text-sm text-slate-400">Loading...</p>;
  }

  if (phaseUnavailable) {
    return <PhaseUnavailable phase="Phase 2" />;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
        <Tabs value={tab} onValueChange={(val) => setTab(val as ListTab)}>
          <TabsList>
            <TabsTrigger value="active">Active</TabsTrigger>
            <TabsTrigger value="archived">Archived</TabsTrigger>
            <TabsTrigger value="all">All</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <Input
            placeholder="Search tasks..."
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

        <Button size="sm" variant="outline" onClick={() => setShowCreate(true)}>
          <Plus className="mr-1 h-3 w-3" />
          Create Task
        </Button>
      </div>

      {visibleRows.length === 0 ? (
        <div className="flex h-48 items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50">
          <div className="flex flex-col items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-slate-100">
              <Search size={24} className="text-slate-400" />
            </div>
            <p className="text-sm text-slate-400">No tasks found.</p>
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
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visibleRows.map((t) => {
                const statusName = refName(t.status);
                const taskTypeName =
                  typeof t.taskType === 'string'
                    ? t.taskType
                    : t.taskType?.name ?? t.taskType?.externalReference;
                return (
                  <tr
                    key={t.id}
                    onClick={() => setSelectedTask(t)}
                    className="cursor-pointer transition-colors hover:bg-slate-50"
                  >
                    <td className="px-4 py-3 font-medium text-slate-900">{t.name}</td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <StatusBadge status={statusName} />
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <PriorityBadge priority={refName(t.priority)} />
                    </td>
                    <td className="px-4 py-3">
                      <TypeBadge type={taskTypeName} />
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {t.assigneeName ?? t.assignedToUserId ?? '—'}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                      {formatDate(t.dueDate)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                      {formatDate(t.updatedAt)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <TaskFormDrawer
        open={showCreate}
        onOpenChange={(open) => {
          setShowCreate(open);
          if (!open) setRefreshKey((k) => k + 1);
        }}
        jobId={jobId}
      />

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
