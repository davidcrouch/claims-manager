'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { standardSchemaResolver } from '@hookform/resolvers/standard-schema';
import { z } from 'zod';
import { ShoppingCart } from 'lucide-react';
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
import { fetchJobQuotesAction } from '@/app/(app)/jobs/[id]/actions';
import type { Quote } from '@/types/api';

const schema = z.object({
  quoteId: z.string().optional(),
  purchaseOrderNumber: z.string().optional(),
  name: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  totalAmount: z.coerce.number().optional(),
  note: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export interface PurchaseOrderFormDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jobId: string;
}

export function PurchaseOrderFormDrawer({
  open,
  onOpenChange,
  jobId,
}: PurchaseOrderFormDrawerProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [quotes, setQuotes] = useState<Quote[]>([]);

  useEffect(() => {
    if (open) {
      fetchJobQuotesAction(jobId).then((data) => setQuotes(data ?? []));
    }
  }, [open, jobId]);

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
    setSubmitting(true);
    setError(null);
    try {
      const result = await createPurchaseOrderAction({
        jobId,
        quoteId: values.quoteId || undefined,
        purchaseOrderNumber: values.purchaseOrderNumber || undefined,
        name: values.name || undefined,
        startDate: values.startDate || undefined,
        endDate: values.endDate || undefined,
        totalAmount: values.totalAmount ?? undefined,
        note: values.note || undefined,
      });
      if (result.success) {
        onOpenChange(false);
        form.reset();
        router.refresh();
      } else {
        setError(result.error ?? 'Failed to create purchase order');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create purchase order');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <BottomFormDrawer
      open={open}
      onOpenChange={onOpenChange}
      title="Create Purchase Order"
      description="Create a new purchase order on this job. Optionally link it to an estimate."
      icon={<ShoppingCart className="h-5 w-5" />}
    >
      <form onSubmit={form.handleSubmit(onSubmit)} className="flex min-h-0 flex-1 flex-col">
        <BottomFormDrawerBody>
          <div className="grid grid-cols-1 gap-x-6 gap-y-5 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="po-quoteId">Estimate (optional)</Label>
              <Select
                value={form.watch('quoteId')}
                onValueChange={(v) => form.setValue('quoteId', v ?? '')}
              >
                <SelectTrigger id="po-quoteId">
                  <SelectValue placeholder="Select estimate" />
                </SelectTrigger>
                <SelectContent>
                  {quotes.map((q) => (
                    <SelectItem key={q.id} value={q.id}>
                      {q.quoteNumber ?? q.name ?? q.id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="po-purchaseOrderNumber">PO # (optional)</Label>
              <Input id="po-purchaseOrderNumber" {...form.register('purchaseOrderNumber')} placeholder="e.g. PO-001" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="po-name">Name (optional)</Label>
              <Input id="po-name" {...form.register('name')} placeholder="Purchase order name" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="po-totalAmount">Total Amount (optional)</Label>
              <Input id="po-totalAmount" type="number" step="0.01" min="0" {...form.register('totalAmount')} placeholder="0.00" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="po-startDate">Start Date (optional)</Label>
              <Input id="po-startDate" type="date" {...form.register('startDate')} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="po-endDate">End Date (optional)</Label>
              <Input id="po-endDate" type="date" {...form.register('endDate')} />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="po-note">Note (optional)</Label>
              <Textarea id="po-note" {...form.register('note')} placeholder="Add a note..." rows={3} />
            </div>
          </div>
          <BottomFormDrawerError error={error} />
        </BottomFormDrawerBody>

        <BottomFormDrawerFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="submit" disabled={submitting}>{submitting ? 'Creating...' : 'Create Purchase Order'}</Button>
        </BottomFormDrawerFooter>
      </form>
    </BottomFormDrawer>
  );
}
