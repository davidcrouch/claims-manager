'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { CheckSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import { TypeBadge } from '@/components/ui/type-badge';
import {
  BottomFormDrawer,
  BottomFormDrawerBody,
  BottomFormDrawerFooter,
} from '@/components/forms/BottomFormDrawer';
import { formatDate } from '@/components/shared/list-filters';
import { resolveJobName } from '@/components/shared/job-label';
import { fetchTaskAction } from '@/app/(app)/tasks/actions';
import type { LookupRef, Task } from '@/types/api';

const PRIORITY_STYLES: Record<string, string> = {
  low: 'bg-green-100 text-green-700',
  medium: 'bg-amber-100 text-amber-700',
  high: 'bg-orange-100 text-orange-700',
  urgent: 'bg-red-100 text-red-700',
};

function refName(value: string | LookupRef | null | undefined): string {
  if (!value) return '—';
  if (typeof value === 'string') return value;
  return value.name ?? value.externalReference ?? '—';
}

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

export interface TaskDetailDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Prefer when the caller already has the task row. */
  task?: Task | null;
  /** Fetch-by-id when opened from Schedule, chat, or MCP. */
  taskId?: string | null;
  jobNameById?: Record<string, string>;
  companionChatOpen?: boolean;
}

/**
 * Read-only task detail drawer. Shared by Tasks list, Schedule, and canvas/MCP hosts.
 */
export function TaskDetailDrawer({
  open,
  onOpenChange,
  task: taskProp,
  taskId,
  jobNameById,
  companionChatOpen = false,
}: TaskDetailDrawerProps) {
  const [task, setTask] = useState<Task | null>(taskProp ?? null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setError(null);
      return;
    }

    if (taskProp) {
      setTask(taskProp);
      setError(null);
      return;
    }

    const id = taskId?.trim();
    if (!id) {
      setTask(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    void fetchTaskAction(id).then((fetched) => {
      if (cancelled) return;
      setLoading(false);
      if (!fetched) {
        setTask(null);
        setError('Task not found.');
        return;
      }
      setTask(fetched);
    });

    return () => {
      cancelled = true;
    };
  }, [open, taskProp, taskId]);

  const jobLabel =
    resolveJobName(task?.jobId, jobNameById) ||
    (task?.jobId ? 'View job' : '');

  return (
    <BottomFormDrawer
      open={open}
      onOpenChange={onOpenChange}
      title={task?.name ?? 'Task Detail'}
      description="View task details"
      icon={<CheckSquare className="h-5 w-5" />}
      companionChatOpen={companionChatOpen}
    >
      <BottomFormDrawerBody>
        {loading && (
          <p className="text-sm text-slate-500">Loading task…</p>
        )}
        {error && !loading && (
          <p className="text-sm text-red-600">{error}</p>
        )}
        {task && !loading && (
          <div className="grid grid-cols-1 gap-x-8 gap-y-5 md:grid-cols-2">
            {task.jobId && (
              <DetailField label="Job">
                <Link
                  href={`/jobs/${task.jobId}`}
                  className="text-sm text-blue-600 hover:underline"
                >
                  {jobLabel}
                </Link>
              </DetailField>
            )}
            <DetailField label="Status">
              <StatusBadge status={refName(task.status)} />
            </DetailField>
            <DetailField label="Priority">
              <PriorityBadge priority={refName(task.priority)} />
            </DetailField>
            <DetailField label="Type">
              <TypeBadge
                type={
                  typeof task.taskType === 'string'
                    ? task.taskType
                    : task.taskType?.name ?? task.taskType?.externalReference
                }
              />
            </DetailField>
            <DetailField label="Assigned">
              <span className="text-sm text-slate-700">
                {task.assigneeName ?? '—'}
              </span>
            </DetailField>
            <DetailField label="Due Date">
              <span className="text-sm text-slate-700">{formatDate(task.dueDate)}</span>
            </DetailField>
            <DetailField label="Completed">
              <span className="text-sm text-slate-700">{formatDate(task.completedAt)}</span>
            </DetailField>
            <DetailField label="Created">
              <span className="text-sm text-slate-700">{formatDate(task.createdAt)}</span>
            </DetailField>
            <DetailField label="Updated">
              <span className="text-sm text-slate-700">{formatDate(task.updatedAt)}</span>
            </DetailField>
            {task.description && (
              <div className="md:col-span-2">
                <DetailField label="Description">
                  <p className="whitespace-pre-wrap text-sm text-slate-700">
                    {task.description}
                  </p>
                </DetailField>
              </div>
            )}
          </div>
        )}
      </BottomFormDrawerBody>
      <BottomFormDrawerFooter>
        <div />
        <Button variant="outline" onClick={() => onOpenChange(false)}>
          Close
        </Button>
      </BottomFormDrawerFooter>
    </BottomFormDrawer>
  );
}
