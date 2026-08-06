'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { standardSchemaResolver } from '@hookform/resolvers/standard-schema';
import { z } from 'zod';
import { CheckSquare } from 'lucide-react';
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
import { createTaskAction } from '@/app/(app)/mutations';

const taskFormSchema = z.object({
  jobId: z.string().optional(),
  claimId: z.string().optional(),
  name: z.string().min(1, 'Name is required'),
  priority: z.string().min(1, 'Priority is required'),
  dueDate: z.string().min(1, 'Due date is required'),
  description: z.string().optional(),
});

type TaskFormValues = z.infer<typeof taskFormSchema>;

export interface TaskFormDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jobId?: string;
  claimId?: string;
  renderMode?: 'drawer' | 'canvas';
  aiAssistEnabled?: boolean;
  /** When set, forces companion layout for an already-open chat drawer. */
  companionChatOpen?: boolean;
}

export function TaskFormDrawer({
  open,
  onOpenChange,
  jobId,
  claimId,
  renderMode = 'drawer',
  aiAssistEnabled = false,
  companionChatOpen: companionChatOpenProp,
}: TaskFormDrawerProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [aiContext, setAiContext] = useState<AIContextPayload | undefined>();

  useEffect(() => {
    if (!open) setChatOpen(false);
  }, [open]);

  const form = useForm<TaskFormValues>({
    resolver: standardSchemaResolver(taskFormSchema),
    defaultValues: {
      jobId: jobId ?? '',
      claimId: claimId ?? '',
      name: '',
      priority: 'Medium',
      dueDate: '',
      description: '',
    },
  });

  useEffect(() => {
    form.reset({
      ...form.getValues(),
      jobId: jobId ?? '',
      claimId: claimId ?? '',
    });
  }, [jobId, claimId, form]);

  async function onSubmit(values: TaskFormValues) {
    setSubmitting(true);
    setError(null);
    try {
      const result = await createTaskAction({
        jobId: values.jobId || undefined,
        claimId: values.claimId || undefined,
        name: values.name,
        priority: values.priority,
        dueDate: values.dueDate,
        description: values.description || undefined,
      });
      if (result.success) {
        onOpenChange(false);
        form.reset({
          jobId: jobId ?? '',
          claimId: claimId ?? '',
          name: '',
          priority: 'Medium',
          dueDate: '',
          description: '',
        });
        router.refresh();
      } else {
        setError(result.error ?? 'Failed to create task');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create task');
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
        },
        {
          entityType: 'task',
          formState: form.getValues(),
          summary:
            'The user is creating a new task. Help suggest values or answer questions about this form.',
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
          <div className="grid grid-cols-1 gap-x-6 gap-y-5 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                {...form.register('name')}
                placeholder="Task name"
              />
              {form.formState.errors.name && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.name.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="priority">Priority</Label>
              <Select
                value={form.watch('priority')}
                onValueChange={(v) => form.setValue('priority', v ?? '')}
              >
                <SelectTrigger id="priority">
                  <SelectValue placeholder="Select priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Low">Low</SelectItem>
                  <SelectItem value="Medium">Medium</SelectItem>
                  <SelectItem value="High">High</SelectItem>
                  <SelectItem value="Urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
              {form.formState.errors.priority && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.priority.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="dueDate">Due Date</Label>
              <Input
                id="dueDate"
                type="date"
                {...form.register('dueDate')}
              />
              {form.formState.errors.dueDate && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.dueDate.message}
                </p>
              )}
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="description">Description (optional)</Label>
              <Textarea
                id="description"
                {...form.register('description')}
                placeholder="Describe the task..."
                rows={4}
              />
            </div>
          </div>

          <BottomFormDrawerError error={error} />
        </BottomFormDrawerBody>

        <BottomFormDrawerFooter>
          <Button
            type="button"
            variant="outline"
            size="lg"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button type="submit" size="lg" disabled={submitting}>
            {submitting ? 'Creating...' : 'Create Task'}
          </Button>
        </BottomFormDrawerFooter>
      </form>
  );

  if (renderMode === 'canvas') {
    return formContent;
  }

  return (
    <>
      <BottomFormDrawer
        open={open}
        onOpenChange={onOpenChange}
        title="Create Task"
        description="Add a new task. Set priority and due date to keep work on track."
        icon={<CheckSquare className="h-5 w-5" />}
        aiAssistEnabled={aiAssistEnabled}
        onAIAssist={handleAIAssist}
        companionChatOpen={companionChatOpenProp ?? chatOpen}
      >
        {formContent}
      </BottomFormDrawer>
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
