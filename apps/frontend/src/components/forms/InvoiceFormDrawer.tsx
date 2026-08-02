'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { standardSchemaResolver } from '@hookform/resolvers/standard-schema';
import { z } from 'zod';
import { Receipt } from 'lucide-react';
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
import { isArchivedStatus } from '@/components/shared/list-filters';
import { createInvoiceAction } from '@/app/(app)/mutations';
import type { WorkOrder } from '@/types/api';

const invoiceFormSchema = z.object({
  workOrderId: z.string().min(1, 'Work order is required'),
  invoiceNumber: z.string().optional(),
  totalAmount: z.number().optional(),
  issueDate: z.string().optional(),
  dueDate: z.string().optional(),
  note: z.string().optional(),
});

type InvoiceFormValues = z.infer<typeof invoiceFormSchema>;

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function workOrderLabel(
  wo: WorkOrder,
  jobNameById?: Record<string, string>,
): string {
  const woRef = wo.workOrderNumber ?? wo.name ?? wo.externalId ?? wo.id;
  const jobName =
    (wo.jobId ? jobNameById?.[wo.jobId] : undefined)?.trim() || undefined;
  return jobName ? `${jobName} — ${woRef}` : woRef;
}

export interface InvoiceFormDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workOrders: WorkOrder[];
  /** Map of job id → display name for dropdown prefixes. */
  jobNameById?: Record<string, string>;
  /** Pre-select a work order (e.g. from work order detail). */
  defaultWorkOrderId?: string;
}

export function InvoiceFormDrawer({
  open,
  onOpenChange,
  workOrders,
  jobNameById,
  defaultWorkOrderId,
}: InvoiceFormDrawerProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeWorkOrders = useMemo(
    () => workOrders.filter((wo) => !isArchivedStatus(wo.status?.name)),
    [workOrders],
  );

  const form = useForm<InvoiceFormValues>({
    resolver: standardSchemaResolver(invoiceFormSchema),
    defaultValues: {
      workOrderId: defaultWorkOrderId ?? '',
      invoiceNumber: '',
      totalAmount: undefined,
      issueDate: todayISO(),
      dueDate: '',
      note: '',
    },
  });

  useEffect(() => {
    if (open && defaultWorkOrderId) {
      form.setValue('workOrderId', defaultWorkOrderId);
    }
  }, [open, defaultWorkOrderId, form]);

  async function onSubmit(values: InvoiceFormValues) {
    setSubmitting(true);
    setError(null);
    try {
      const selected = activeWorkOrders.find((wo) => wo.id === values.workOrderId);
      if (!selected) {
        setError('Selected work order was not found');
        return;
      }
      if (!selected.purchaseOrderId) {
        setError(
          'This work order is not linked to a purchase order and cannot be invoiced yet',
        );
        return;
      }

      const result = await createInvoiceAction({
        purchaseOrderId: selected.purchaseOrderId,
        invoiceNumber: values.invoiceNumber || undefined,
        totalAmount: values.totalAmount ?? undefined,
        issueDate: values.issueDate
          ? new Date(values.issueDate).toISOString()
          : undefined,
        dueDate: values.dueDate
          ? new Date(values.dueDate).toISOString()
          : undefined,
        note: values.note || undefined,
      });
      if (result.success) {
        onOpenChange(false);
        form.reset({
          workOrderId: defaultWorkOrderId ?? '',
          invoiceNumber: '',
          totalAmount: undefined,
          issueDate: todayISO(),
          dueDate: '',
          note: '',
        });
        router.refresh();
      } else {
        setError(result.error ?? 'Failed to submit invoice');
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to submit invoice',
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <BottomFormDrawer
      open={open}
      onOpenChange={onOpenChange}
      title="Submit Invoice"
      description="Submit an invoice against an active work order. Optionally include your invoice number for reference."
      icon={<Receipt className="h-5 w-5" />}
    >
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="flex min-h-0 flex-1 flex-col"
      >
        <BottomFormDrawerBody>
          <div className="grid grid-cols-1 gap-x-6 gap-y-5 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="workOrderId">Work Order</Label>
              <Select
                value={form.watch('workOrderId')}
                onValueChange={(v) => form.setValue('workOrderId', v ?? '')}
              >
                <SelectTrigger id="workOrderId">
                  <SelectValue placeholder="Select work order" />
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
              <Label htmlFor="invoiceNumber">Invoice Number (optional)</Label>
              <Input
                id="invoiceNumber"
                {...form.register('invoiceNumber')}
                placeholder="e.g. INV-001"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="totalAmount">Total Amount (optional)</Label>
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
            </div>

            <div className="space-y-2">
              <Label htmlFor="issueDate">Issue Date (optional)</Label>
              <Input
                id="issueDate"
                type="date"
                {...form.register('issueDate')}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="dueDate">Due Date (optional)</Label>
              <Input
                id="dueDate"
                type="date"
                {...form.register('dueDate')}
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="note">Note (optional)</Label>
              <Textarea
                id="note"
                {...form.register('note')}
                placeholder="Add a note..."
                rows={4}
              />
            </div>
          </div>

          <BottomFormDrawerError error={error} />
        </BottomFormDrawerBody>

        <BottomFormDrawerFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? 'Submitting...' : 'Submit Invoice'}
          </Button>
        </BottomFormDrawerFooter>
      </form>
    </BottomFormDrawer>
  );
}
