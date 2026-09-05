'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Send, ChevronRight, Loader2 } from 'lucide-react';
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
import { LineItemsProvider, LineItemsTable } from '@/components/line-items';
import { createRfqAction } from '@/app/(app)/mutations';
import {
  CreateSubmitOverlay,
  useCreateSubmitPhase,
} from '@/components/forms/CreateSubmitOverlay';
import { fetchJobQuotesAction } from '@/app/(app)/jobs/[id]/actions';
import { getQuoteLineItemsAction } from '@/app/(app)/quotes/actions';
import { FormJobPickerField } from '@/components/forms/FormJobPickerField';
import { jobDisplayName, type JobOption } from '@/components/shared/job-label';
import type { Job, Quote } from '@/types/api';
import { collectSelectableLineItemIds, type ApiGroup } from '@/components/line-items';

type WizardStep = 'details' | 'scope';

const STEPS: WizardStep[] = ['details', 'scope'];
const STEP_LABELS: Record<WizardStep, string> = {
  details: 'RFQ Details',
  scope: 'Select Scope',
};

export interface RfqFormDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When omitted, a job picker is shown (requires `jobs`). */
  jobId?: string;
  /** Full job for richer initial display when creating from a filtered job context. */
  job?: Job | null;
  jobs?: JobOption[];
}

export function RfqFormDrawer({
  open,
  onOpenChange,
  jobId,
  job,
  jobs,
}: RfqFormDrawerProps) {
  const router = useRouter();

  const [step, setStep] = useState<WizardStep>('details');
  const { phase, busy, startCreating, resetPhase } =
    useCreateSubmitPhase();
  const [error, setError] = useState<string | null>(null);
  const [pickedJobId, setPickedJobId] = useState('');
  const [pickedJob, setPickedJob] = useState<Job | null>(null);
  const effectiveJobId = pickedJobId || (jobId ?? '');

  // Step 1 state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [selectedQuoteId, setSelectedQuoteId] = useState<string | null>(null);
  const [quotesLoading, setQuotesLoading] = useState(false);

  // Step 2 state
  const [groups, setGroups] = useState<ApiGroup[]>([]);
  const [lineItemsLoading, setLineItemsLoading] = useState(false);
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());

  const reset = useCallback(() => {
    setStep('details');
    setName('');
    setDescription('');
    setSelectedQuoteId(null);
    setGroups([]);
    setSelectedItemIds(new Set());
    setError(null);
    resetPhase();
    setPickedJobId('');
    setPickedJob(null);
  }, [resetPhase]);

  useEffect(() => {
    if (!open) {
      reset();
      return;
    }
    const initialId = jobId ?? job?.id ?? '';
    setPickedJobId(initialId);
    setPickedJob(job?.id && job.id === initialId ? job : null);
  }, [open, jobId, job, reset]);

  function clearJobDependentState() {
    setSelectedQuoteId(null);
    setGroups([]);
    setSelectedItemIds(new Set());
  }

  function handleJobPicked(next: Job) {
    setPickedJobId(next.id);
    setPickedJob(next);
    clearJobDependentState();
  }

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

  async function loadLineItems(quoteId: string) {
    setLineItemsLoading(true);
    setError(null);
    try {
      const result = await getQuoteLineItemsAction(quoteId, { all: true });
      if (result.success && result.groups) {
        const parsed = result.groups as unknown as ApiGroup[];
        setGroups(parsed);
        setSelectedItemIds(new Set(collectSelectableLineItemIds(parsed)));
      } else {
        setError(result.error ?? 'Failed to load estimate line items');
        setGroups([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load line items');
      setGroups([]);
    } finally {
      setLineItemsLoading(false);
    }
  }

  function handleNextStep() {
    if (!effectiveJobId) {
      setError('Please select a job');
      return;
    }
    if (!selectedQuoteId) {
      setError('Please select an estimate');
      return;
    }
    setError(null);
    loadLineItems(selectedQuoteId);
    setStep('scope');
  }

  function handleBack() {
    setStep('details');
    setError(null);
  }

  function handleOpenChange(next: boolean) {
    if (!next && busy) return;
    onOpenChange(next);
    if (!next) reset();
  }

  const stepIndex = STEPS.indexOf(step);
  const selectedQuote = quotes.find((q) => q.id === selectedQuoteId);
  const selectedEstimateLabel = selectedQuote
    ? (selectedQuote.quoteNumber ?? selectedQuote.name ?? selectedQuote.id.slice(0, 8))
    : null;

  const selectedJobOption = jobs?.find((j) => j.id === effectiveJobId);

  function resolveDefaultName(): string {
    const jobName =
      (pickedJob ? jobDisplayName(pickedJob) : undefined) ||
      selectedJobOption?.label?.trim() ||
      'Job';
    const estimateName =
      selectedQuote?.name?.trim() ||
      selectedQuote?.quoteNumber?.trim() ||
      (selectedQuoteId ? selectedQuoteId.slice(0, 8) : 'Estimate');
    return `${jobName} - ${estimateName}`;
  }

  async function handleSubmit() {
    if (!selectedQuoteId || !effectiveJobId) return;
    startCreating();
    setError(null);
    try {
      const result = await createRfqAction({
        jobId: effectiveJobId,
        quoteId: selectedQuoteId,
        name: name.trim() || resolveDefaultName(),
        note: description || undefined,
        includePricing: true,
        includeQuantities: true,
        selectedItemIds: Array.from(selectedItemIds),
      });
      if (result.success) {
        if (result.rfq?.id) {
          resetPhase();
          handleOpenChange(false);
          router.push(`/rfqs/${result.rfq.id}`);
          router.refresh();
          return;
        }
        resetPhase();
        handleOpenChange(false);
        router.refresh();
      } else {
        setError(result.error ?? 'Failed to create RFQ');
        resetPhase();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create RFQ');
      resetPhase();
    }
  }

  return (
    <>
    <BottomFormDrawer
      open={open}
      onOpenChange={handleOpenChange}
      title="Create RFQ"
      preventClose={busy}
      description={
        step === 'scope' && selectedEstimateLabel
          ? `Estimate: ${selectedEstimateLabel}`
          : STEP_LABELS[step]
      }
      icon={<Send className="h-5 w-5" />}
    >
      {/* Step pills */}
      <div className="border-b border-slate-200 px-12 py-3">
        <ol className="flex flex-wrap gap-2 text-xs">
          {STEPS.map((s, i) => (
            <li
              key={s}
              className={`rounded-full px-3 py-1 ${
                i === stepIndex
                  ? 'bg-slate-900 text-white'
                  : i < stepIndex
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-slate-100 text-slate-500'
              }`}
            >
              {i + 1}. {STEP_LABELS[s]}
            </li>
          ))}
        </ol>
      </div>

      <BottomFormDrawerBody>
        {step === 'details' && (
          <div className="space-y-6">
            <FormJobPickerField
              value={effectiveJobId}
              selectedJob={pickedJob}
              jobs={jobs}
              onJobSelect={handleJobPicked}
            />

            {/* Estimate selection */}
            <div className="grid grid-cols-1 gap-x-6 md:grid-cols-2">
              <div className="space-y-3">
                <Label className="text-sm font-medium">
                  Select Estimate <span className="text-destructive">*</span>
                </Label>
                <p className="text-sm text-muted-foreground">
                  Choose which estimate to base this RFQ on. You can select specific scope items in the next step.
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
                          name="rfq-estimate"
                          value={q.id}
                          checked={selectedQuoteId === q.id}
                          onChange={() => setSelectedQuoteId(q.id)}
                          className="h-4 w-4 text-emerald-600"
                        />
                        <div className="min-w-0 flex-1">
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

            {/* Name + Description */}
            <div className="grid grid-cols-1 gap-x-6 gap-y-5 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="rfq-name">Name</Label>
                <Input
                  id="rfq-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="RFQ name"
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="rfq-description">Description</Label>
                <Textarea
                  id="rfq-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Brief description of what this RFQ covers..."
                  rows={3}
                />
              </div>
            </div>
          </div>
        )}

        {step === 'scope' && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Select the line items to include in this RFQ. Groups and assemblies can be toggled to select/deselect all children.
            </p>

            {lineItemsLoading ? (
              <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading line items...
              </div>
            ) : groups.length === 0 ? (
              <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                This estimate has no line items. Add items to the estimate first.
              </p>
            ) : (
              <LineItemsProvider
                groups={groups}
                mode="selection"
                compact
                selection={{
                  selectedIds: selectedItemIds,
                  onChange: setSelectedItemIds,
                }}
              >
                <LineItemsTable />
              </LineItemsProvider>
            )}
          </div>
        )}

        <BottomFormDrawerError error={error} />
      </BottomFormDrawerBody>

      <BottomFormDrawerFooter>
        {step === 'scope' && (
          <Button
            variant="outline"
            size="lg"
            className="mr-auto"
            disabled={busy}
            onClick={handleBack}
          >
            Back
          </Button>
        )}
        <Button
          variant="outline"
          size="lg"
          disabled={busy}
          onClick={() => handleOpenChange(false)}
        >
          Cancel
        </Button>
        {step === 'details' ? (
          <Button size="lg" onClick={handleNextStep} disabled={!selectedQuoteId}>
            Next: Select Scope
          </Button>
        ) : (
          <>
            <span className="text-xs text-muted-foreground">
              {selectedItemIds.size} item{selectedItemIds.size !== 1 ? 's' : ''} selected
            </span>
            <Button
              size="lg"
              onClick={handleSubmit}
              disabled={busy || selectedItemIds.size === 0}
            >
              {busy ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {phase === 'opening' ? 'Opening…' : 'Creating…'}
                </>
              ) : (
                'Create RFQ'
              )}
            </Button>
          </>
        )}
      </BottomFormDrawerFooter>
    </BottomFormDrawer>
    <CreateSubmitOverlay phase={phase} entityLabel="RFQ" />
    </>
  );
}
