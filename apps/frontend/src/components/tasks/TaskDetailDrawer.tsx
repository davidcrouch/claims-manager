'use client';

import { TaskFormDrawer } from '@/components/forms/TaskFormDrawer';
import type { Task } from '@/types/api';
import type { JobOption } from '@/components/shared/job-label';

export interface TaskDetailDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Prefer when the caller already has the task row. */
  task?: Task | null;
  /** Fetch-by-id when opened from Schedule, chat, or MCP. */
  taskId?: string | null;
  jobs?: JobOption[];
  jobNameById?: Record<string, string>;
  companionChatOpen?: boolean;
}

/**
 * Task editor drawer. Shared by Tasks list, Schedule, and canvas/MCP hosts.
 */
export function TaskDetailDrawer({
  open,
  onOpenChange,
  task,
  taskId,
  jobs,
  companionChatOpen = false,
}: TaskDetailDrawerProps) {
  return (
    <TaskFormDrawer
      open={open}
      onOpenChange={onOpenChange}
      task={task}
      taskId={taskId}
      jobs={jobs}
      jobId={task?.jobId ?? undefined}
      claimId={task?.claimId ?? undefined}
      companionChatOpen={companionChatOpen}
    />
  );
}
