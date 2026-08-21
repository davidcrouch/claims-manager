'use client';

import { useCallback, useMemo, useState, useTransition } from 'react';
import { Loader2, Plus, Search, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { SetHeaderActions } from '@/components/layout/SetHeaderActions';
import { cn } from '@/lib/utils';
import type { TaskTypeMapping } from '@/types/api';
import {
  backfillTaskTypesAction,
  createTaskTypeMappingAction,
  deleteTaskTypeMappingAction,
  updateTaskTypeMappingAction,
} from '@/app/(app)/admin/task-types/actions';

const MATCH_MODES = [
  { value: 'normalized', label: 'Normalized (recommended)' },
  { value: 'exact', label: 'Exact' },
  { value: 'prefix', label: 'Prefix' },
  { value: 'contains', label: 'Contains' },
] as const;

interface Props {
  initialMappings: TaskTypeMapping[];
  taskTypes: string[];
  initialError?: string | null;
  canManage: boolean;
}

export function TaskTypesSettingsPanel({
  initialMappings,
  taskTypes,
  initialError,
  canManage,
}: Props) {
  const [isPending, startTransition] = useTransition();
  const [mappings, setMappings] = useState(initialMappings);
  const [searchText, setSearchText] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(initialError ?? null);
  const [backfillMsg, setBackfillMsg] = useState<string | null>(null);

  const [titlePattern, setTitlePattern] = useState('');
  const [taskType, setTaskType] = useState(taskTypes[0] ?? '');
  const [matchMode, setMatchMode] = useState<string>('normalized');
  const [priority, setPriority] = useState('100');
  const [isActive, setIsActive] = useState(true);

  const filtered = useMemo(() => {
    if (!searchText.trim()) return mappings;
    const lower = searchText.toLowerCase();
    return mappings.filter(
      (m) =>
        m.titlePattern.toLowerCase().includes(lower) ||
        m.taskType.toLowerCase().includes(lower) ||
        m.matchMode.toLowerCase().includes(lower),
    );
  }, [mappings, searchText]);

  const resetForm = useCallback(() => {
    setTitlePattern('');
    setTaskType(taskTypes[0] ?? '');
    setMatchMode('normalized');
    setPriority('100');
    setIsActive(true);
    setFormError(null);
    setShowAddForm(false);
    setEditingId(null);
  }, [taskTypes]);

  const startEdit = useCallback((row: TaskTypeMapping) => {
    setEditingId(row.id);
    setTitlePattern(row.titlePattern);
    setTaskType(row.taskType);
    setMatchMode(row.matchMode);
    setPriority(String(row.priority));
    setIsActive(row.isActive);
    setFormError(null);
    setShowAddForm(false);
  }, []);

  const handleAdd = useCallback(() => {
    setFormError(null);
    if (!titlePattern.trim() || !taskType.trim()) {
      setFormError('Title pattern and task type are required');
      return;
    }
    startTransition(async () => {
      const result = await createTaskTypeMappingAction({
        titlePattern: titlePattern.trim(),
        taskType: taskType.trim(),
        matchMode,
        priority: Number(priority) || 100,
        isActive,
      });
      if (result.error || !result.mapping) {
        setFormError(result.error ?? 'Failed to create mapping');
        return;
      }
      setMappings((prev) =>
        [...prev, result.mapping!].sort(
          (a, b) => a.priority - b.priority || a.titlePattern.localeCompare(b.titlePattern),
        ),
      );
      resetForm();
    });
  }, [titlePattern, taskType, matchMode, priority, isActive, resetForm]);

  const handleUpdate = useCallback(() => {
    if (!editingId) return;
    setFormError(null);
    startTransition(async () => {
      const result = await updateTaskTypeMappingAction(editingId, {
        titlePattern: titlePattern.trim(),
        taskType: taskType.trim(),
        matchMode,
        priority: Number(priority) || 100,
        isActive,
      });
      if (result.error || !result.mapping) {
        setFormError(result.error ?? 'Failed to update mapping');
        return;
      }
      setMappings((prev) =>
        prev
          .map((m) => (m.id === editingId ? result.mapping! : m))
          .sort(
            (a, b) => a.priority - b.priority || a.titlePattern.localeCompare(b.titlePattern),
          ),
      );
      resetForm();
    });
  }, [editingId, titlePattern, taskType, matchMode, priority, isActive, resetForm]);

  const handleDelete = useCallback((id: string) => {
    if (!confirm('Delete this title → type mapping?')) return;
    startTransition(async () => {
      const result = await deleteTaskTypeMappingAction(id);
      if (!result.success) {
        setFormError(result.error ?? 'Failed to delete mapping');
        return;
      }
      setMappings((prev) => prev.filter((m) => m.id !== id));
      if (editingId === id) resetForm();
    });
  }, [editingId, resetForm]);

  const handleToggleActive = useCallback((row: TaskTypeMapping) => {
    startTransition(async () => {
      const result = await updateTaskTypeMappingAction(row.id, {
        isActive: !row.isActive,
      });
      if (result.error || !result.mapping) {
        setFormError(result.error ?? 'Failed to toggle');
        return;
      }
      setMappings((prev) => prev.map((m) => (m.id === row.id ? result.mapping! : m)));
    });
  }, []);

  const handleBackfill = useCallback(() => {
    if (
      !confirm(
        'Apply mappings to all existing tasks that have no type set? Existing types will not be changed.',
      )
    ) {
      return;
    }
    setBackfillMsg(null);
    startTransition(async () => {
      const result = await backfillTaskTypesAction();
      if (result.error) {
        setFormError(result.error);
        return;
      }
      setBackfillMsg(
        `Updated ${result.updated ?? 0} of ${result.scanned ?? 0} untyped tasks.`,
      );
    });
  }, []);

  const formVisible = showAddForm || editingId !== null;

  return (
    <div className="space-y-4">
      <SetHeaderActions>
        {canManage && (
          <div className="flex items-center gap-2 mr-3">
            <Button
              size="default"
              variant="outline"
              onClick={handleBackfill}
              disabled={isPending}
              className="h-9"
            >
              Apply to existing tasks
            </Button>
            <Button
              size="default"
              onClick={() => {
                resetForm();
                setShowAddForm(true);
              }}
              disabled={isPending}
              className="h-9 gap-1.5 px-4 bg-blue-600 text-white hover:bg-blue-500"
            >
              <Plus className="h-3.5 w-3.5" />
              Add mapping
            </Button>
          </div>
        )}
      </SetHeaderActions>

      <div>
        <h1 className="text-xl font-semibold tracking-tight">Task Types</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Map task title text to a task type. Used when a task is created or synced
          without an explicit type (e.g. incoming provider tasks).
        </p>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Search patterns or types…"
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
        />
      </div>

      {(formError || backfillMsg) && (
        <div
          className={cn(
            'rounded-md border px-3 py-2 text-sm',
            formError
              ? 'border-destructive/40 bg-destructive/5 text-destructive'
              : 'border-emerald-500/30 bg-emerald-500/5 text-emerald-800',
          )}
        >
          {formError ?? backfillMsg}
        </div>
      )}

      {formVisible && canManage && (
        <div className="rounded-lg border bg-muted/20 p-4 space-y-3">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="titlePattern">Title pattern</Label>
              <Input
                id="titlePattern"
                value={titlePattern}
                onChange={(e) => setTitlePattern(e.target.value)}
                placeholder="e.g. Call to Schedule"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Task type</Label>
              <Select value={taskType} onValueChange={(v) => setTaskType(v ?? '')}>
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {taskTypes.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Match mode</Label>
              <Select value={matchMode} onValueChange={(v) => setMatchMode(v ?? 'normalized')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MATCH_MODES.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="priority">Priority (lower wins)</Label>
              <Input
                id="priority"
                type="number"
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
              />
            </div>
            <div className="flex items-end gap-2 pb-1">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                />
                Active
              </label>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={editingId ? handleUpdate : handleAdd}
              disabled={isPending}
              className="bg-blue-600 text-white hover:bg-blue-500"
            >
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingId ? 'Save changes' : 'Create mapping'}
            </Button>
            <Button variant="outline" onClick={resetForm} disabled={isPending}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      <div className="rounded-lg border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left">
            <tr>
              <th className="px-3 py-2 font-medium">Title pattern</th>
              <th className="px-3 py-2 font-medium">Task type</th>
              <th className="px-3 py-2 font-medium">Match</th>
              <th className="px-3 py-2 font-medium w-20">Priority</th>
              <th className="px-3 py-2 font-medium w-20">Active</th>
              {canManage && <th className="px-3 py-2 font-medium w-28">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td
                  colSpan={canManage ? 6 : 5}
                  className="px-3 py-8 text-center text-muted-foreground"
                >
                  No mappings found.
                </td>
              </tr>
            ) : (
              filtered.map((row) => (
                <tr
                  key={row.id}
                  className={cn(
                    'border-t',
                    editingId === row.id && 'bg-blue-50/50',
                    !row.isActive && 'opacity-60',
                  )}
                >
                  <td className="px-3 py-2 font-medium">{row.titlePattern}</td>
                  <td className="px-3 py-2">{row.taskType}</td>
                  <td className="px-3 py-2 capitalize">{row.matchMode}</td>
                  <td className="px-3 py-2">{row.priority}</td>
                  <td className="px-3 py-2">
                    {canManage ? (
                      <button
                        type="button"
                        className="text-xs underline-offset-2 hover:underline"
                        onClick={() => handleToggleActive(row)}
                        disabled={isPending}
                      >
                        {row.isActive ? 'Yes' : 'No'}
                      </button>
                    ) : row.isActive ? (
                      'Yes'
                    ) : (
                      'No'
                    )}
                  </td>
                  {canManage && (
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          className="text-xs text-blue-600 hover:underline"
                          onClick={() => startEdit(row)}
                          disabled={isPending}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="text-destructive hover:opacity-80"
                          onClick={() => handleDelete(row.id)}
                          disabled={isPending}
                          aria-label="Delete mapping"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
