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
import { createBillAction } from '@/app/(app)/mutations';
import {
  CreateSubmitOverlay,
  useCreateSubmitPhase,
} from '@/components/forms/CreateSubmitOverlay';
import { fetchJobPurchaseOrdersAction } from '@/app/(app)/jobs/[id]/actions';
import { getPurchaseOrderLineItemsAction } from '@/app/(app)/purchase-orders/actions';
import { fetchPurchaseOrderBillsAction } from '@/app/(app)/bills/actions';
import { FormJobPickerField } from '@/components/forms/FormJobPickerField';
import { isArchivedStatus } from '@/components/shared/archive-list';
import { entityDisplayLabel } from '@/components/shared/entity-label';
import { formatAddress, formatCurrency } from '@/components/shared/detail';
import { jobDisplayName, type JobOption } from '@/components/shared/job-label';
import {
  amountsWithinTolerance,
  applyFlatPercentToRemaining,
  applyInvoiceProgressToGroups,
  flattenAllocatableLines,
  formatFlatPercentInput,
  invoicedAmountsRecordFromMap,
  itemMatchKeys,
  scaleAllocationMapToTotal,
  setItemAmountInMap,
  suggestedFlatPercent,
  sumGroupsLineTotal,
  sumLineRemaining,
  sumUniqueInvoicedAmounts,
} from '@/components/invoices/invoice-line-progress';
import {
  buildPreviouslyBilledMap,
  purchaseOrderHeaderTotal,
  sumPriorBillTotals,
} from '@/components/bills/bill-line-progress';
import type { ApiGroup } from '@/components/line-items';
import type { Bill, Job, PurchaseOrder } from '@/types/api';

const schema = z.object({
  purchaseOrderId: z.string().min(1, 'Purchase order is required'),
  billNumber: z.string().optional(),
  totalAmount: z.number().optional(),
  issueDate: z.string().optional(),
  receivedDate: z.string().optional(),
  dueDate: z.string().optional(),
  comments: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

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

function purchaseOrderCardLabel(po: PurchaseOrder): string {
  return entityDisplayLabel(
    po.internalNumber,
    po.name,
    po.purchaseOrderNumber,
    po.externalId,
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

export interface BillFormDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When set, preselects this job (still shown via the job card). */
  jobId?: string;
  /** Full job for richer initial display when creating from a filtered job context. */
  job?: Job | null;
  jobs?: JobOption[];
  /** Pre-select a purchase order when opening from a PO-scoped context. */
  defaultPurchaseOrderId?: string;
}

export function BillFormDrawer({
  open,
  onOpenChange,
  jobId,
  job,
  jobs,
  defaultPurchaseOrderId,
}: BillFormDrawerProps) {
  const router = useRouter();
  const { phase, busy, startCreating, resetPhase } =
    useCreateSubmitPhase();
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<WizardStep>('details');
  const [allocationMethod, setAllocationMethod] =
    useState<AllocationMethod>('flatAmount');
  const [flatAmountInput, setFlatAmountInput] = useState('');
  const [flatPercent, setFlatPercent] = useState('');
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [purchaseOrdersLoading, setPurchaseOrdersLoading] = useState(false);
  const [siblingBills, setSiblingBills] = useState<Bill[]>([]);
  const [groups, setGroups] = useState<ApiGroup[]>([]);
  const [contextLoading, setContextLoading] = useState(false);
  const [amountsByKey, setAmountsByKey] = useState<Map<string, number>>(
    () => new Map(),
  );
  const [pickedJobId, setPickedJobId] = useState('');
  const [pickedJob, setPickedJob] = useState<Job | null>(null);
  const effectiveJobId = pickedJobId || jobId || '';

  const form = useForm<FormValues>({
    resolver: standardSchemaResolver(schema),
    defaultValues: {
      purchaseOrderId: defaultPurchaseOrderId ?? '',
      billNumber: '',
      totalAmount: undefined,
      issueDate: todayISO(),
      receivedDate: todayISO(),
      dueDate: '',
      comments: '',
    },
  });

  const purchaseOrderId = form.watch('purchaseOrderId');
  const totalAmount = form.watch('totalAmount');

  const activePurchaseOrders = useMemo(
    () => purchaseOrders.filter((po) => !isArchivedStatus(po.status?.name)),
    [purchaseOrders],
  );

  const selectedPo = useMemo(
    () =>
      activePurchaseOrders.find((po) => po.id === purchaseOrderId) ?? null,
    [activePurchaseOrders, purchaseOrderId],
  );

  const poTotal = useMemo(
    () =>
      purchaseOrderHeaderTotal(
        selectedPo,
        groups.length ? sumGroupsLineTotal(groups) : undefined,
      ),
    [selectedPo, groups],
  );
  const priorBilled = useMemo(
    () => sumPriorBillTotals(siblingBills),
    [siblingBills],
  );

  const baseProgressGroups = useMemo(() => {
    const previously = buildPreviouslyBilledMap(siblingBills);
    return applyInvoiceProgressToGroups(groups, previously);
  }, [groups, siblingBills]);

  const remaining = useMemo(() => {
    if (baseProgressGroups.length) {
      return sumLineRemaining(baseProgressGroups);
    }
    return Math.max(0, roundMoney(poTotal - priorBilled));
  }, [baseProgressGroups, poTotal, priorBilled]);

  const progressGroups = useMemo(() => {
    const previously = buildPreviouslyBilledMap(siblingBills);
    return applyInvoiceProgressToGroups(groups, previously, amountsByKey);
  }, [groups, siblingBills, amountsByKey]);

  const lineRows = useMemo(
    () => flattenAllocatableLines(progressGroups),
    [progressGroups],
  );

  const allocatedSum = useMemo(
    () => sumUniqueInvoicedAmounts(amountsByKey, progressGroups),
    [amountsByKey, progressGroups],
  );

  const billAmount = totalAmount ?? 0;

  const visibleSteps = useMemo((): WizardStep[] => {
    if (allocationMethod === 'perLine') {
      return ['details', 'allocation', 'lines', 'confirm'];
    }
    return ['details', 'allocation', 'confirm'];
  }, [allocationMethod]);

  const stepIndex = Math.max(0, visibleSteps.indexOf(step));

  const resetWizard = useCallback(() => {
    setStep('details');
    setAllocationMethod('flatAmount');
    setFlatAmountInput('');
    setFlatPercent('');
    setSiblingBills([]);
    setGroups([]);
    setAmountsByKey(new Map());
    setError(null);
    setPickedJobId('');
    setPickedJob(null);
    setPurchaseOrders([]);
    resetPhase();
    form.reset({
      purchaseOrderId: defaultPurchaseOrderId ?? '',
      billNumber: '',
      totalAmount: undefined,
      issueDate: todayISO(),
      receivedDate: todayISO(),
      dueDate: '',
      comments: '',
    });
  }, [defaultPurchaseOrderId, form, resetPhase]);

  useEffect(() => {
    if (!open) {
      resetWizard();
      return;
    }
    const initialId = jobId ?? job?.id ?? '';
    setPickedJobId(initialId);
    setPickedJob(job?.id && job.id === initialId ? job : null);
    if (defaultPurchaseOrderId) {
      form.setValue('purchaseOrderId', defaultPurchaseOrderId);
    }
  }, [open, jobId, job, defaultPurchaseOrderId, form, resetWizard]);

  useEffect(() => {
    if (!open || !effectiveJobId) {
      setPurchaseOrders([]);
      setPurchaseOrdersLoading(false);
      return;
    }
    let cancelled = false;
    setPurchaseOrdersLoading(true);
    fetchJobPurchaseOrdersAction(effectiveJobId)
      .then((data) => {
        if (!cancelled) setPurchaseOrders(data ?? []);
      })
      .catch((err) => {
        console.error('[frontend:BillFormDrawer.fetchJobPurchaseOrders]', err);
        if (!cancelled) setPurchaseOrders([]);
      })
      .finally(() => {
        if (!cancelled) setPurchaseOrdersLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, effectiveJobId]);

  function handleJobPicked(next: Job) {
    setPickedJobId(next.id);
    setPickedJob(next);
    form.setValue('purchaseOrderId', '', { shouldValidate: false });
    setError(null);
  }

  useEffect(() => {
    if (!open || !purchaseOrderId) {
      setSiblingBills([]);
      setGroups([]);
      return;
    }

    let cancelled = false;
    setContextLoading(true);

    void (async () => {
      try {
        const [bills, linesRes] = await Promise.all([
          fetchPurchaseOrderBillsAction(purchaseOrderId),
          getPurchaseOrderLineItemsAction(purchaseOrderId, { limit: 500 }),
        ]);
        if (cancelled) return;

        const siblings = bills ?? [];
        setSiblingBills(siblings);

        const nextGroups = (linesRes.success && linesRes.groups
          ? (linesRes.groups as ApiGroup[])
          : []) as ApiGroup[];
        const previously = buildPreviouslyBilledMap(siblings);
        const stamped = applyInvoiceProgressToGroups(nextGroups, previously);

        const rem =
          stamped.length > 0
            ? sumLineRemaining(stamped)
            : Math.max(
                0,
                roundMoney(
                  purchaseOrderHeaderTotal(
                    selectedPo,
                    stamped.length ? sumGroupsLineTotal(stamped) : undefined,
                  ) - sumPriorBillTotals(siblings),
                ),
              );
        setGroups(stamped);
        setAmountsByKey(new Map());
        setFlatAmountInput(rem > 0 ? String(rem) : '');
        setFlatPercent(
          rem > 0
            ? formatFlatPercentInput(
                suggestedFlatPercent({ invoiceAmount: rem, remaining: rem }),
              )
            : '',
        );
      } catch (err) {
        console.error('[frontend:BillFormDrawer.loadContext]', err);
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : 'Failed to load purchase order bill context',
          );
        }
      } finally {
        if (!cancelled) setContextLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, purchaseOrderId, selectedPo]);

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
      if (!purchaseOrderId) {
        setError('Purchase order is required');
        return;
      }
      if (contextLoading) {
        setError('Purchase order context is still loading');
        return;
      }
      if (remaining <= 0) {
        setError('Nothing remaining to bill on this purchase order');
        return;
      }
      setStep('allocation');
      return;
    }

    if (step === 'allocation') {
      if (allocationMethod === 'flatAmount') {
        const amt = Number(flatAmountInput);
        if (!Number.isFinite(amt) || amt <= 0) {
          setError('Enter a bill amount greater than zero');
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
        const sum = roundMoney(
          sumUniqueInvoicedAmounts(map, baseProgressGroups),
        );
        if (sum <= 0) {
          setError('Percentage must allocate at least one line item');
          return;
        }
        if (sum > remaining + 0.02) {
          setError(
            `This percentage bills ${formatCurrency(sum)}, which exceeds the remaining balance (${formatCurrency(remaining)})`,
          );
          return;
        }
        applyFlatAllocationToState({ map, headerTotal: sum });
        setStep('confirm');
        return;
      }

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
      if (lineRows.length > 0 && allocatedSum > remaining + 0.02) {
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
    const selected = activePurchaseOrders.find(
      (po) => po.id === values.purchaseOrderId,
    );
    if (!selected) {
      setError('Selected purchase order was not found');
      return;
    }
    if (!effectiveJobId) {
      setError('Job is required');
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
      const result = await createBillAction({
        purchaseOrderId: selected.id,
        jobId: effectiveJobId,
        billNumber: values.billNumber || undefined,
        totalAmount: values.totalAmount ?? undefined,
        issueDate: values.issueDate
          ? new Date(values.issueDate).toISOString()
          : undefined,
        receivedDate: values.receivedDate
          ? new Date(values.receivedDate).toISOString()
          : undefined,
        dueDate: values.dueDate
          ? new Date(values.dueDate).toISOString()
          : undefined,
        comments: values.comments || undefined,
        invoicedAmounts,
        billPayload: { invoicedAmounts },
      });
      if (result.success) {
        if (result.bill?.id) {
          resetPhase();
          onOpenChange(false);
          router.push(`/bills/${result.bill.id}`);
          router.refresh();
          return;
        }
        resetPhase();
        onOpenChange(false);
        router.refresh();
      } else {
        setError(result.error ?? 'Failed to create bill');
        resetPhase();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create bill');
      resetPhase();
    }
  }

  const contextJob = pickedJob ?? (job?.id === effectiveJobId ? job : null);
  const jobName = contextJob ? jobDisplayName(contextJob) : '—';
  const address = formatJobAddress(contextJob) || '—';
  const poRef = selectedPo ? purchaseOrderCardLabel(selectedPo) : '—';

  return (
    <>
      <BottomFormDrawer
        open={open}
        onOpenChange={onOpenChange}
        title="Create Bill"
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
                  selectedJob={
                    pickedJob ?? (job?.id === effectiveJobId ? job : null)
                  }
                  jobs={jobs}
                  onJobSelect={handleJobPicked}
                  error={
                    !effectiveJobId && error === 'Job is required'
                      ? error
                      : null
                  }
                />

                <div className="grid grid-cols-1 gap-x-6 md:grid-cols-2">
                  <div className="space-y-3">
                    <Label className="text-sm font-medium">
                      Select Purchase Order{' '}
                      <span className="text-destructive">*</span>
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Choose which purchase order this bill is for.
                    </p>

                    {purchaseOrdersLoading ? (
                      <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Loading purchase orders...
                      </div>
                    ) : !effectiveJobId ? (
                      <p className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-muted-foreground">
                        Select a job to load purchase orders.
                      </p>
                    ) : activePurchaseOrders.length === 0 ? (
                      <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                        No purchase orders found for this job. Create a
                        purchase order first.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {activePurchaseOrders.map((po) => (
                          <label
                            key={po.id}
                            className={`flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 transition-colors ${
                              purchaseOrderId === po.id
                                ? 'border-emerald-300 bg-emerald-50 ring-1 ring-emerald-200'
                                : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                            }`}
                          >
                            <input
                              type="radio"
                              name="bill-purchase-order"
                              value={po.id}
                              checked={purchaseOrderId === po.id}
                              onChange={() =>
                                form.setValue('purchaseOrderId', po.id, {
                                  shouldValidate: true,
                                })
                              }
                              className="h-4 w-4 text-emerald-600"
                            />
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium">
                                {purchaseOrderCardLabel(po)}
                              </p>
                              <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                                {po.purchaseOrderType?.name && (
                                  <span>{po.purchaseOrderType.name}</span>
                                )}
                                {po.status?.name && (
                                  <span className="rounded bg-slate-100 px-1.5 py-0.5">
                                    {po.status.name}
                                  </span>
                                )}
                                {po.totalAmount != null &&
                                  po.totalAmount !== '' && (
                                    <span>
                                      $
                                      {Number(po.totalAmount).toLocaleString()}
                                    </span>
                                  )}
                              </div>
                            </div>
                            <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
                          </label>
                        ))}
                      </div>
                    )}
                    {form.formState.errors.purchaseOrderId && (
                      <p className="text-sm text-destructive">
                        {form.formState.errors.purchaseOrderId.message}
                      </p>
                    )}
                  </div>
                </div>

                {selectedPo && (
                  <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
                    {contextLoading ? (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Loading purchase order context…
                      </div>
                    ) : (
                      <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
                        <div>
                          <dt className="text-xs text-slate-500">PO total</dt>
                          <dd className="font-medium text-slate-900">
                            {formatCurrency(poTotal)}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-xs text-slate-500">
                            Already billed
                          </dt>
                          <dd className="font-medium text-slate-900">
                            {formatCurrency(priorBilled)}
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
                    <Label htmlFor="bill-billNumber">Bill #</Label>
                    <Input
                      id="bill-billNumber"
                      {...form.register('billNumber')}
                      placeholder="Auto-assigned if blank"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="bill-issueDate">Issue Date</Label>
                    <Input
                      id="bill-issueDate"
                      type="date"
                      {...form.register('issueDate')}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="bill-receivedDate">Received Date</Label>
                    <Input
                      id="bill-receivedDate"
                      type="date"
                      {...form.register('receivedDate')}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="bill-dueDate">Due Date</Label>
                    <Input
                      id="bill-dueDate"
                      type="date"
                      {...form.register('dueDate')}
                    />
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="bill-comments">Comments</Label>
                    <Textarea
                      id="bill-comments"
                      {...form.register('comments')}
                      placeholder="Add comments..."
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
                    Remaining balance to bill:{' '}
                    <span className="font-semibold text-slate-900">
                      {formatCurrency(remaining)}
                    </span>
                  </p>
                </div>
                <p className="text-sm text-muted-foreground">
                  Choose how to distribute this bill across line items.
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
                        Bill a flat dollar amount
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
                            aria-label="Bill dollar amount"
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
                        Bill a flat percentage
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
                            Line amounts total{' '}
                            {formatCurrency(flatPercentPreview)}
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
                    Enter an amount for each line (max = remaining). The bill
                    total is the sum of these amounts.
                  </p>
                  <p className="font-medium text-slate-900">
                    Bill total: {formatCurrency(allocatedSum)}
                  </p>
                </div>

                {lineRows.length === 0 ? (
                  <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                    No line items found on this purchase order. You can still
                    create the bill with the header total only.
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
                            This bill
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {lineRows.map((row) => {
                          const keys = itemMatchKeys(row.item);
                          const primary =
                            keys[0] ?? `${row.groupLabel}-${row.item.name}`;
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
                      <dt className="text-xs text-slate-500">Purchase order</dt>
                      <dd className="font-medium text-slate-900">{poRef}</dd>
                    </div>
                    <div className="sm:col-span-2">
                      <dt className="text-xs text-slate-500">Address</dt>
                      <dd className="font-medium text-slate-900">{address}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-slate-500">Bill total</dt>
                      <dd className="font-semibold text-slate-900">
                        {formatCurrency(billAmount)}
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
                          ? `Flat ${formatCurrency(Number(flatAmountInput) || billAmount)} (${flatPercent}% per line)`
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
                    {form.getValues('billNumber') ? (
                      <div>
                        <dt className="text-xs text-slate-500">Bill #</dt>
                        <dd className="font-medium text-slate-900">
                          {form.getValues('billNumber')}
                        </dd>
                      </div>
                    ) : null}
                    {form.getValues('comments') ? (
                      <div className="sm:col-span-2">
                        <dt className="text-xs text-slate-500">Comments</dt>
                        <dd className="font-medium text-slate-900 whitespace-pre-wrap">
                          {form.getValues('comments')}
                        </dd>
                      </div>
                    ) : null}
                  </dl>
                </div>
                <p className="text-sm text-muted-foreground">
                  A bill will be created against this purchase order. You can
                  still adjust line amounts on the bill page after create.
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
                  'Create Bill'
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
      <CreateSubmitOverlay phase={phase} entityLabel="bill" />
    </>
  );
}
