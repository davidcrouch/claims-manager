'use client';

import { useEffect, useMemo, useState } from 'react';
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
import { FormJobPickerField } from '@/components/forms/FormJobPickerField';
import { isArchivedStatus } from '@/components/shared/archive-list';
import { entityDisplayLabel } from '@/components/shared/entity-label';
import { formatCurrency } from '@/components/shared/detail';
import type { JobOption } from '@/components/shared/job-label';
import type { Job, PurchaseOrder } from '@/types/api';

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
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [purchaseOrdersLoading, setPurchaseOrdersLoading] = useState(false);
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

  const activePurchaseOrders = useMemo(
    () => purchaseOrders.filter((po) => !isArchivedStatus(po.status?.name)),
    [purchaseOrders],
  );

  const selectedPo = useMemo(
    () =>
      activePurchaseOrders.find((po) => po.id === purchaseOrderId) ?? null,
    [activePurchaseOrders, purchaseOrderId],
  );

  useEffect(() => {
    if (!open) {
      setPickedJobId('');
      setPickedJob(null);
      setPurchaseOrders([]);
      setError(null);
      resetPhase();
      return;
    }
    const initialId = jobId ?? job?.id ?? '';
    setPickedJobId(initialId);
    setPickedJob(job?.id && job.id === initialId ? job : null);
    form.reset({
      purchaseOrderId: defaultPurchaseOrderId ?? '',
      billNumber: '',
      totalAmount: undefined,
      issueDate: todayISO(),
      receivedDate: todayISO(),
      dueDate: '',
      comments: '',
    });
    setError(null);
  }, [open, jobId, job, defaultPurchaseOrderId, form, resetPhase]);

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
  }

  async function onSubmit(values: FormValues) {
    if (!effectiveJobId) {
      setError('Job is required');
      return;
    }
    startCreating();
    setError(null);
    try {
      const result = await createBillAction({
        purchaseOrderId: values.purchaseOrderId,
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

  return (
    <>
      <BottomFormDrawer
        open={open}
        onOpenChange={onOpenChange}
        title="Create Bill"
        description="Record a vendor bill against a purchase order."
        icon={<Receipt className="h-5 w-5" />}
        preventClose={busy}
      >
        <form
          onSubmit={form.handleSubmit(onSubmit, () => {
            setError('Please fill in the required fields.');
          })}
          className="flex min-h-0 flex-1 flex-col"
        >
          <BottomFormDrawerBody>
            <div className="space-y-6">
              <FormJobPickerField
                value={effectiveJobId}
                selectedJob={
                  pickedJob ?? (job?.id === effectiveJobId ? job : null)
                }
                jobs={jobs}
                onJobSelect={handleJobPicked}
                error={
                  !effectiveJobId && error === 'Job is required' ? error : null
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
                      No purchase orders found for this job. Create a purchase
                      order first.
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
                  <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
                    <div>
                      <dt className="text-xs text-slate-500">Purchase order</dt>
                      <dd className="font-medium text-slate-900">
                        {purchaseOrderCardLabel(selectedPo)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-slate-500">Status</dt>
                      <dd className="font-medium text-slate-900">
                        {selectedPo.status?.name ?? '—'}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-slate-500">PO total</dt>
                      <dd className="font-medium text-slate-900">
                        {selectedPo.totalAmount != null &&
                        selectedPo.totalAmount !== ''
                          ? formatCurrency(Number(selectedPo.totalAmount))
                          : '—'}
                      </dd>
                    </div>
                  </dl>
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
                  <Label htmlFor="bill-totalAmount">Total Amount</Label>
                  <Input
                    id="bill-totalAmount"
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
                'Create Bill'
              )}
            </Button>
          </BottomFormDrawerFooter>
        </form>
      </BottomFormDrawer>
      <CreateSubmitOverlay phase={phase} entityLabel="bill" />
    </>
  );
}
