'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { standardSchemaResolver } from '@hookform/resolvers/standard-schema';
import { z } from 'zod';
import { ChevronRight, ClipboardList, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  BottomFormDrawer,
  BottomFormDrawerBody,
  BottomFormDrawerError,
  BottomFormDrawerFooter,
} from '@/components/forms/BottomFormDrawer';
import { createWorkOrderAction } from '@/app/(app)/mutations';
import {
  CreateSubmitOverlay,
  useCreateSubmitPhase,
} from '@/components/forms/CreateSubmitOverlay';
import { fetchJobQuotesAction } from '@/app/(app)/jobs/[id]/actions';
import { FormJobPickerField } from '@/components/forms/FormJobPickerField';
import type { JobOption } from '@/components/shared/job-label';
import type { Job, Quote } from '@/types/api';

const schema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  note: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export interface WorkOrderFormDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When set, preselects this job (still shown via the job card). */
  jobId?: string;
  /** Full job for richer initial display when creating from a filtered job context. */
  job?: Job | null;
  jobs?: JobOption[];
}

export function WorkOrderFormDrawer({
  open,
  onOpenChange,
  jobId,
  job,
  jobs,
}: WorkOrderFormDrawerProps) {
  const router = useRouter();
  const { phase, busy, startCreating, resetPhase } =
    useCreateSubmitPhase();
  const [error, setError] = useState<string | null>(null);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [quotesLoading, setQuotesLoading] = useState(false);
  const [selectedQuoteId, setSelectedQuoteId] = useState<string | null>(null);
  const [pickedJobId, setPickedJobId] = useState('');
  const [pickedJob, setPickedJob] = useState<Job | null>(null);
  const effectiveJobId = pickedJobId || jobId || '';

  useEffect(() => {
    if (!open) {
      setPickedJobId('');
      setPickedJob(null);
      setQuotes([]);
      setSelectedQuoteId(null);
      return;
    }
    const initialId = jobId ?? job?.id ?? '';
    setPickedJobId(initialId);
    setPickedJob(job?.id && job.id === initialId ? job : null);
    setSelectedQuoteId(null);
  }, [open, jobId, job]);

  useEffect(() => {
    if (!open) return;
    if (!effectiveJobId) {
      setQuotes([]);
      return;
    }
    setQuotesLoading(true);
    fetchJobQuotesAction(effectiveJobId)
      .then((data) => setQuotes(data ?? []))
      .finally(() => setQuotesLoading(false));
  }, [open, effectiveJobId]);

  const form = useForm<FormValues>({
    resolver: standardSchemaResolver(schema),
    defaultValues: {
      startDate: todayISO(),
      endDate: '',
      note: '',
    },
  });

  function handleJobPicked(next: Job) {
    setPickedJobId(next.id);
    setPickedJob(next);
    setSelectedQuoteId(null);
  }

  async function onSubmit(values: FormValues) {
    if (!effectiveJobId) {
      setError('Job is required');
      return;
    }
    if (!selectedQuoteId) {
      setError('Please select an estimate');
      return;
    }
    startCreating();
    setError(null);
    try {
      const result = await createWorkOrderAction({
        quoteId: selectedQuoteId,
        jobId: effectiveJobId,
        startDate: values.startDate ? new Date(values.startDate).toISOString() : undefined,
        endDate: values.endDate ? new Date(values.endDate).toISOString() : undefined,
        note: values.note || undefined,
      });
      if (result.success) {
        if (result.workOrder?.id) {
          resetPhase();
          onOpenChange(false);
          router.push(`/work-orders/${result.workOrder.id}`);
          router.refresh();
          return;
        }
        resetPhase();
        onOpenChange(false);
        router.refresh();
      } else {
        setError(result.error ?? 'Failed to create work order');
        resetPhase();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create work order');
      resetPhase();
    }
  }

  return (
    <>
    <BottomFormDrawer
      open={open}
      onOpenChange={onOpenChange}
      title="Create Work Order"
      description="Create a new work order linked to an estimate."
      icon={<ClipboardList className="h-5 w-5" />}
      preventClose={busy}
    >
      <form onSubmit={form.handleSubmit(onSubmit)} className="flex min-h-0 flex-1 flex-col">
        <BottomFormDrawerBody>
          <div className="space-y-6">
            <FormJobPickerField
              value={effectiveJobId}
              selectedJob={pickedJob}
              jobs={jobs}
              onJobSelect={handleJobPicked}
              error={!effectiveJobId && error === 'Job is required' ? error : null}
            />

            <div className="grid grid-cols-1 gap-x-6 md:grid-cols-2">
              <div className="space-y-3">
                <Label className="text-sm font-medium">
                  Select Estimate <span className="text-destructive">*</span>
                </Label>
                <p className="text-sm text-muted-foreground">
                  Choose which estimate to base this work order on.
                </p>

                {quotesLoading ? (
                  <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading estimates...
                  </div>
                ) : !effectiveJobId ? (
                  <p className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-muted-foreground">
                    Select a job to load estimates.
                  </p>
                ) : quotes.length === 0 ? (
                  <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                    No estimates found for this job. Create an estimate first.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {quotes.map((q) => (
                      <label
                        key={q.id}
                        className={`flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 transition-colors ${
                          selectedQuoteId === q.id
                            ? 'border-emerald-300 bg-emerald-50 ring-1 ring-emerald-200'
                            : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                        }`}
                      >
                        <input
                          type="radio"
                          name="wo-estimate"
                          value={q.id}
                          checked={selectedQuoteId === q.id}
                          onChange={() => setSelectedQuoteId(q.id)}
                          className="h-4 w-4 text-emerald-600"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">
                            {q.quoteNumber ?? q.name ?? `Estimate ${q.id.slice(0, 8)}`}
                          </p>
                          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                            {q.quoteType?.name && <span>{q.quoteType.name}</span>}
                            {q.status?.name && (
                              <span className="rounded bg-slate-100 px-1.5 py-0.5">
                                {q.status.name}
                              </span>
                            )}
                            {q.totalAmount && (
                              <span>${Number(q.totalAmount).toLocaleString()}</span>
                            )}
                          </div>
                        </div>
                        <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-x-6 gap-y-5 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="wo-startDate">Start Date</Label>
                <Input id="wo-startDate" type="date" {...form.register('startDate')} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="wo-endDate">End Date</Label>
                <Input id="wo-endDate" type="date" {...form.register('endDate')} />
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="wo-note">Note</Label>
                <Textarea id="wo-note" {...form.register('note')} placeholder="Add a note..." rows={3} />
              </div>
            </div>
          </div>
          <BottomFormDrawerError error={error} />
        </BottomFormDrawerBody>

        <BottomFormDrawerFooter>
          <Button type="button" variant="outline" size="lg" disabled={busy} onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="submit" size="lg" disabled={busy || !selectedQuoteId}>
            {busy ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {phase === 'opening' ? 'Opening…' : 'Creating…'}
              </>
            ) : (
              'Create Work Order'
            )}
          </Button>
        </BottomFormDrawerFooter>
      </form>
    </BottomFormDrawer>
    <CreateSubmitOverlay phase={phase} entityLabel="work order" />
    </>
  );
}
