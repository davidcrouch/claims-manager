'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { standardSchemaResolver } from '@hookform/resolvers/standard-schema';
import { z } from 'zod';
import { Loader2, ShoppingCart } from 'lucide-react';
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
import { createPurchaseOrderAction } from '@/app/(app)/mutations';
import {
  CreateSubmitOverlay,
  useCreateSubmitPhase,
} from '@/components/forms/CreateSubmitOverlay';
import { fetchJobQuotesAction } from '@/app/(app)/jobs/[id]/actions';
import { JobSelectField } from '@/components/forms/JobSelectField';
import type { JobOption } from '@/components/shared/job-label';
import type { Quote } from '@/types/api';

const schema = z.object({
  quoteId: z.string().optional(),
  purchaseOrderNumber: z.string().optional(),
  name: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  totalAmount: z.number().optional(),
  note: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function estimateLabel(quote: Quote): string {
  return (
    quote.name?.trim() ||
    quote.quoteNumber?.trim() ||
    quote.reference?.trim() ||
    quote.id
  );
}

export interface PurchaseOrderFormDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When omitted, a job picker is shown (requires `jobs`). */
  jobId?: string;
  jobs?: JobOption[];
}

export function PurchaseOrderFormDrawer({
  open,
  onOpenChange,
  jobId,
  jobs,
}: PurchaseOrderFormDrawerProps) {
  const router = useRouter();
  const { phase, busy, startCreating, startOpening, resetPhase } =
    useCreateSubmitPhase();
  const [error, setError] = useState<string | null>(null);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [pickedJobId, setPickedJobId] = useState('');
  const needsJobPicker = (jobs?.length ?? 0) > 0;
  const effectiveJobId = needsJobPicker ? pickedJobId : (jobId ?? "");

  useEffect(() => {
    if (open) {
      setPickedJobId(jobId ?? '');
    } else {
      setPickedJobId('');
      setQuotes([]);
    }
  }, [open, jobId]);

  useEffect(() => {
    if (open && effectiveJobId) {
      fetchJobQuotesAction(effectiveJobId).then((data) => setQuotes(data ?? []));
    } else {
      setQuotes([]);
    }
  }, [open, effectiveJobId]);

  const form = useForm<FormValues>({
    resolver: standardSchemaResolver(schema),
    defaultValues: {
      quoteId: '',
      purchaseOrderNumber: '',
      name: '',
      startDate: todayISO(),
      endDate: '',
      totalAmount: undefined,
      note: '',
    },
  });

  async function onSubmit(values: FormValues) {
    if (!effectiveJobId) {
      setError('Job is required');
      return;
    }
    startCreating();
    setError(null);
    try {
      const result = await createPurchaseOrderAction({
        jobId: effectiveJobId,
        quoteId: values.quoteId || undefined,
        purchaseOrderNumber: values.purchaseOrderNumber || undefined,
        name: values.name || undefined,
        startDate: values.startDate || undefined,
        endDate: values.endDate || undefined,
        totalAmount: values.totalAmount ?? undefined,
        note: values.note || undefined,
      });
      if (result.success) {
        if (result.purchaseOrder?.id) {
          startOpening();
          router.push(`/purchase-orders/${result.purchaseOrder.id}`);
          return;
        }
        resetPhase();
        onOpenChange(false);
        router.refresh();
      } else {
        setError(result.error ?? 'Failed to create purchase order');
        resetPhase();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create purchase order');
      resetPhase();
    }
  }

  return (
    <>
    <BottomFormDrawer
      open={open}
      onOpenChange={onOpenChange}
      title="Create Purchase Order"
      description="Create a new purchase order. Optionally link it to an estimate."
      icon={<ShoppingCart className="h-5 w-5" />}
      preventClose={busy}
    >
      <form onSubmit={form.handleSubmit(onSubmit)} className="flex min-h-0 flex-1 flex-col">
        <BottomFormDrawerBody>
          <div className="grid grid-cols-1 gap-x-6 gap-y-5 md:grid-cols-2">
            {needsJobPicker && jobs && (
              <JobSelectField
                jobs={jobs}
                value={pickedJobId}
                onValueChange={(id) => {
                  setPickedJobId(id);
                  form.setValue('quoteId', '');
                }}
              />
            )}
            <div className="space-y-2">
              <Label htmlFor="po-quoteId">Estimate</Label>
              <Select
                value={form.watch('quoteId')}
                onValueChange={(v) => form.setValue('quoteId', v ?? '')}
                items={Object.fromEntries(quotes.map((q) => [q.id, estimateLabel(q)]))}
              >
                <SelectTrigger id="po-quoteId">
                  <SelectValue placeholder="Select estimate" />
                </SelectTrigger>
                <SelectContent>
                  {quotes.map((q) => (
                    <SelectItem key={q.id} value={q.id}>
                      {estimateLabel(q)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="po-purchaseOrderNumber">PO #</Label>
              <Input id="po-purchaseOrderNumber" {...form.register('purchaseOrderNumber')} placeholder="e.g. PO-001" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="po-name">Name</Label>
              <Input id="po-name" {...form.register('name')} placeholder="Purchase order name" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="po-totalAmount">Total Amount</Label>
              <Input
                id="po-totalAmount"
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
              <Label htmlFor="po-startDate">Start Date</Label>
              <Input id="po-startDate" type="date" {...form.register('startDate')} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="po-endDate">End Date</Label>
              <Input id="po-endDate" type="date" {...form.register('endDate')} />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="po-note">Note</Label>
              <Textarea id="po-note" {...form.register('note')} placeholder="Add a note..." rows={3} />
            </div>
          </div>
          <BottomFormDrawerError error={error} />
        </BottomFormDrawerBody>

        <BottomFormDrawerFooter>
          <Button type="button" variant="outline" size="lg" disabled={busy} onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="submit" size="lg" disabled={busy}>
            {busy ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {phase === 'opening' ? 'Opening…' : 'Creating…'}
              </>
            ) : (
              'Create Purchase Order'
            )}
          </Button>
        </BottomFormDrawerFooter>
      </form>
    </BottomFormDrawer>
    <CreateSubmitOverlay phase={phase} entityLabel="purchase order" />
    </>
  );
}
