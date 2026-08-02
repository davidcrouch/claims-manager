'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { standardSchemaResolver } from '@hookform/resolvers/standard-schema';
import { z } from 'zod';
import { FileSignature } from 'lucide-react';
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
import { createQuoteAction } from '@/app/(app)/mutations';
import { JobSelectField } from '@/components/forms/JobSelectField';
import type { JobOption } from '@/components/shared/job-label';

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const quoteFormSchema = z.object({
  jobId: z.string().min(1, 'Job is required'),
  claimId: z.string().optional(),
  quoteType: z.string().optional(),
  name: z.string().optional(),
  note: z.string().optional(),
  estimateDate: z.string().min(1, 'Estimate date is required'),
  expiresInDays: z.string().min(1, 'Expires in days is required'),
  estimatedStart: z.string().optional(),
  estimatedCompletion: z.string().optional(),
});

type QuoteFormValues = z.infer<typeof quoteFormSchema>;

const QUOTE_TYPES = [
  'Validation',
  'Variation',
  'Tender Quote',
  'Variation - PC/PS',
  'Liability Quote',
  'Scope Of Work',
  'Quote',
] as const;

export interface QuoteFormDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When omitted, a job picker is shown (requires `jobs`). */
  jobId?: string;
  claimId?: string | null;
  /** Job options for list-page create flow. */
  jobs?: JobOption[];
  renderMode?: 'drawer' | 'canvas';
  aiAssistEnabled?: boolean;
  /** When set, forces companion layout for an already-open chat drawer. */
  companionChatOpen?: boolean;
}

export function QuoteFormDrawer({
  open,
  onOpenChange,
  jobId,
  claimId,
  jobs,
  renderMode = 'drawer',
  aiAssistEnabled = false,
  companionChatOpen: companionChatOpenProp,
}: QuoteFormDrawerProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [aiContext, setAiContext] = useState<AIContextPayload | undefined>();
  const needsJobPicker = !jobId && (jobs?.length ?? 0) > 0;

  useEffect(() => {
    if (!open) setChatOpen(false);
  }, [open]);

  const form = useForm<QuoteFormValues>({
    resolver: standardSchemaResolver(quoteFormSchema),
    defaultValues: {
      jobId: jobId ?? '',
      claimId: claimId ?? undefined,
      quoteType: '',
      name: '',
      note: '',
      estimateDate: todayISO(),
      expiresInDays: '30',
      estimatedStart: '',
      estimatedCompletion: '',
    },
  });

  useEffect(() => {
    form.reset({
      ...form.getValues(),
      jobId: jobId ?? '',
      claimId: claimId ?? undefined,
    });
  }, [jobId, claimId, form]);

  const watchedJobId = form.watch('jobId');

  async function onSubmit(values: QuoteFormValues) {
    setSubmitting(true);
    setError(null);
    try {
      const result = await createQuoteAction({
        jobId: values.jobId,
        ...(values.claimId ? { claimId: values.claimId } : {}),
        quoteType: values.quoteType || undefined,
        name: values.name || undefined,
        note: values.note || undefined,
        estimateDate: values.estimateDate || undefined,
        expiresInDays: values.expiresInDays ? Number(values.expiresInDays) : undefined,
        estimatedStart: values.estimatedStart || undefined,
        estimatedCompletion: values.estimatedCompletion || undefined,
      });
      if (result.success) {
        onOpenChange(false);
        form.reset({
          jobId: jobId ?? '',
          claimId: claimId ?? undefined,
          quoteType: '',
          name: '',
          note: '',
          estimateDate: todayISO(),
          expiresInDays: '30',
          estimatedStart: '',
          estimatedCompletion: '',
        });
        if (result.quote?.id) {
          router.push(`/quotes/${result.quote.id}`);
        } else {
          router.refresh();
        }
      } else {
        setError(result.error ?? 'Failed to create estimate');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create estimate');
    } finally {
      setSubmitting(false);
    }
  }

  const quoteTypeItems = Object.fromEntries(QUOTE_TYPES.map((t) => [t, t]));
  const quoteType = form.watch('quoteType');

  function handleAIAssist() {
    const assistJobId = watchedJobId || jobId || '';
    const assistClaimId =
      claimId ??
      jobs?.find((j) => j.id === assistJobId)?.claimId ??
      undefined;
    setAiContext(
      buildAIContext(
        'QuoteFormDrawer',
        {
          ...(assistJobId ? { jobId: assistJobId } : {}),
          ...(assistClaimId ? { claimId: assistClaimId } : {}),
        },
        {
          entityType: 'quote',
          formState: form.getValues(),
          summary:
            'The user is creating a new estimate. Help suggest values or answer questions about this form.',
        },
      ),
    );
    setChatOpen(true);
  }

  const formContent = (
    <form
      onSubmit={form.handleSubmit(onSubmit, () => {
        setError('Please fill in the required fields.');
      })}
      className="flex min-h-0 flex-1 flex-col"
    >
        <BottomFormDrawerBody>
          <div className="grid grid-cols-1 gap-x-6 gap-y-5 md:grid-cols-2">
            {needsJobPicker && jobs && (
              <JobSelectField
                jobs={jobs}
                value={watchedJobId}
                onValueChange={(id) => {
                  form.setValue('jobId', id, { shouldValidate: true });
                  const selected = jobs.find((j) => j.id === id);
                  form.setValue('claimId', selected?.claimId ?? undefined);
                }}
              />
            )}
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                {...form.register('name')}
                placeholder="Estimate name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="quoteType">Type</Label>
              <Select
                value={quoteType || null}
                onValueChange={(v) => form.setValue('quoteType', v ?? '')}
                items={quoteTypeItems}
              >
                <SelectTrigger id="quoteType" className="w-full">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {QUOTE_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="estimateDate">
                Estimate Date <span className="text-destructive">*</span>
              </Label>
              <Input
                id="estimateDate"
                type="date"
                {...form.register('estimateDate')}
              />
              {form.formState.errors.estimateDate && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.estimateDate.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="expiresInDays">
                Expires In (days) <span className="text-destructive">*</span>
              </Label>
              <Input
                id="expiresInDays"
                type="number"
                min="1"
                {...form.register('expiresInDays')}
                placeholder="e.g. 30"
              />
              {form.formState.errors.expiresInDays && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.expiresInDays.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="estimatedStart">Estimated Start</Label>
              <Input
                id="estimatedStart"
                type="date"
                {...form.register('estimatedStart')}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="estimatedCompletion">Estimated Completion</Label>
              <Input
                id="estimatedCompletion"
                type="date"
                {...form.register('estimatedCompletion')}
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="note">Note</Label>
              <Textarea
                id="note"
                {...form.register('note')}
                placeholder="Add a note..."
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
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? 'Creating...' : 'Create Estimate'}
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
        title="Create Estimate"
        description="Create a new draft estimate. You can publish it to Crunchwork later."
        icon={<FileSignature className="h-5 w-5" />}
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
          relatedEntityType="job"
          relatedEntityId={watchedJobId || jobId}
          besideCanvas
        />
      )}
    </>
  );
}
