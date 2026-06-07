'use client';

import { useState } from 'react';
import { CheckSquare, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SetPageHeader } from '@/components/layout/SetPageHeader';
import { ListPageHeader } from '@/components/layout/ListPageHeader';
import {
  SortTabs,
  SearchInput,
  StatusFilterMenu,
  ListEmptyState,
  type SortOption,
} from '@/components/shared/list-filters';
import { TaskFormDrawer } from '@/components/forms/TaskFormDrawer';

const SORT_OPTIONS: SortOption[] = [
  { key: 'due_date', label: 'Due Date' },
  { key: 'priority', label: 'Priority' },
  { key: 'updated_at', label: 'Updated' },
];

const PRIORITY_OPTIONS = [
  { id: 'low', name: 'Low' },
  { id: 'medium', name: 'Medium' },
  { id: 'high', name: 'High' },
  { id: 'urgent', name: 'Urgent' },
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

export function TasksListClient() {
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState('due_date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [priorityFilter, setPriorityFilter] = useState<Set<string>>(new Set());
  const [showCreateTask, setShowCreateTask] = useState(false);

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortOrder((o) => (o === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortOrder(field === 'due_date' ? 'asc' : 'desc');
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col" style={{ height: '100%' }}>
      <SetPageHeader>
        <ListPageHeader
          icon={CheckSquare}
          title="Tasks"
          total={0}
          accent="slate"
        />
      </SetPageHeader>

      <div className="flex flex-col gap-4 px-6 pb-4 pt-1">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
          <SortTabs
            options={SORT_OPTIONS}
            activeField={sortField}
            sortOrder={sortOrder}
            onSort={handleSort}
          />
          <SearchInput
            placeholder="Search tasks by name, type, or entity..."
            value={search}
            onChange={setSearch}
          />
          <StatusFilterMenu
            options={PRIORITY_OPTIONS}
            selected={priorityFilter}
            onSelectionChange={(id, checked) => {
              setPriorityFilter((prev) => {
                const next = new Set(prev);
                if (checked) next.add(id);
                else next.delete(id);
                return next;
              });
            }}
            onClearAll={() => setPriorityFilter(new Set())}
            onSelectAll={() => setPriorityFilter(new Set(PRIORITY_OPTIONS.map((o) => o.id)))}
            triggerEmptyLabel="All priorities"
            menuTitle="Filter by priority"
            itemNoun={{ singular: 'priority', plural: 'priorities' }}
          />
          <Button size="sm" className="shrink-0" onClick={() => setShowCreateTask(true)}>
            <Plus className="mr-1 h-4 w-4" />
            Create Task
          </Button>
        </div>
      </div>

      <div className="flex-1 px-6 pb-6" style={{ minHeight: 0, overflow: 'auto' }}>
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr className="text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                <th scope="col" className="px-4 py-3">Priority</th>
                <th scope="col" className="px-4 py-3">Name</th>
                <th scope="col" className="px-4 py-3">Type</th>
                <th scope="col" className="px-4 py-3">Entity</th>
                <th scope="col" className="px-4 py-3">Assigned to</th>
                <th scope="col" className="px-4 py-3">Due Date</th>
                <th scope="col" className="px-4 py-3">Status</th>
                <th scope="col" className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
            </tbody>
          </table>
        </div>
        <ListEmptyState label="No tasks yet. Tasks will appear here once the tasks API is connected." />
      </div>

      <TaskFormDrawer open={showCreateTask} onOpenChange={setShowCreateTask} />
    </div>
  );
}
