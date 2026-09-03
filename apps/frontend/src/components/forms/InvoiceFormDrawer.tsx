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
import { isArchivedStatus } from '@/components/shared/archive-list';
import { entityDisplayLabel } from '@/components/shared/entity-label';
import { formatAddress, formatCurrency } from '@/components/shared/detail';
import { jobDisplayName } from '@/components/shared/job-label';
import { createInvoiceAction } from '@/app/(app)/mutations';
import { fetchInvoicesAction } from '@/app/(app)/invoices/actions';
import { getWorkOrderLineItemsAction } from '@/app/(app)/work-orders/actions';
import { fetchJobByIdAction } from '@/app/(app)/jobs/actions';
import {
  CreateSubmitOverlay,
  navigateToCreated,
  useCreateSubmitPhase,
} from '@/components/forms/CreateSubmitOverlay';
import {
  amountsWithinTolerance,
  applyFlatPercentToRemaining,
  applyInvoiceProgressToGroups,
  buildPreviouslyInvoicedMap,
  flattenAllocatableLines,
  invoicedAmountsRecordFromMap,
  itemMatchKeys,
  remainingAmountsByKey,
  setItemAmountInMap,
  sumPriorInvoiceTotals,
  sumUniqueInvoicedAmounts,
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

type WizardStep = 'details' | 'method' | 'lines' | 'confirm';
type AllocationMethod = 'flatPercent' | 'individual';

const STEP_LABELS: Record<WizardStep, string> = {
  details: 'Details',
  method: 'Allocation',
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

function asMoney(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return 0;
}

function workOrderLabel(
  wo: WorkOrder,
  jobNameById?: Record<string, string>,
): string {
  const woRef = entityDisplayLabel(
    wo.internalNumber,
    wo.name,
    wo.workOrderNumber,
    wo.externalId,
  );
  const jobName =
    (wo.jobId ? jobNameById?.[wo.jobId] : undefined)?.trim() || undefined;
  return jobName ? `${jobName} — ${woRef}` : woRef;
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
  jobNameById,
  jobById,
  job,
  defaultWorkOrderId,
}: InvoiceFormDrawerProps) {
  const router = useRouter();
  const { phase, busy, startCreating, startOpening, resetPhase } =
    useCreateSubmitPhase();
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<WizardStep>('details');
  const [allocationMethod, setAllocationMethod] =
    useState<AllocationMethod>('flatPercent');
  const [flatPercent, setFlatPercent] = useState('50');
  const [siblingInvoices, setSiblingInvoices] = useState<Invoice[]>([]);
  const [groups, setGroups] = useState<ApiGroup[]>([]);
  const [contextLoading, setContextLoading] = useState(false);
  const [resolvedJob, setResolvedJob] = useState<Job | null>(null);
  const [amountsByKey, setAmountsByKey] = useState<Map<string, number>>(
    () => new Map(),
  );

  const activeWorkOrders = useMemo(
    () => workOrders.filter((wo) => !isArchivedStatus(wo.status?.name)),
    [workOrders],
  );

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

  const woTotal = asMoney(selectedWo?.adjustedTotal ?? selectedWo?.totalAmount);
  const priorInvoiced = useMemo(
    () => sumPriorInvoiceTotals(siblingInvoices),
    [siblingInvoices],
  );
  const remaining = Math.max(0, roundMoney(woTotal - priorInvoiced));

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
  const isPartial =
    remaining > 0 && invoiceAmount > 0 && invoiceAmount < remaining - 0.005;
  const isFullRemaining =
    remaining > 0 && amountsWithinTolerance(invoiceAmount, remaining);

  const visibleSteps = useMemo((): WizardStep[] => {
    if (!isPartial) return ['details', 'confirm'];
    if (allocationMethod === 'flatPercent') {
      return ['details', 'method', 'confirm'];
    }
    return ['details', 'method', 'lines', 'confirm'];
  }, [isPartial, allocationMethod]);

  const stepIndex = Math.max(0, visibleSteps.indexOf(step));

  const contextJob = useMemo(() => {
    if (resolvedJob) return resolvedJob;
    if (job && selectedWo?.jobId && job.id === selectedWo.jobId) return job;
    if (selectedWo?.jobId && jobById?.[selectedWo.jobId]) {
      return jobById[selectedWo.jobId];
    }
    return job ?? null;
  }, [resolvedJob, job, jobById, selectedWo]);

  const resetWizard = useCallback(() => {
    setStep('details');
    setAllocationMethod('flatPercent');
    setFlatPercent('50');
    setSiblingInvoices([]);
    setGroups([]);
    setResolvedJob(null);
    setAmountsByKey(new Map());
    setError(null);
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
    if (defaultWorkOrderId) {
      form.setValue('workOrderId', defaultWorkOrderId);
    }
  }, [open, defaultWorkOrderId, form, resetWizard]);

  useEffect(() => {
    if (issueDate) {
      form.setValue('dueDate', addDaysISO(issueDate, 7));
    }
  }, [issueDate, form]);

  useEffect(() => {
    if (!open || !workOrderId) {
      setSiblingInvoices([]);
      setGroups([]);
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
        const [invRes, linesRes, fetchedJob] = await Promise.all([
          fetchInvoicesAction({ workOrderId, limit: 100 }),
          getWorkOrderLineItemsAction(workOrderId, { limit: 500 }),
          knownJob
            ? Promise.resolve(knownJob)
            : wo?.jobId
              ? fetchJobByIdAction(wo.jobId)
              : Promise.resolve(null),
        ]);
        if (cancelled) return;

        const siblings = invRes?.data ?? [];
        setSiblingInvoices(siblings);
        const prior = sumPriorInvoiceTotals(siblings);
        const total = asMoney(wo?.adjustedTotal ?? wo?.totalAmount);
        const rem = Math.max(0, roundMoney(total - prior));
        form.setValue('totalAmount', rem > 0 ? rem : undefined);

        const nextGroups = (linesRes.success && linesRes.groups
          ? (linesRes.groups as ApiGroup[])
          : []) as ApiGroup[];
        const previously = buildPreviouslyInvoicedMap(siblings);
        const stamped = applyInvoiceProgressToGroups(nextGroups, previously);
        setGroups(stamped);
        setAmountsByKey(remainingAmountsByKey(stamped));
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

  function buildAllocationMap(): Map<string, number> {
    if (!isPartial || isFullRemaining) {
      return remainingAmountsByKey(progressGroups);
    }
    if (allocationMethod === 'flatPercent') {
      const pct = Number(flatPercent);
      return applyFlatPercentToRemaining({
        groups: progressGroups,
        percent: Number.isFinite(pct) ? pct : 0,
      });
    }
    return amountsByKey;
  }

  function goNext() {
    setError(null);
    if (step === 'details') {
      if (!workOrderId) {
        setError('Work order is required');
        return;
      }
      if (invoiceAmount <= 0) {
        setError('Enter an invoice amount greater than zero');
        return;
      }
      if (invoiceAmount > remaining + 0.02) {
        setError(
          `Invoice amount cannot exceed the remaining balance (${formatCurrency(remaining)})`,
        );
        return;
      }
      if (isPartial) {
        setStep('method');
        return;
      }
      setAmountsByKey(remainingAmountsByKey(progressGroups));
      setStep('confirm');
      return;
    }

    if (step === 'method') {
      if (allocationMethod === 'flatPercent') {
        const pct = Number(flatPercent);
        if (!Number.isFinite(pct) || pct <= 0 || pct > 100) {
          setError('Enter a percentage between 0 and 100');
          return;
        }
        const next = applyFlatPercentToRemaining({
          groups: progressGroups,
          percent: pct,
        });
        const sum = sumUniqueInvoicedAmounts(next, progressGroups);
        if (!amountsWithinTolerance(sum, invoiceAmount)) {
          // Scale to match header amount when % of remaining doesn't match typed total.
          const scale = sum > 0 ? invoiceAmount / sum : 0;
          const scaled = new Map<string, number>();
          for (const [key, value] of next) {
            scaled.set(key, roundMoney(value * scale));
          }
          setAmountsByKey(scaled);
        } else {
          setAmountsByKey(next);
        }
        setStep('confirm');
        return;
      }
      // Seed individual amounts proportionally to remaining so sum ≈ invoice amount.
      const remMap = remainingAmountsByKey(progressGroups);
      const remSum = sumUniqueInvoicedAmounts(remMap, progressGroups);
      if (remSum <= 0) {
        setAmountsByKey(new Map());
      } else {
        const scale = invoiceAmount / remSum;
        const seeded = new Map<string, number>();
        for (const [key, value] of remMap) {
          seeded.set(key, roundMoney(value * scale));
        }
        setAmountsByKey(seeded);
      }
      setStep('lines');
      return;
    }

    if (step === 'lines') {
      if (
        lineRows.length > 0 &&
        !amountsWithinTolerance(allocatedSum, invoiceAmount)
      ) {
        setError(
          `Line amounts (${formatCurrency(allocatedSum)}) must equal the invoice total (${formatCurrency(invoiceAmount)})`,
        );
        return;
      }
      setStep('confirm');
    }
  }

  function goBack() {
    setError(null);
    if (step === 'confirm') {
      if (!isPartial) {
        setStep('details');
        return;
      }
      if (allocationMethod === 'individual') {
        setStep('lines');
        return;
      }
      setStep('method');
      return;
    }
    if (step === 'lines') {
      setStep('method');
      return;
    }
    if (step === 'method') {
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

    const allocation = buildAllocationMap();
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
        if (result.invoice?.id) {
          startOpening();
          navigateToCreated(router, `/invoices/${result.invoice.id}`);
          return;
        }
        resetPhase();
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
              <div className="space-y-5">
                {selectedWo && (
                  <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
                    {contextLoading ? (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Loading work order context…
                      </div>
                    ) : (
                      <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 text-sm">
                        <div>
                          <dt className="text-xs text-slate-500">Job</dt>
                          <dd className="font-medium text-slate-900">{jobName}</dd>
                        </div>
                        <div className="sm:col-span-2">
                          <dt className="text-xs text-slate-500">Address</dt>
                          <dd className="font-medium text-slate-900">{address}</dd>
                        </div>
                        <div>
                          <dt className="text-xs text-slate-500">Work order</dt>
                          <dd className="font-medium text-slate-900">{woRef}</dd>
                        </div>
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
                    <Label htmlFor="workOrderId">
                      Work Order <span className="text-destructive">*</span>
                    </Label>
                    <Select
                      value={workOrderId}
                      onValueChange={(v) =>
                        form.setValue('workOrderId', v ?? '')
                      }
                    >
                      <SelectTrigger id="workOrderId" className="w-full">
                        <SelectValue placeholder="Select work order">
                          {(value: string | null) => {
                            if (!value) return 'Select work order';
                            const wo = activeWorkOrders.find(
                              (w) => w.id === value,
                            );
                            return wo
                              ? workOrderLabel(wo, jobNameById)
                              : value;
                          }}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {activeWorkOrders.map((wo) => (
                          <SelectItem key={wo.id} value={wo.id}>
                            {workOrderLabel(wo, jobNameById)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {form.formState.errors.workOrderId && (
                      <p className="text-sm text-destructive">
                        {form.formState.errors.workOrderId.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="totalAmount">Total Amount</Label>
                    <Input
                      id="totalAmount"
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      {...form.register('totalAmount', {
                        setValueAs: (v) =>
                          v === '' || v == null || Number.isNaN(Number(v))
                            ? undefined
                            : Number(v),
                      })}
                    />
                    {remaining > 0 && (
                      <p className="text-xs text-muted-foreground">
                        Defaults to remaining balance (
                        {formatCurrency(remaining)}). Enter less for a partial
                        invoice.
                      </p>
                    )}
                  </div>

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

            {step === 'method' && (
              <div className="space-y-5">
                <p className="text-sm text-muted-foreground">
                  Invoice amount {formatCurrency(invoiceAmount)} is less than
                  the remaining balance ({formatCurrency(remaining)}). Choose
                  how to apply it to line items.
                </p>
                <div className="space-y-3">
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
                        Apply flat % to each line’s remaining amount
                      </span>
                    </div>
                    {allocationMethod === 'flatPercent' && (
                      <div className="ml-7 flex max-w-xs items-center gap-2">
                        <Input
                          type="number"
                          min="0.01"
                          max="100"
                          step="0.01"
                          value={flatPercent}
                          onChange={(e) => setFlatPercent(e.target.value)}
                          aria-label="Percent of remaining"
                        />
                        <span className="text-sm text-slate-600">%</span>
                      </div>
                    )}
                  </label>

                  <label
                    className={`flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 ${
                      allocationMethod === 'individual'
                        ? 'border-emerald-300 bg-emerald-50 ring-1 ring-emerald-200'
                        : 'border-slate-200'
                    }`}
                  >
                    <input
                      type="radio"
                      name="allocationMethod"
                      checked={allocationMethod === 'individual'}
                      onChange={() => setAllocationMethod('individual')}
                    />
                    <span className="text-sm font-medium text-slate-900">
                      Enter amounts per line item
                    </span>
                  </label>
                </div>
              </div>
            )}

            {step === 'lines' && (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <p className="text-muted-foreground">
                    Enter an amount for each line (max = remaining). Totals must
                    match the invoice amount.
                  </p>
                  <p
                    className={
                      amountsWithinTolerance(allocatedSum, invoiceAmount)
                        ? 'font-medium text-emerald-700'
                        : 'font-medium text-amber-700'
                    }
                  >
                    Allocated {formatCurrency(allocatedSum)} /{' '}
                    {formatCurrency(invoiceAmount)}
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
                        {!isPartial
                          ? 'Full remaining balance'
                          : allocationMethod === 'flatPercent'
                            ? `Flat ${flatPercent}% of remaining (scaled to total)`
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
