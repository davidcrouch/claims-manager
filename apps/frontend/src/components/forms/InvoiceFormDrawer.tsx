'use client';

import { useState } from 'react';
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
import { createInvoiceAction } from '@/app/(app)/mutations';
import type { PurchaseOrder } from '@/types/api';

const invoiceFormSchema = z.object({
  purchaseOrderId: z.string().min(1, 'Purchase order is required'),
  invoiceNumber: z.string().optional(),
  totalAmount: z.coerce.number().optional(),
  issueDate: z.string().optional(),
  dueDate: z.string().optional(),
  note: z.string().optional(),
});

type InvoiceFormValues = z.infer<typeof invoiceFormSchema>;

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export interface InvoiceFormDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  purchaseOrders: PurchaseOrder[];
}

export function InvoiceFormDrawer({
  open,
  onOpenChange,
  purchaseOrders,
}: InvoiceFormDrawerProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const form = useForm<InvoiceFormValues>({
    resolver: standardSchemaResolver(invoiceFormSchema),
    defaultValues: {
      purchaseOrderId: '',
      invoiceNumber: '',
      totalAmount: undefined,
      issueDate: todayISO(),
      dueDate: '',
      note: '',
    },
  });

  async function onSubmit(values: InvoiceFormValues) {
    setSubmitting(true);
    setError(null);
    try {
      const result = await createInvoiceAction({
        purchaseOrderId: values.purchaseOrderId,
        invoiceNumber: values.invoiceNumber || undefined,
        totalAmount: values.totalAmount ?? undefined,
        issueDate: values.issueDate || undefined,
        dueDate: values.dueDate || undefined,
        note: values.note || undefined,
      });
      if (result.success) {
        onOpenChange(false);
        form.reset({
          purchaseOrderId: '',
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
      description="Submit an invoice for an existing purchase order. Optionally include your invoice number for reference."
      icon={<Receipt className="h-5 w-5" />}
    >
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="flex min-h-0 flex-1 flex-col"
      >
        <BottomFormDrawerBody>
          <div className="grid grid-cols-1 gap-x-6 gap-y-5 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="purchaseOrderId">Purchase Order</Label>
              <Select
                value={form.watch('purchaseOrderId')}
                onValueChange={(v) =>
                  form.setValue('purchaseOrderId', v ?? '')
                }
              >
                <SelectTrigger id="purchaseOrderId">
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
                <p className="text-sm text-destructive">
                  {form.formState.errors.purchaseOrderId.message}
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
                {...form.register('totalAmount')}
                placeholder="0.00"
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
