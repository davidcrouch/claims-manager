'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { standardSchemaResolver } from '@hookform/resolvers/standard-schema';
import { z } from 'zod';
import { ClipboardList } from 'lucide-react';
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
import { createWorkOrderAction } from '@/app/(app)/mutations';
import { fetchJobPurchaseOrdersAction } from '@/app/(app)/jobs/[id]/actions';
import type { PurchaseOrder } from '@/types/api';

const schema = z.object({
  purchaseOrderId: z.string().min(1, 'Purchase order is required'),
  workOrderNumber: z.string().optional(),
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

export interface WorkOrderFormDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jobId: string;
}

export function WorkOrderFormDrawer({
  open,
  onOpenChange,
  jobId,
}: WorkOrderFormDrawerProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);

  useEffect(() => {
    if (open) {
      fetchJobPurchaseOrdersAction(jobId).then((data) => setPurchaseOrders(data ?? []));
    }
  }, [open, jobId]);

  const form = useForm<FormValues>({
    resolver: standardSchemaResolver(schema),
    defaultValues: {
      purchaseOrderId: '',
      workOrderNumber: '',
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
      const result = await createWorkOrderAction({
        purchaseOrderId: values.purchaseOrderId,
        jobId,
        workOrderNumber: values.workOrderNumber || undefined,
        name: values.name || undefined,
        startDate: values.startDate ? new Date(values.startDate).toISOString() : undefined,
        endDate: values.endDate ? new Date(values.endDate).toISOString() : undefined,
        totalAmount: values.totalAmount ?? undefined,
        note: values.note || undefined,
      });
      if (result.success) {
        onOpenChange(false);
        form.reset();
        router.refresh();
      } else {
        setError(result.error ?? 'Failed to create work order');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create work order');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <BottomFormDrawer
      open={open}
      onOpenChange={onOpenChange}
      title="Create Work Order"
      description="Create a new work order linked to a purchase order on this job."
      icon={<ClipboardList className="h-5 w-5" />}
    >
      <form onSubmit={form.handleSubmit(onSubmit)} className="flex min-h-0 flex-1 flex-col">
        <BottomFormDrawerBody>
          <div className="grid grid-cols-1 gap-x-6 gap-y-5 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="wo-purchaseOrderId">Purchase Order</Label>
              <Select
                value={form.watch('purchaseOrderId')}
                onValueChange={(v) => form.setValue('purchaseOrderId', v ?? '')}
              >
                <SelectTrigger id="wo-purchaseOrderId">
                  <SelectValue placeholder="Select purchase order" />
                </SelectTrigger>
                <SelectContent>
                  {purchaseOrders.map((po) => (
                    <SelectItem key={po.id} value={po.id}>
                      {po.purchaseOrderNumber ?? po.externalId ?? po.id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {form.formState.errors.purchaseOrderId && (
                <p className="text-sm text-destructive">{form.formState.errors.purchaseOrderId.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="wo-workOrderNumber">Work Order # (optional)</Label>
              <Input id="wo-workOrderNumber" {...form.register('workOrderNumber')} placeholder="e.g. WO-001" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="wo-name">Name (optional)</Label>
              <Input id="wo-name" {...form.register('name')} placeholder="Work order name" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="wo-totalAmount">Total Amount (optional)</Label>
              <Input id="wo-totalAmount" type="number" step="0.01" min="0" {...form.register('totalAmount')} placeholder="0.00" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="wo-startDate">Start Date (optional)</Label>
              <Input id="wo-startDate" type="date" {...form.register('startDate')} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="wo-endDate">End Date (optional)</Label>
              <Input id="wo-endDate" type="date" {...form.register('endDate')} />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="wo-note">Note (optional)</Label>
              <Textarea id="wo-note" {...form.register('note')} placeholder="Add a note..." rows={3} />
            </div>
          </div>
          <BottomFormDrawerError error={error} />
        </BottomFormDrawerBody>

        <BottomFormDrawerFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="submit" disabled={submitting}>{submitting ? 'Creating...' : 'Create Work Order'}</Button>
        </BottomFormDrawerFooter>
      </form>
    </BottomFormDrawer>
  );
}
