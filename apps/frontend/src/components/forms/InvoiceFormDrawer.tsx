'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { standardSchemaResolver } from '@hookform/resolvers/standard-schema';
import { z } from 'zod';
import { ChevronRight, Loader2, Receipt } from 'lucide-react';
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
import { FormJobPickerField } from '@/components/forms/FormJobPickerField';
import { isArchivedStatus } from '@/components/shared/archive-list';
import { entityDisplayLabel } from '@/components/shared/entity-label';
import { formatAddress, formatCurrency } from '@/components/shared/detail';
import { jobDisplayName, type JobOption } from '@/components/shared/job-label';
import { createInvoiceAction } from '@/app/(app)/mutations';
import { fetchInvoicesAction } from '@/app/(app)/invoices/actions';
import {
  fetchWorkOrderByIdAction,
  getWorkOrderLineItemsAction,
} from '@/app/(app)/work-orders/actions';
import { fetchJobByIdAction } from '@/app/(app)/jobs/actions';
import { fetchJobWorkOrdersAction } from '@/app/(app)/jobs/[id]/actions';
import {
  CreateSubmitOverlay,
  useCreateSubmitPhase,
} from '@/components/forms/CreateSubmitOverlay';
import {
  amountsWithinTolerance,
  applyFlatPercentToRemaining,
  applyInvoiceProgressToGroups,
  buildPreviouslyInvoicedMap,
  flattenAllocatableLines,
  formatFlatPercentInput,
  invoicedAmountsRecordFromMap,
  itemMatchKeys,
  scaleAllocationMapToTotal,
  setItemAmountInMap,
  suggestedFlatPercent,
  sumLineRemaining,
  sumPriorInvoiceTotals,
  sumUniqueInvoicedAmounts,
  workOrderHeaderTotal,
} from '@/components/invoices/invoice-line-progress';
import type { ApiGroup } from '@/components/line-items';
import type { Invoice, Job, WorkOrder } from '@/types/api';

const invoiceFormSchema = z.object({
  workOrderId: z.string().min(1, 'Work order is required'),
  totalAmount: z.number().optional(),
  issueDate: z.string().optional(),
  dueDate: z.string().optional(),
  note: z.string().optional(),
});

type InvoiceFormValues = z.infer<typeof invoiceFormSchema>;

type WizardStep = 'details' | 'allocation' | 'lines' | 'confirm';
type AllocationMethod = 'flatAmount' | 'flatPercent' | 'perLine';

const STEP_LABELS: Record<WizardStep, string> = {
  details: 'Details',
  allocation: 'Amount & allocation',
  lines: 'Line amounts',
  confirm: 'Confirm',
};

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function addDaysISO(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  if (!y || !m || !d) return isoDate;
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + days);
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function workOrderCardLabel(wo: WorkOrder): string {
  return entityDisplayLabel(
    wo.internalNumber,
    wo.name,
    wo.workOrderNumber,
    wo.externalId,
  );
}

function formatJobAddress(job?: Job | null): string {
  if (!job) return '';
  return formatAddress(
    (job.address as Record<string, unknown> | undefined) ?? {},
    {
      full: true,
      fallback: {
        suburb: job.addressSuburb,
        state: job.addressState,
        postcode: job.addressPostcode,
        country: job.addressCountry,
      },
    },
  );
}

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

export interface InvoiceFormDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workOrders: WorkOrder[];
  /** Job options for the job picker (Create Invoice from list). */
  jobs?: JobOption[];
  /** Map of job id → display name for dropdown prefixes. */
  jobNameById?: Record<string, string>;
  /** Jobs keyed by id for address / context card. */
  jobById?: Record<string, Job>;
  /** Single job context (e.g. work order detail / job-scoped invoices). */
  job?: Job | null;
  /** Pre-select a work order (e.g. from work order detail). */
  defaultWorkOrderId?: string;
}

export function InvoiceFormDrawer({
  open,
  onOpenChange,
  workOrders,
  jobs,
  jobNameById,
  jobById,
  job,
  defaultWorkOrderId,
}: InvoiceFormDrawerProps) {
  const router = useRouter();
  const { phase, busy, startCreating, resetPhase } =
    useCreateSubmitPhase();
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<WizardStep>('details');
  const [allocationMethod, setAllocationMethod] =
    useState<AllocationMethod>('flatAmount');
  const [flatAmountInput, setFlatAmountInput] = useState('');
  const [flatPercent, setFlatPercent] = useState('');
  const [siblingInvoices, setSiblingInvoices] = useState<Invoice[]>([]);
  const [groups, setGroups] = useState<ApiGroup[]>([]);
  const [contextLoading, setContextLoading] = useState(false);
  const [loadedWo, setLoadedWo] = useState<WorkOrder | null>(null);
  const [resolvedJob, setResolvedJob] = useState<Job | null>(null);
  const [amountsByKey, setAmountsByKey] = useState<Map<string, number>>(
    () => new Map(),
  );
  const [pickedJobId, setPickedJobId] = useState('');
  const [pickedJob, setPickedJob] = useState<Job | null>(null);
  const [jobWorkOrders, setJobWorkOrders] = useState<WorkOrder[]>([]);
  const [workOrdersLoading, setWorkOrdersLoading] = useState(false);

  const effectiveJobId = pickedJobId || job?.id || '';

  const activeWorkOrders = useMemo(() => {
    const source =
      jobWorkOrders.length > 0
        ? jobWorkOrders
        : workOrders.filter((wo) =>
            effectiveJobId ? wo.jobId === effectiveJobId : false,
          );
    return source.filter((wo) => !isArchivedStatus(wo.status?.name));
  }, [jobWorkOrders, workOrders, effectiveJobId]);

  const form = useForm<InvoiceFormValues>({
    resolver: standardSchemaResolver(invoiceFormSchema),
    defaultValues: {
      workOrderId: defaultWorkOrderId ?? '',
      totalAmount: undefined,
      issueDate: todayISO(),
      dueDate: addDaysISO(todayISO(), 7),
      note: '',
    },
  });

  const issueDate = form.watch('issueDate');
  const workOrderId = form.watch('workOrderId');
  const totalAmount = form.watch('totalAmount');

  const selectedWo = useMemo(
    () => activeWorkOrders.find((wo) => wo.id === workOrderId) ?? null,
    [activeWorkOrders, workOrderId],
  );

  const contextWo = loadedWo ?? selectedWo;
  const woTotal = useMemo(
    () => workOrderHeaderTotal(contextWo, groups),
    [contextWo, groups],
  );
  const priorInvoiced = useMemo(
    () => sumPriorInvoiceTotals(siblingInvoices),
    [siblingInvoices],
  );

  const baseProgressGroups = useMemo(() => {
    const previously = buildPreviouslyInvoicedMap(siblingInvoices);
    return applyInvoiceProgressToGroups(groups, previously);
  }, [groups, siblingInvoices]);

  const remaining = useMemo(() => {
    if (baseProgressGroups.length) {
      return sumLineRemaining(baseProgressGroups);
    }
    return Math.max(0, roundMoney(woTotal - priorInvoiced));
  }, [baseProgressGroups, woTotal, priorInvoiced]);

  const progressGroups = useMemo(() => {
    const previously = buildPreviouslyInvoicedMap(siblingInvoices);
    return applyInvoiceProgressToGroups(groups, previously, amountsByKey);
  }, [groups, siblingInvoices, amountsByKey]);

  const lineRows = useMemo(
    () => flattenAllocatableLines(progressGroups),
    [progressGroups],
  );

  const allocatedSum = useMemo(
    () => sumUniqueInvoicedAmounts(amountsByKey, progressGroups),
    [amountsByKey, progressGroups],
  );

  const invoiceAmount = totalAmount ?? 0;

  const visibleSteps = useMemo((): WizardStep[] => {
    if (allocationMethod === 'perLine') {
      return ['details', 'allocation', 'lines', 'confirm'];
    }
    return ['details', 'allocation', 'confirm'];
  }, [allocationMethod]);

  const stepIndex = Math.max(0, visibleSteps.indexOf(step));

  const contextJob = useMemo(() => {
    if (resolvedJob) return resolvedJob;
    if (pickedJob && (!selectedWo?.jobId || pickedJob.id === selectedWo.jobId)) {
      return pickedJob;
    }
    if (job && selectedWo?.jobId && job.id === selectedWo.jobId) return job;
    if (selectedWo?.jobId && jobById?.[selectedWo.jobId]) {
      return jobById[selectedWo.jobId];
    }
    return job ?? null;
  }, [resolvedJob, pickedJob, job, jobById, selectedWo]);

  const resetWizard = useCallback(() => {
    setStep('details');
    setAllocationMethod('flatAmount');
    setFlatAmountInput('');
    setFlatPercent('');
    setSiblingInvoices([]);
    setGroups([]);
    setLoadedWo(null);
    setResolvedJob(null);
    setAmountsByKey(new Map());
    setError(null);
    setPickedJobId('');
    setPickedJob(null);
    setJobWorkOrders([]);
    resetPhase();
    form.reset({
      workOrderId: defaultWorkOrderId ?? '',
      totalAmount: undefined,
      issueDate: todayISO(),
      dueDate: addDaysISO(todayISO(), 7),
      note: '',
    });
  }, [defaultWorkOrderId, form, resetPhase]);

  useEffect(() => {
    if (!open) {
      resetWizard();
      return;
    }
    const initialJobId =
      job?.id ??
      workOrders.find((wo) => wo.id === defaultWorkOrderId)?.jobId ??
      '';
    setPickedJobId(initialJobId);
    setPickedJob(
      job?.id && job.id === initialJobId
        ? job
        : (initialJobId && jobById?.[initialJobId]) || null,
    );
    if (defaultWorkOrderId) {
      form.setValue('workOrderId', defaultWorkOrderId);
    }
  }, [open, defaultWorkOrderId, form, resetWizard, job, jobById, workOrders]);

  useEffect(() => {
    if (!open) return;
    if (!effectiveJobId) {
      setJobWorkOrders([]);
      return;
    }
    let cancelled = false;
    setWorkOrdersLoading(true);
    fetchJobWorkOrdersAction(effectiveJobId)
      .then((data) => {
        if (!cancelled) setJobWorkOrders(data ?? []);
      })
      .catch((err) => {
        console.error('[frontend:InvoiceFormDrawer.fetchJobWorkOrders]', err);
        if (!cancelled) setJobWorkOrders([]);
      })
      .finally(() => {
        if (!cancelled) setWorkOrdersLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, effectiveJobId]);

  function handleJobPicked(next: Job) {
    setPickedJobId(next.id);
    setPickedJob(next);
    form.setValue('workOrderId', '');
    setError(null);
  }

  useEffect(() => {
    if (issueDate) {
      form.setValue('dueDate', addDaysISO(issueDate, 7));
    }
  }, [issueDate, form]);

  useEffect(() => {
    if (!open || !workOrderId) {
      setSiblingInvoices([]);
      setGroups([]);
      setLoadedWo(null);
      setResolvedJob(null);
      return;
    }

    let cancelled = false;
    setContextLoading(true);

    const wo = activeWorkOrders.find((w) => w.id === workOrderId);
    const knownJob =
      (job && wo?.jobId === job.id ? job : null) ??
      (wo?.jobId && jobById?.[wo.jobId] ? jobById[wo.jobId] : null);

    void (async () => {
      try {
        const [invRes, linesRes, fetchedJob, fetchedWo] = await Promise.all([
          fetchInvoicesAction({ workOrderId, limit: 100 }),
          getWorkOrderLineItemsAction(workOrderId, { limit: 500 }),
          knownJob
            ? Promise.resolve(knownJob)
            : wo?.jobId
              ? fetchJobByIdAction(wo.jobId)
              : Promise.resolve(null),
          fetchWorkOrderByIdAction(workOrderId),
        ]);
        if (cancelled) return;

        const siblings = invRes?.data ?? [];
        setSiblingInvoices(siblings);
        setLoadedWo(fetchedWo ?? wo ?? null);

        const nextGroups = (linesRes.success && linesRes.groups
          ? (linesRes.groups as ApiGroup[])
          : []) as ApiGroup[];
        const previously = buildPreviouslyInvoicedMap(siblings);
        const stamped = applyInvoiceProgressToGroups(nextGroups, previously);

        const rem =
          stamped.length > 0
            ? sumLineRemaining(stamped)
            : Math.max(
                0,
                roundMoney(
                  workOrderHeaderTotal(fetchedWo ?? wo, stamped) -
                    sumPriorInvoiceTotals(siblings),
                ),
              );
        setGroups(stamped);
        setAmountsByKey(new Map());
        setFlatAmountInput(rem > 0 ? String(rem) : '');
        setFlatPercent(
          rem > 0
            ? formatFlatPercentInput(suggestedFlatPercent({ invoiceAmount: rem, remaining: rem }))
            : '',
        );
        setResolvedJob(fetchedJob);
      } catch (err) {
        console.error('[frontend:InvoiceFormDrawer.loadContext]', err);
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : 'Failed to load work order invoice context',
          );
        }
      } finally {
        if (!cancelled) setContextLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, workOrderId, activeWorkOrders, job, jobById, form]);

  const flatAmountPreview = useMemo(() => {
    if (allocationMethod !== 'flatAmount') return null;
    const amt = Number(flatAmountInput);
    if (!Number.isFinite(amt) || amt <= 0 || remaining <= 0) return null;
    const pct = suggestedFlatPercent({ invoiceAmount: amt, remaining });
    const map = applyFlatPercentToRemaining({
      groups: baseProgressGroups,
      percent: pct,
    });
    return {
      percent: pct,
      lineTotal: sumUniqueInvoicedAmounts(map, baseProgressGroups),
    };
  }, [allocationMethod, flatAmountInput, remaining, baseProgressGroups]);

  const flatPercentPreview = useMemo(() => {
    if (allocationMethod !== 'flatPercent') return null;
    const pct = Number(flatPercent);
    if (!Number.isFinite(pct) || pct <= 0) return null;
    const map = applyFlatPercentToRemaining({
      groups: baseProgressGroups,
      percent: pct,
    });
    return sumUniqueInvoicedAmounts(map, baseProgressGroups);
  }, [allocationMethod, flatPercent, baseProgressGroups]);

  function allocationFromFlatPercent(
    groupsForAllocation: ApiGroup[] = baseProgressGroups,
  ): Map<string, number> {
    const pct = Number(flatPercent);
    return applyFlatPercentToRemaining({
      groups: groupsForAllocation,
      percent: Number.isFinite(pct) ? pct : 0,
    });
  }

  function allocationFromFlatAmount(
    groupsForAllocation: ApiGroup[] = baseProgressGroups,
  ): Map<string, number> {
    const amt = Number(flatAmountInput);
    if (!Number.isFinite(amt) || amt <= 0 || remaining <= 0) {
      return new Map();
    }
    const pct = suggestedFlatPercent({ invoiceAmount: amt, remaining });
    return applyFlatPercentToRemaining({
      groups: groupsForAllocation,
      percent: pct,
    });
  }

  function buildAllocationMap(): Map<string, number> {
    if (step === 'confirm' && amountsByKey.size > 0) {
      return amountsByKey;
    }
    if (allocationMethod === 'flatPercent') {
      return allocationFromFlatPercent();
    }
    if (allocationMethod === 'flatAmount') {
      return allocationFromFlatAmount();
    }
    return amountsByKey;
  }

  function applyFlatAllocationToState(params: {
    map: Map<string, number>;
    headerTotal: number;
  }) {
    const sum = sumUniqueInvoicedAmounts(params.map, baseProgressGroups);
    const finalMap = amountsWithinTolerance(sum, params.headerTotal)
      ? params.map
      : scaleAllocationMapToTotal({
          amountsByKey: params.map,
          groups: baseProgressGroups,
          targetTotal: params.headerTotal,
        });
    form.setValue('totalAmount', params.headerTotal);
    setAmountsByKey(finalMap);
  }

  function goNext() {
    setError(null);
    if (step === 'details') {
      if (!effectiveJobId) {
        setError('Job is required');
        return;
      }
      if (!workOrderId) {
        setError('Work order is required');
        return;
      }
      if (contextLoading) {
        setError('Work order context is still loading');
        return;
      }
      if (remaining <= 0) {
        setError('Nothing remaining to invoice on this work order');
        return;
      }
      setStep('allocation');
      return;
    }

    if (step === 'allocation') {
      if (allocationMethod === 'flatAmount') {
        const amt = Number(flatAmountInput);
        if (!Number.isFinite(amt) || amt <= 0) {
          setError('Enter an invoice amount greater than zero');
          return;
        }
        if (amt > remaining + 0.02) {
          setError(
            `Amount cannot exceed the remaining balance (${formatCurrency(remaining)})`,
          );
          return;
        }
        const pct = suggestedFlatPercent({ invoiceAmount: amt, remaining });
        setFlatPercent(formatFlatPercentInput(pct));
        applyFlatAllocationToState({
          map: allocationFromFlatAmount(),
          headerTotal: roundMoney(amt),
        });
        setStep('confirm');
        return;
      }

      if (allocationMethod === 'flatPercent') {
        const pct = Number(flatPercent);
        if (!Number.isFinite(pct) || pct <= 0 || pct > 100) {
          setError('Enter a percentage between 0 and 100');
          return;
        }
        const map = allocationFromFlatPercent();
        const sum = roundMoney(sumUniqueInvoicedAmounts(map, baseProgressGroups));
        if (sum <= 0) {
          setError('Percentage must allocate at least one line item');
          return;
        }
        if (sum > remaining + 0.02) {
          setError(
            `This percentage invoices ${formatCurrency(sum)}, which exceeds the remaining balance (${formatCurrency(remaining)})`,
          );
          return;
        }
        applyFlatAllocationToState({ map, headerTotal: sum });
        setStep('confirm');
        return;
      }

      // perLine
      setAmountsByKey(new Map());
      form.setValue('totalAmount', undefined);
      setStep('lines');
      return;
    }

    if (step === 'lines') {
      if (lineRows.length > 0 && allocatedSum <= 0) {
        setError('Enter an amount for at least one line item');
        return;
      }
      if (
        lineRows.length > 0 &&
        allocatedSum > remaining + 0.02
      ) {
        setError(
          `Line amounts (${formatCurrency(allocatedSum)}) cannot exceed the remaining balance (${formatCurrency(remaining)})`,
        );
        return;
      }
      form.setValue('totalAmount', roundMoney(allocatedSum));
      setStep('confirm');
    }
  }

  function goBack() {
    setError(null);
    if (step === 'confirm') {
      if (allocationMethod === 'perLine') {
        setStep('lines');
        return;
      }
      setStep('allocation');
      return;
    }
    if (step === 'lines') {
      setStep('allocation');
      return;
    }
    if (step === 'allocation') {
      setStep('details');
    }
  }

  async function onCreate() {
    const values = form.getValues();
    const selected = activeWorkOrders.find((wo) => wo.id === values.workOrderId);
    if (!selected) {
      setError('Selected work order was not found');
      return;
    }

    const rawAllocation = buildAllocationMap();
    const headerTotal = values.totalAmount ?? 0;
    const allocation =
      baseProgressGroups.length > 0 && headerTotal > 0
        ? scaleAllocationMapToTotal({
            amountsByKey: rawAllocation,
            groups: baseProgressGroups,
            targetTotal: headerTotal,
          })
        : rawAllocation;
    const invoicedAmounts = invoicedAmountsRecordFromMap(allocation);

    startCreating();
    setError(null);
    try {
      const result = await createInvoiceAction({
        workOrderId: selected.id,
        ...(selected.purchaseOrderId
          ? { purchaseOrderId: selected.purchaseOrderId }
          : {}),
        totalAmount: values.totalAmount ?? undefined,
        issueDate: values.issueDate
          ? new Date(values.issueDate).toISOString()
          : undefined,
        dueDate: values.dueDate
          ? new Date(values.dueDate).toISOString()
          : undefined,
        note: values.note || undefined,
        invoicedAmounts,
      });
      if (result.success) {
        resetPhase();
        if (result.invoice?.id) {
          onOpenChange(false);
          router.push(`/invoices/${result.invoice.id}`);
          router.refresh();
          return;
        }
        onOpenChange(false);
        router.refresh();
      } else {
        setError(result.error ?? 'Failed to submit invoice');
        resetPhase();
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to submit invoice',
      );
      resetPhase();
    }
  }

  const jobName =
    (contextJob ? jobDisplayName(contextJob) : undefined) ??
    (selectedWo?.jobId ? jobNameById?.[selectedWo.jobId] : undefined) ??
    '—';
  const address = formatJobAddress(contextJob) || '—';
  const woRef = selectedWo
    ? entityDisplayLabel(
        selectedWo.internalNumber,
        selectedWo.name,
        selectedWo.workOrderNumber,
        selectedWo.externalId,
      )
    : '—';

  return (
    <>
      <BottomFormDrawer
        open={open}
        onOpenChange={onOpenChange}
        title="Create Invoice"
        description={STEP_LABELS[step]}
        icon={<Receipt className="h-5 w-5" />}
        preventClose={busy}
      >
        <div className="border-b border-slate-200 px-12 py-3">
          <ol className="flex flex-wrap gap-2 text-xs">
            {visibleSteps.map((s, i) => (
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

        <div className="flex min-h-0 flex-1 flex-col">
          <BottomFormDrawerBody>
            {step === 'details' && (
              <div className="space-y-6">
                <FormJobPickerField
                  value={effectiveJobId}
                  selectedJob={pickedJob ?? (job?.id === effectiveJobId ? job : null)}
                  jobs={jobs}
                  onJobSelect={handleJobPicked}
                  error={!effectiveJobId && error === 'Job is required' ? error : null}
                />

                <div className="grid grid-cols-1 gap-x-6 md:grid-cols-2">
                  <div className="space-y-3">
                    <Label className="text-sm font-medium">
                      Select Work Order <span className="text-destructive">*</span>
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Choose which work order to invoice.
                    </p>

                    {workOrdersLoading ? (
                      <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Loading work orders...
                      </div>
                    ) : !effectiveJobId ? (
                      <p className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-muted-foreground">
                        Select a job to load work orders.
                      </p>
                    ) : activeWorkOrders.length === 0 ? (
                      <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                        No work orders found for this job. Create a work order first.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {activeWorkOrders.map((wo) => (
                          <label
                            key={wo.id}
                            className={`flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 transition-colors ${
                              workOrderId === wo.id
                                ? 'border-emerald-300 bg-emerald-50 ring-1 ring-emerald-200'
                                : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                            }`}
                          >
                            <input
                              type="radio"
                              name="invoice-work-order"
                              value={wo.id}
                              checked={workOrderId === wo.id}
                              onChange={() =>
                                form.setValue('workOrderId', wo.id, {
                                  shouldValidate: true,
                                })
                              }
                              className="h-4 w-4 text-emerald-600"
                            />
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium">
                                {workOrderCardLabel(wo)}
                              </p>
                              <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                                {wo.workOrderType?.name && (
                                  <span>{wo.workOrderType.name}</span>
                                )}
                                {wo.status?.name && (
                                  <span className="rounded bg-slate-100 px-1.5 py-0.5">
                                    {wo.status.name}
                                  </span>
                                )}
                                {wo.totalAmount != null && wo.totalAmount !== '' && (
                                  <span>
                                    ${Number(wo.totalAmount).toLocaleString()}
                                  </span>
                                )}
                              </div>
                            </div>
                            <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
                          </label>
                        ))}
                      </div>
                    )}
                    {form.formState.errors.workOrderId && (
                      <p className="text-sm text-destructive">
                        {form.formState.errors.workOrderId.message}
                      </p>
                    )}
                  </div>
                </div>

                {selectedWo && (
                  <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
                    {contextLoading ? (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Loading work order context…
                      </div>
                    ) : (
                      <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3 text-sm">
                        <div>
                          <dt className="text-xs text-slate-500">WO total</dt>
                          <dd className="font-medium text-slate-900">
                            {formatCurrency(woTotal)}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-xs text-slate-500">
                            Already invoiced
                          </dt>
                          <dd className="font-medium text-slate-900">
                            {formatCurrency(priorInvoiced)}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-xs text-slate-500">Remaining</dt>
                          <dd className="font-semibold text-slate-900">
                            {formatCurrency(remaining)}
                          </dd>
                        </div>
                      </dl>
                    )}
                  </div>
                )}

                <div className="grid grid-cols-1 gap-x-6 gap-y-5 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="issueDate">Issue Date</Label>
                    <Input
                      id="issueDate"
                      type="date"
                      {...form.register('issueDate')}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="dueDate">Due Date</Label>
                    <Input
                      id="dueDate"
                      type="date"
                      {...form.register('dueDate')}
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
            )}

            {step === 'allocation' && (
              <div className="space-y-5">
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
                  <p className="text-slate-600">
                    Remaining balance to invoice:{' '}
                    <span className="font-semibold text-slate-900">
                      {formatCurrency(remaining)}
                    </span>
                  </p>
                </div>
                <p className="text-sm text-muted-foreground">
                  Choose how to distribute this invoice across line items.
                </p>
                <div className="space-y-3">
                  <label
                    className={`flex cursor-pointer flex-col gap-3 rounded-lg border px-4 py-3 ${
                      allocationMethod === 'flatAmount'
                        ? 'border-emerald-300 bg-emerald-50 ring-1 ring-emerald-200'
                        : 'border-slate-200'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="radio"
                        name="allocationMethod"
                        checked={allocationMethod === 'flatAmount'}
                        onChange={() => setAllocationMethod('flatAmount')}
                      />
                      <span className="text-sm font-medium text-slate-900">
                        Invoice a flat dollar amount
                      </span>
                    </div>
                    {allocationMethod === 'flatAmount' && (
                      <div className="ml-7 space-y-2">
                        <div className="flex max-w-xs items-center gap-2">
                          <span className="text-sm text-slate-600">$</span>
                          <Input
                            type="number"
                            min="0.01"
                            step="0.01"
                            value={flatAmountInput}
                            onChange={(e) => setFlatAmountInput(e.target.value)}
                            aria-label="Invoice dollar amount"
                            placeholder="0.00"
                          />
                        </div>
                        <p className="text-xs text-slate-500">
                          We calculate the equivalent % and apply it to each line
                          item.
                        </p>
                        {flatAmountPreview && (
                          <p className="text-xs text-emerald-700">
                            {formatFlatPercentInput(flatAmountPreview.percent)}%
                            per line →{' '}
                            {formatCurrency(flatAmountPreview.lineTotal)} total
                          </p>
                        )}
                      </div>
                    )}
                  </label>

                  <label
                    className={`flex cursor-pointer flex-col gap-3 rounded-lg border px-4 py-3 ${
                      allocationMethod === 'flatPercent'
                        ? 'border-emerald-300 bg-emerald-50 ring-1 ring-emerald-200'
                        : 'border-slate-200'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="radio"
                        name="allocationMethod"
                        checked={allocationMethod === 'flatPercent'}
                        onChange={() => setAllocationMethod('flatPercent')}
                      />
                      <span className="text-sm font-medium text-slate-900">
                        Invoice a flat percentage
                      </span>
                    </div>
                    {allocationMethod === 'flatPercent' && (
                      <div className="ml-7 space-y-2">
                        <div className="flex max-w-xs items-center gap-2">
                          <Input
                            type="number"
                            min="0.01"
                            max="100"
                            step="0.01"
                            value={flatPercent}
                            onChange={(e) => setFlatPercent(e.target.value)}
                            aria-label="Percent of each line item"
                          />
                          <span className="text-sm text-slate-600">%</span>
                        </div>
                        <p className="text-xs text-slate-500">
                          Applied to each line item&apos;s remaining balance.
                        </p>
                        {flatPercentPreview != null && (
                          <p className="text-xs text-emerald-700">
                            Line amounts total {formatCurrency(flatPercentPreview)}
                          </p>
                        )}
                      </div>
                    )}
                  </label>

                  <label
                    className={`flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 ${
                      allocationMethod === 'perLine'
                        ? 'border-emerald-300 bg-emerald-50 ring-1 ring-emerald-200'
                        : 'border-slate-200'
                    }`}
                  >
                    <input
                      type="radio"
                      name="allocationMethod"
                      checked={allocationMethod === 'perLine'}
                      onChange={() => setAllocationMethod('perLine')}
                    />
                    <span className="text-sm font-medium text-slate-900">
                      Enter a dollar amount per line item
                    </span>
                  </label>
                </div>
              </div>
            )}

            {step === 'lines' && (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <p className="text-muted-foreground">
                    Enter an amount for each line (max = remaining). The invoice
                    total is the sum of these amounts.
                  </p>
                  <p className="font-medium text-slate-900">
                    Invoice total: {formatCurrency(allocatedSum)}
                  </p>
                </div>

                {lineRows.length === 0 ? (
                  <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                    No line items found on this work order. You can still create
                    the invoice with the header total only.
                  </p>
                ) : (
                  <div className="overflow-x-auto rounded-lg border border-slate-200">
                    <table className="min-w-full text-sm">
                      <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                        <tr>
                          <th className="px-3 py-2 font-medium">Group</th>
                          <th className="px-3 py-2 font-medium">Item</th>
                          <th className="px-3 py-2 font-medium text-right">
                            Line total
                          </th>
                          <th className="px-3 py-2 font-medium text-right">
                            Previously
                          </th>
                          <th className="px-3 py-2 font-medium text-right">
                            This invoice
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {lineRows.map((row) => {
                          const keys = itemMatchKeys(row.item);
                          const primary = keys[0] ?? `${row.groupLabel}-${row.item.name}`;
                          let current = row.item.invoiced ?? 0;
                          for (const key of keys) {
                            const v = amountsByKey.get(key);
                            if (v != null) {
                              current = v;
                              break;
                            }
                          }
                          return (
                            <tr key={primary}>
                              <td className="px-3 py-2 text-slate-600">
                                {row.groupLabel}
                              </td>
                              <td className="px-3 py-2">
                                <div className="font-medium text-slate-900">
                                  {row.item.name ?? '—'}
                                </div>
                                {row.item.description ? (
                                  <div className="text-xs text-slate-500">
                                    {row.item.description}
                                  </div>
                                ) : null}
                              </td>
                              <td className="px-3 py-2 text-right font-mono">
                                {formatCurrency(row.lineTotal)}
                              </td>
                              <td className="px-3 py-2 text-right font-mono">
                                {formatCurrency(row.previouslyInvoiced)}
                              </td>
                              <td className="px-3 py-2 text-right">
                                <Input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  max={row.remaining}
                                  className="ml-auto h-8 w-28 text-right font-mono"
                                  value={Number.isFinite(current) ? current : 0}
                                  onChange={(e) => {
                                    const parsed = Number(e.target.value);
                                    const amount = Number.isFinite(parsed)
                                      ? Math.min(
                                          Math.max(0, parsed),
                                          row.remaining,
                                        )
                                      : 0;
                                    setAmountsByKey((prev) =>
                                      setItemAmountInMap({
                                        map: prev,
                                        item: row.item,
                                        amount: roundMoney(amount),
                                      }),
                                    );
                                  }}
                                />
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {step === 'confirm' && (
              <div className="space-y-5">
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
                  <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2 text-sm">
                    <div>
                      <dt className="text-xs text-slate-500">Job</dt>
                      <dd className="font-medium text-slate-900">{jobName}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-slate-500">Work order</dt>
                      <dd className="font-medium text-slate-900">{woRef}</dd>
                    </div>
                    <div className="sm:col-span-2">
                      <dt className="text-xs text-slate-500">Address</dt>
                      <dd className="font-medium text-slate-900">{address}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-slate-500">Invoice total</dt>
                      <dd className="font-semibold text-slate-900">
                        {formatCurrency(invoiceAmount)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-slate-500">Issue / due</dt>
                      <dd className="font-medium text-slate-900">
                        {form.getValues('issueDate') || '—'} →{' '}
                        {form.getValues('dueDate') || '—'}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-slate-500">Allocation</dt>
                      <dd className="font-medium text-slate-900">
                        {allocationMethod === 'flatAmount'
                          ? `Flat ${formatCurrency(Number(flatAmountInput) || invoiceAmount)} (${flatPercent}% per line)`
                          : allocationMethod === 'flatPercent'
                            ? `Flat ${flatPercent}% per line item`
                            : 'Per-line amounts'}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-slate-500">Lines allocated</dt>
                      <dd className="font-medium text-slate-900">
                        {formatCurrency(
                          sumUniqueInvoicedAmounts(
                            buildAllocationMap(),
                            progressGroups,
                          ),
                        )}
                      </dd>
                    </div>
                    {form.getValues('note') ? (
                      <div className="sm:col-span-2">
                        <dt className="text-xs text-slate-500">Note</dt>
                        <dd className="font-medium text-slate-900 whitespace-pre-wrap">
                          {form.getValues('note')}
                        </dd>
                      </div>
                    ) : null}
                  </dl>
                </div>
                <p className="text-sm text-muted-foreground">
                  A draft invoice will be created. Publish it from the invoice
                  page when ready.
                </p>
              </div>
            )}

            <BottomFormDrawerError error={error} />
          </BottomFormDrawerBody>

          <BottomFormDrawerFooter>
            <Button
              type="button"
              variant="outline"
              size="lg"
              disabled={busy}
              onClick={() =>
                step === 'details' ? onOpenChange(false) : goBack()
              }
            >
              {step === 'details' ? 'Cancel' : 'Back'}
            </Button>
            {step === 'confirm' ? (
              <Button
                type="button"
                size="lg"
                disabled={busy || contextLoading}
                onClick={() => void onCreate()}
              >
                {busy ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {phase === 'opening' ? 'Opening…' : 'Creating…'}
                  </>
                ) : (
                  'Create Invoice'
                )}
              </Button>
            ) : (
              <Button
                type="button"
                size="lg"
                disabled={busy || contextLoading}
                onClick={goNext}
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            )}
          </BottomFormDrawerFooter>
        </div>
      </BottomFormDrawer>
      <CreateSubmitOverlay phase={phase} entityLabel="invoice" />
    </>
  );
}
