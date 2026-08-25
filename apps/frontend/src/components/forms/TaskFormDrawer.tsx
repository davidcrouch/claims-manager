'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, Controller } from 'react-hook-form';
import { standardSchemaResolver } from '@hookform/resolvers/standard-schema';
import { z } from 'zod';
import { CheckSquare, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  BottomFormDrawer,
  BottomFormDrawerBody,
  BottomFormDrawerError,
  BottomFormDrawerFooter,
} from '@/components/forms/BottomFormDrawer';
import { ChatDrawer } from '@/components/chat/ChatDrawer';
import { buildAIContext, type AIContextPayload } from '@/lib/ai/use-ai-context';
import { createTaskAction, updateTaskAction } from '@/app/(app)/mutations';
import { fetchTaskAction } from '@/app/(app)/tasks/actions';
import { fetchJobsAction } from '@/app/(app)/jobs/actions';
import { OrgUserSelect } from '@/components/forms/OrgUserSelect';
import { JobSelectField } from '@/components/forms/JobSelectField';
import { toJobOptions, type JobOption } from '@/components/shared/job-label';
import { formatDate } from '@/components/shared/list-filters';
import {
  CreateSubmitOverlay,
  useCreateSubmitPhase,
} from '@/components/forms/CreateSubmitOverlay';
import { CW_TASK_TYPES } from '@/lib/cw-task-types';
import type { LookupRef, Task } from '@/types/api';

const TASK_TYPES = CW_TASK_TYPES;

const TASK_STATUSES = [
  'Open',
  'In Progress',
  'On Hold',
  'Completed',
  'Failed',
  'Cancelled',
] as const;

const TASK_PRIORITIES = ['Low', 'Medium', 'High', 'Critical'] as const;

const taskFormSchema = z.object({
  jobId: z.string().optional(),
  claimId: z.string().optional(),
  name: z.string().min(1, 'Name is required'),
  taskType: z.string().optional(),
  status: z.string().min(1, 'Status is required'),
  priority: z.string().min(1, 'Priority is required'),
  startDate: z.string().optional(),
  dueDate: z.string().min(1, 'Due date is required'),
  reminderAt: z.string().optional(),
  estimatedHours: z.string().optional(),
  assignedToUserId: z.string().optional(),
  tags: z.string().optional(),
  description: z.string().optional(),
  notes: z.string().optional(),
});

type TaskFormValues = z.infer<typeof taskFormSchema>;

function refName(value: string | LookupRef | null | undefined): string {
  if (!value) return '';
  if (typeof value === 'string') return value;
  return value.name ?? value.externalReference ?? '';
}

function toDateInput(value?: string | null): string {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) {
    return value.length >= 10 ? value.slice(0, 10) : '';
  }
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function hoursInput(value?: string | number | null): string {
  if (value === null || value === undefined || value === '') return '';
  return String(value);
}

function FormSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <h3 className="border-b border-slate-100 pb-1 text-xs font-semibold uppercase tracking-wider text-slate-500">
        {title}
      </h3>
      {children}
    </section>
  );
}

function emptyFormValues(jobId?: string, claimId?: string): TaskFormValues {
  return {
    jobId: jobId ?? '',
    claimId: claimId ?? '',
    name: '',
    taskType: '',
    status: 'Open',
    priority: 'Medium',
    startDate: '',
    dueDate: '',
    reminderAt: '',
    estimatedHours: '',
    assignedToUserId: '',
    tags: '',
    description: '',
    notes: '',
  };
}

function valuesFromTask(task: Task, fallbackJobId?: string, fallbackClaimId?: string): TaskFormValues {
  return {
    jobId: task.jobId ?? fallbackJobId ?? '',
    claimId: task.claimId ?? fallbackClaimId ?? '',
    name: task.name ?? '',
    taskType: refName(task.taskType),
    status: refName(task.status) || 'Open',
    priority: refName(task.priority) || 'Medium',
    startDate: toDateInput(task.startDate),
    dueDate: toDateInput(task.dueDate),
    reminderAt: toDateInput(task.reminderAt),
    estimatedHours: hoursInput(task.estimatedHours),
    assignedToUserId: task.assignedToUserId ?? '',
    tags: (task.tags ?? []).join(', '),
    description: task.description ?? '',
    notes: task.notes ?? '',
  };
}

export interface TaskFormDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jobId?: string;
  claimId?: string;
  jobs?: JobOption[];
  task?: Task | null;
  taskId?: string | null;
  renderMode?: 'drawer' | 'canvas';
  aiAssistEnabled?: boolean;
  companionChatOpen?: boolean;
}

export function TaskFormDrawer({
  open,
  onOpenChange,
  jobId,
  claimId,
  jobs: jobsProp,
  task: taskProp,
  taskId,
  renderMode = 'drawer',
  aiAssistEnabled = false,
  companionChatOpen: companionChatOpenProp,
}: TaskFormDrawerProps) {
  const router = useRouter();
  const { phase, busy, startCreating, resetPhase } = useCreateSubmitPhase();
  const [task, setTask] = useState<Task | null>(taskProp ?? null);
  const [loadingTask, setLoadingTask] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [aiContext, setAiContext] = useState<AIContextPayload | undefined>();
  const [loadedJobs, setLoadedJobs] = useState<JobOption[]>([]);

  const isEdit = !!task;
  const locked = submitting || busy || loadingTask;
  const jobs = jobsProp && jobsProp.length > 0 ? jobsProp : loadedJobs;
  const needsJobPicker = jobs.length > 0;

  useEffect(() => {
    if (!open) setChatOpen(false);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (jobsProp && jobsProp.length > 0) return;
    let cancelled = false;
    void fetchJobsAction({ limit: 100 }).then((res) => {
      if (cancelled || !res) return;
      setLoadedJobs(toJobOptions(res.data ?? []));
    });
    return () => {
      cancelled = true;
    };
  }, [open, jobsProp]);

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
    setLoadingTask(true);
    setError(null);
    void fetchTaskAction(id).then((fetched) => {
      if (cancelled) return;
      setLoadingTask(false);
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

  const form = useForm<TaskFormValues>({
    resolver: standardSchemaResolver(taskFormSchema),
    defaultValues: emptyFormValues(jobId, claimId),
  });

  useEffect(() => {
    if (!open) return;
    if (loadingTask) return;
    if (taskId?.trim() && !task) return;
    form.reset(task ? valuesFromTask(task, jobId, claimId) : emptyFormValues(jobId, claimId));
    setError(null);
  }, [open, jobId, claimId, form, task, loadingTask, taskId]);

  const watchedJobId = form.watch('jobId');
  const watchedTaskType = form.watch('taskType');
  const typeOptions = useMemo(() => {
    const current = watchedTaskType?.trim();
    if (current && !(TASK_TYPES as readonly string[]).includes(current)) {
      return [current, ...TASK_TYPES];
    }
    return [...TASK_TYPES];
  }, [watchedTaskType]);
  const selectedJob = useMemo(
    () => jobs.find((j) => j.id === watchedJobId),
    [jobs, watchedJobId],
  );

  async function onSubmit(values: TaskFormValues) {
    if (isEdit) setSubmitting(true);
    else startCreating();
    setError(null);
    try {
      const resolvedClaimId =
        values.claimId || selectedJob?.claimId || claimId || undefined;
      if (!values.jobId && !resolvedClaimId) {
        setError('Select a job for this task');
        if (!isEdit) resetPhase();
        setSubmitting(false);
        return;
      }
      const payload = {
        jobId: values.jobId || undefined,
        claimId: resolvedClaimId,
        relatedEntityType: values.jobId ? 'Job' : resolvedClaimId ? 'Claim' : undefined,
        relatedEntityId: values.jobId || resolvedClaimId,
        name: values.name,
        taskType: values.taskType || undefined,
        status: values.status,
        priority: values.priority,
        startDate: values.startDate || undefined,
        dueDate: values.dueDate,
        reminderAt: values.reminderAt || undefined,
        estimatedHours: values.estimatedHours || undefined,
        tags: values.tags || undefined,
        description: values.description || undefined,
        notes: values.notes || undefined,
        assignedToUserId: values.assignedToUserId || null,
      };

      const result = isEdit
        ? await updateTaskAction(task!.id, payload)
        : await createTaskAction(payload);

      if (result.success) {
        if (!isEdit) resetPhase();
        onOpenChange(false);
        form.reset(emptyFormValues(jobId, claimId));
        router.refresh();
      } else {
        setError(result.error ?? (isEdit ? 'Failed to update task' : 'Failed to create task'));
        if (!isEdit) resetPhase();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : isEdit ? 'Failed to update task' : 'Failed to create task');
      if (!isEdit) resetPhase();
    } finally {
      setSubmitting(false);
    }
  }

  function handleAIAssist() {
    setAiContext(
      buildAIContext(
        'TaskFormDrawer',
        {
          ...(jobId ? { jobId } : {}),
          ...(claimId ? { claimId } : {}),
          ...(task?.id ? { taskId: task.id } : {}),
        },
        {
          entityType: 'task',
          formState: form.getValues(),
          summary: isEdit
            ? 'The user is editing a task. Help suggest values or answer questions about this form.'
            : 'The user is creating a new task. Help suggest values or answer questions about this form.',
        },
      ),
    );
    setChatOpen(true);
  }

  const formContent = (
    <form
      onSubmit={form.handleSubmit(onSubmit)}
      className="flex min-h-0 flex-1 flex-col"
    >
      <BottomFormDrawerBody>
        {loadingTask && (
          <p className="text-sm text-slate-500">Loading task…</p>
        )}
        <div className="space-y-5">
          <FormSection title="Assignment">
            <div className="grid grid-cols-1 gap-x-4 gap-y-3 md:grid-cols-2">
              {needsJobPicker && (
                <JobSelectField
                  jobs={jobs}
                  value={watchedJobId ?? ''}
                  className="space-y-1.5"
                  onValueChange={(id) => {
                    const next = jobs.find((j) => j.id === id);
                    form.setValue('jobId', id, { shouldValidate: true });
                    form.setValue('claimId', next?.claimId ?? '', { shouldValidate: false });
                  }}
                />
              )}
              <OrgUserSelect
                id="task-assignedToUserId"
                className={needsJobPicker ? 'space-y-1.5' : 'space-y-1.5 md:col-span-2'}
                value={form.watch('assignedToUserId') || null}
                onChange={(userId) =>
                  form.setValue('assignedToUserId', userId ?? '', {
                    shouldValidate: false,
                  })
                }
              />
            </div>
          </FormSection>

          <FormSection title="Task">
            <div className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-1.5 sm:col-span-2 lg:col-span-4">
                <Label htmlFor="task-name">
                  Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="task-name"
                  {...form.register('name')}
                  placeholder="Task name"
                />
                {form.formState.errors.name && (
                  <p className="text-sm text-destructive">
                    {form.formState.errors.name.message}
                  </p>
                )}
              </div>

              <div className="space-y-1.5 sm:col-span-2 lg:col-span-4">
                <Label htmlFor="task-description">Description</Label>
                <Textarea
                  id="task-description"
                  {...form.register('description')}
                  placeholder="What needs to be done…"
                  rows={3}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="task-type">Type</Label>
                <Controller
                  control={form.control}
                  name="taskType"
                  render={({ field }) => (
                    <Select
                      value={field.value || null}
                      onValueChange={(v) => field.onChange(v ?? '')}
                    >
                      <SelectTrigger id="task-type" className="w-full">
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        {typeOptions.map((type) => (
                          <SelectItem key={type} value={type}>
                            {type}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="task-status">
                  Status <span className="text-destructive">*</span>
                </Label>
                <Controller
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <Select
                      value={field.value}
                      onValueChange={(v) => field.onChange(v ?? 'Open')}
                    >
                      <SelectTrigger id="task-status" className="w-full">
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                      <SelectContent>
                        {TASK_STATUSES.map((status) => (
                          <SelectItem key={status} value={status}>
                            {status}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="task-priority">
                  Priority <span className="text-destructive">*</span>
                </Label>
                <Controller
                  control={form.control}
                  name="priority"
                  render={({ field }) => (
                    <Select
                      value={field.value}
                      onValueChange={(v) => field.onChange(v ?? '')}
                    >
                      <SelectTrigger id="task-priority" className="w-full">
                        <SelectValue placeholder="Select priority" />
                      </SelectTrigger>
                      <SelectContent>
                        {TASK_PRIORITIES.map((priority) => (
                          <SelectItem key={priority} value={priority}>
                            {priority}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                {form.formState.errors.priority && (
                  <p className="text-sm text-destructive">
                    {form.formState.errors.priority.message}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="task-tags">Tags</Label>
                <Input
                  id="task-tags"
                  {...form.register('tags')}
                  placeholder="urgent, site, follow-up"
                />
              </div>
            </div>
          </FormSection>

          <FormSection title="Schedule">
            <div className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-1.5">
                <Label htmlFor="task-startDate">Start</Label>
                <Input id="task-startDate" type="date" {...form.register('startDate')} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="task-dueDate">
                  Due <span className="text-destructive">*</span>
                </Label>
                <Input id="task-dueDate" type="date" {...form.register('dueDate')} />
                {form.formState.errors.dueDate && (
                  <p className="text-sm text-destructive">
                    {form.formState.errors.dueDate.message}
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="task-reminderAt">Reminder</Label>
                <Input id="task-reminderAt" type="date" {...form.register('reminderAt')} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="task-estimatedHours">Est. hours</Label>
                <Input
                  id="task-estimatedHours"
                  type="number"
                  min="0"
                  step="0.25"
                  placeholder="2.5"
                  {...form.register('estimatedHours')}
                />
              </div>
            </div>
          </FormSection>

          <FormSection title="Details">
            <div className="space-y-1.5">
              <Label htmlFor="task-notes">Internal notes</Label>
              <Textarea
                id="task-notes"
                {...form.register('notes')}
                placeholder="Notes for the team"
                rows={3}
              />
            </div>
          </FormSection>

          {isEdit && task && (
            <dl className="flex flex-wrap gap-x-6 gap-y-1 border-t border-slate-100 pt-3 text-xs text-slate-500">
              <div className="flex gap-1.5">
                <dt className="font-medium text-slate-400">Created</dt>
                <dd>{formatDate(task.createdAt)}</dd>
              </div>
              <div className="flex gap-1.5">
                <dt className="font-medium text-slate-400">Updated</dt>
                <dd>{formatDate(task.updatedAt)}</dd>
              </div>
              <div className="flex gap-1.5">
                <dt className="font-medium text-slate-400">Completed</dt>
                <dd>{formatDate(task.completedAt)}</dd>
              </div>
              {task.originType && (
                <div className="flex gap-1.5">
                  <dt className="font-medium text-slate-400">Origin</dt>
                  <dd className="capitalize">{task.originType}</dd>
                </div>
              )}
            </dl>
          )}
        </div>

        <BottomFormDrawerError error={error} />
      </BottomFormDrawerBody>

      <BottomFormDrawerFooter>
        <Button
          type="button"
          variant="outline"
          size="lg"
          disabled={locked}
          onClick={() => onOpenChange(false)}
        >
          Cancel
        </Button>
        <Button type="submit" size="lg" disabled={locked}>
          {locked ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              {isEdit ? 'Saving…' : 'Creating…'}
            </>
          ) : isEdit ? (
            'Save'
          ) : (
            'Create Task'
          )}
        </Button>
      </BottomFormDrawerFooter>
    </form>
  );

  if (renderMode === 'canvas') {
    return (
      <>
        {formContent}
        {!isEdit && <CreateSubmitOverlay phase={phase} entityLabel="task" />}
      </>
    );
  }

  return (
    <>
      <BottomFormDrawer
        open={open}
        onOpenChange={onOpenChange}
        title={isEdit ? 'Edit Task' : 'Create Task'}
        description={
          isEdit
            ? 'Update the task details below.'
            : 'Add a new task. Set priority and due date to keep work on track.'
        }
        icon={<CheckSquare className="h-5 w-5" />}
        aiAssistEnabled={aiAssistEnabled}
        onAIAssist={handleAIAssist}
        companionChatOpen={companionChatOpenProp ?? chatOpen}
        preventClose={locked}
      >
        {formContent}
      </BottomFormDrawer>
      {!isEdit && <CreateSubmitOverlay phase={phase} entityLabel="task" />}
      {aiAssistEnabled && companionChatOpenProp === undefined && (
        <ChatDrawer
          open={chatOpen}
          onOpenChange={setChatOpen}
          initialContext={aiContext}
          relatedEntityType={jobId ? 'job' : claimId ? 'claim' : undefined}
          relatedEntityId={jobId ?? claimId}
          besideCanvas
        />
      )}
    </>
  );
}
