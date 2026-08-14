'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { standardSchemaResolver } from '@hookform/resolvers/standard-schema';
import { z } from 'zod';
import { FileSignature, Loader2 } from 'lucide-react';
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
import {
  CreateSubmitOverlay,
  navigateToCreated,
  useCreateSubmitPhase,
} from '@/components/forms/CreateSubmitOverlay';
import {
  QUOTE_TYPES,
} from '@/components/quotes/quote-edit.types';
import type { JobOption } from '@/components/shared/job-label';

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const quoteFormSchema = z.object({
  jobId: z.string().min(1, 'Job is required'),
  claimId: z.string().optional(),
  quoteType: z.string().min(1, 'Type is required'),
  name: z.string().min(1, 'Name is required'),
  reference: z.string().optional(),
  note: z.string().optional(),
  estimateDate: z.string().min(1, 'Estimate date is required'),
  expiresInDays: z.string().min(1, 'Expires in days is required'),
  estimatedStart: z.string().optional(),
  estimatedCompletion: z.string().optional(),
});

type QuoteFormValues = z.infer<typeof quoteFormSchema>;

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
  const { phase, busy, startCreating, startOpening, resetPhase } =
    useCreateSubmitPhase();
  const [error, setError] = useState<string | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [aiContext, setAiContext] = useState<AIContextPayload | undefined>();
  const needsJobPicker = (jobs?.length ?? 0) > 0;

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
      reference: '',
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
    startCreating();
    setError(null);
    try {
      const result = await createQuoteAction({
        jobId: values.jobId,
        ...(values.claimId ? { claimId: values.claimId } : {}),
        quoteType: values.quoteType || undefined,
        name: values.name || undefined,
        reference: values.reference || undefined,
        note: values.note || undefined,
        estimateDate: values.estimateDate || undefined,
        expiresInDays: values.expiresInDays ? Number(values.expiresInDays) : undefined,
        estimatedStart: values.estimatedStart || undefined,
        estimatedCompletion: values.estimatedCompletion || undefined,
      });
      if (result.success) {
        if (result.quote?.id) {
          startOpening();
          navigateToCreated(router, `/quotes/${result.quote.id}`);
          return;
        }
        resetPhase();
        onOpenChange(false);
        router.refresh();
      } else {
        setError(result.error ?? 'Failed to create estimate');
        resetPhase();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create estimate');
      resetPhase();
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
              <>
                <JobSelectField
                  jobs={jobs}
                  value={watchedJobId}
                  onValueChange={(id) => {
                    form.setValue('jobId', id, { shouldValidate: true });
                    const selected = jobs.find((j) => j.id === id);
                    form.setValue('claimId', selected?.claimId ?? undefined);
                  }}
                  className="space-y-2"
                />
                {form.formState.errors.jobId && (
                  <p className="-mt-3 text-sm text-destructive">
                    {form.formState.errors.jobId.message}
                  </p>
                )}
              </>
            )}
            <div className="space-y-2">
              <Label htmlFor="name">
                Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="name"
                {...form.register('name')}
                placeholder="Estimate name"
              />
              {form.formState.errors.name && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.name.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="reference">Reference</Label>
              <Input
                id="reference"
                {...form.register('reference')}
                placeholder="Optional reference"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="quoteType">
                Type <span className="text-destructive">*</span>
              </Label>
              <Select
                value={quoteType || null}
                onValueChange={(v) =>
                  form.setValue('quoteType', v ?? '', { shouldValidate: true })
                }
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
              {form.formState.errors.quoteType && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.quoteType.message}
                </p>
              )}
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
            size="lg"
            disabled={busy}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button type="submit" size="lg" disabled={busy}>
            {busy ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {phase === 'opening' ? 'Opening…' : 'Creating…'}
              </>
            ) : (
              'Create Estimate'
            )}
          </Button>
        </BottomFormDrawerFooter>
      </form>
  );

  if (renderMode === 'canvas') {
    return (
      <>
        {formContent}
        <CreateSubmitOverlay phase={phase} entityLabel="estimate" />
      </>
    );
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
        preventClose={busy}
      >
        {formContent}
      </BottomFormDrawer>
      <CreateSubmitOverlay phase={phase} entityLabel="estimate" />
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
