'use client';

import { useEffect, useMemo, useState } from 'react';
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
import { FormJobPickerField } from '@/components/forms/FormJobPickerField';
import {
  CreateSubmitOverlay,
  useCreateSubmitPhase,
} from '@/components/forms/CreateSubmitOverlay';
import type { JobOption } from '@/components/shared/job-label';
import { resolveJobKindCaps } from '@/lib/job-kind-registry';
import type { Job } from '@/types/api';

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const quoteFormSchema = z.object({
  jobId: z.string().min(1, 'Job is required'),
  claimId: z.string().optional(),
  quoteType: z.string().min(1, 'Type is required'),
  name: z.string().optional(),
  reference: z.string().optional(),
  note: z.string().optional(),
  estimateDate: z.string().optional(),
  expiresInDays: z.string().optional(),
  estimatedStart: z.string().optional(),
  estimatedCompletion: z.string().optional(),
});

type QuoteFormValues = z.infer<typeof quoteFormSchema>;

export interface QuoteFormDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When set, preselects this job (still shown via the job card). */
  jobId?: string;
  claimId?: string | null;
  /** Full job for richer initial display / provider caps. */
  job?: Job | null;
  /** Parent job provider (`crunchwork` | `internal`) — drives CW-only fields. */
  jobProvider?: string | null;
  /** Optional fallback labels when full job is not yet loaded. */
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
  job,
  jobProvider,
  jobs,
  renderMode = 'drawer',
  aiAssistEnabled = false,
  companionChatOpen: companionChatOpenProp,
}: QuoteFormDrawerProps) {
  const router = useRouter();
  const { phase, busy, startCreating, resetPhase } =
    useCreateSubmitPhase();
  const [error, setError] = useState<string | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [aiContext, setAiContext] = useState<AIContextPayload | undefined>();
  const [pickedJob, setPickedJob] = useState<Job | null>(null);

  const effectiveProvider = pickedJob?.provider ?? jobProvider ?? job?.provider;
  const estimateCaps = useMemo(
    () => resolveJobKindCaps({ provider: effectiveProvider }),
    [effectiveProvider],
  );
  const showReference = estimateCaps.estimate.reference.visible;
  const quoteTypes = estimateCaps.estimateQuoteTypes;

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
    if (!open) {
      setPickedJob(null);
      return;
    }
    const initialId = jobId ?? job?.id ?? '';
    const initialClaimId =
      claimId ??
      (job?.id && job.id === initialId ? job.claimId : undefined) ??
      undefined;
    setPickedJob(job?.id && job.id === initialId ? job : null);
    form.reset({
      jobId: initialId,
      claimId: initialClaimId ?? undefined,
      quoteType: '',
      name: '',
      reference: '',
      note: '',
      estimateDate: todayISO(),
      expiresInDays: '30',
      estimatedStart: '',
      estimatedCompletion: '',
    });
    setError(null);
    resetPhase();
    // Reset only when the drawer opens or the inbound job context changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: avoid wiping form when quote types change after job pick
  }, [open, jobId, claimId, job]);

  useEffect(() => {
    if (!open) return;
    const currentType = form.getValues('quoteType');
    if (currentType && !quoteTypes.includes(currentType)) {
      form.setValue('quoteType', '', { shouldValidate: true });
    }
  }, [open, quoteTypes, form]);

  const watchedJobId = form.watch('jobId');
  const quoteType = form.watch('quoteType');
  const quoteTypeItems = Object.fromEntries(quoteTypes.map((t) => [t, t]));

  function handleJobPicked(next: Job) {
    setPickedJob(next);
    form.setValue('jobId', next.id, { shouldValidate: true });
    form.setValue('claimId', next.claimId ?? undefined);
    const currentType = form.getValues('quoteType');
    const nextTypes = resolveJobKindCaps({
      provider: next.provider,
    }).estimateQuoteTypes;
    if (currentType && !nextTypes.includes(currentType)) {
      form.setValue('quoteType', '', { shouldValidate: true });
    }
  }

  async function onSubmit(values: QuoteFormValues) {
    startCreating();
    setError(null);
    try {
      const result = await createQuoteAction({
        jobId: values.jobId,
        ...(values.claimId ? { claimId: values.claimId } : {}),
        quoteType: values.quoteType || undefined,
        name: values.name || undefined,
        ...(showReference && values.reference?.trim()
          ? { reference: values.reference.trim() }
          : {}),
        note: values.note || undefined,
        estimateDate: values.estimateDate || undefined,
        expiresInDays: values.expiresInDays
          ? Number(values.expiresInDays)
          : undefined,
        estimatedStart: values.estimatedStart || undefined,
        estimatedCompletion: values.estimatedCompletion || undefined,
      });
      if (result.success) {
        if (result.quote?.id) {
          resetPhase();
          onOpenChange(false);
          router.push(`/quotes/${result.quote.id}`);
          router.refresh();
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

  function handleAIAssist() {
    const assistJobId = watchedJobId || jobId || '';
    const assistClaimId =
      form.getValues('claimId') ??
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
        <div className="space-y-6">
          <FormJobPickerField
            value={watchedJobId}
            selectedJob={pickedJob}
            jobs={jobs}
            onJobSelect={handleJobPicked}
            error={form.formState.errors.jobId?.message}
          />

          <div className="grid grid-cols-1 gap-x-6 gap-y-5 md:grid-cols-2">
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
                  {quoteTypes.map((t) => (
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

            <div className="hidden md:block" aria-hidden />

            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
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

            {showReference && (
              <div className="space-y-2">
                <Label htmlFor="reference">Reference</Label>
                <Input
                  id="reference"
                  {...form.register('reference')}
                  placeholder="Optional reference"
                />
              </div>
            )}

            {!showReference && <div className="hidden md:block" aria-hidden />}

            <div className="space-y-2">
              <Label htmlFor="estimateDate">Estimate Date</Label>
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
              <Label htmlFor="expiresInDays">Expires In (days)</Label>
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
