'use client';

import { useState, useEffect } from 'react';
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
import { createBillAction } from '@/app/(app)/mutations';
import { fetchJobInvoicesAction } from '@/app/(app)/jobs/[id]/actions';
import type { Invoice } from '@/types/api';

const schema = z.object({
  invoiceId: z.string().min(1, 'Invoice is required'),
  billNumber: z.string().optional(),
  totalAmount: z.coerce.number().optional(),
  issueDate: z.string().optional(),
  receivedDate: z.string().optional(),
  dueDate: z.string().optional(),
  comments: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export interface BillFormDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jobId: string;
}

export function BillFormDrawer({
  open,
  onOpenChange,
  jobId,
}: BillFormDrawerProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);

  useEffect(() => {
    if (open) {
      fetchJobInvoicesAction(jobId).then((result) => setInvoices(result.data ?? []));
    }
  }, [open, jobId]);

  const form = useForm<FormValues>({
    resolver: standardSchemaResolver(schema),
    defaultValues: {
      invoiceId: '',
      billNumber: '',
      totalAmount: undefined,
      issueDate: todayISO(),
      receivedDate: todayISO(),
      dueDate: '',
      comments: '',
    },
  });

  async function onSubmit(values: FormValues) {
    setSubmitting(true);
    setError(null);
    try {
      const result = await createBillAction({
        invoiceId: values.invoiceId,
        jobId,
        billNumber: values.billNumber || undefined,
        totalAmount: values.totalAmount ?? undefined,
        issueDate: values.issueDate ? new Date(values.issueDate).toISOString() : undefined,
        receivedDate: values.receivedDate ? new Date(values.receivedDate).toISOString() : undefined,
        dueDate: values.dueDate ? new Date(values.dueDate).toISOString() : undefined,
        comments: values.comments || undefined,
      });
      if (result.success) {
        onOpenChange(false);
        form.reset();
        router.refresh();
      } else {
        setError(result.error ?? 'Failed to create bill');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create bill');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <BottomFormDrawer
      open={open}
      onOpenChange={onOpenChange}
      title="Create Bill"
      description="Record a vendor bill against an invoice on this job."
      icon={<Receipt className="h-5 w-5" />}
    >
      <form onSubmit={form.handleSubmit(onSubmit)} className="flex min-h-0 flex-1 flex-col">
        <BottomFormDrawerBody>
          <div className="grid grid-cols-1 gap-x-6 gap-y-5 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="bill-invoiceId">Invoice</Label>
              <Select
                value={form.watch('invoiceId')}
                onValueChange={(v) => form.setValue('invoiceId', v ?? '')}
              >
                <SelectTrigger id="bill-invoiceId">
                  <SelectValue placeholder="Select invoice" />
                </SelectTrigger>
                <SelectContent>
                  {invoices.map((inv) => (
                    <SelectItem key={inv.id} value={inv.id}>
                      {inv.invoiceNumber ?? inv.id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {form.formState.errors.invoiceId && (
                <p className="text-sm text-destructive">{form.formState.errors.invoiceId.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="bill-billNumber">Bill # (optional)</Label>
              <Input id="bill-billNumber" {...form.register('billNumber')} placeholder="e.g. BILL-001" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="bill-totalAmount">Total Amount (optional)</Label>
              <Input id="bill-totalAmount" type="number" step="0.01" min="0" {...form.register('totalAmount')} placeholder="0.00" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="bill-issueDate">Issue Date (optional)</Label>
              <Input id="bill-issueDate" type="date" {...form.register('issueDate')} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="bill-receivedDate">Received Date (optional)</Label>
              <Input id="bill-receivedDate" type="date" {...form.register('receivedDate')} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="bill-dueDate">Due Date (optional)</Label>
              <Input id="bill-dueDate" type="date" {...form.register('dueDate')} />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="bill-comments">Comments (optional)</Label>
              <Textarea id="bill-comments" {...form.register('comments')} placeholder="Add comments..." rows={3} />
            </div>
          </div>
          <BottomFormDrawerError error={error} />
        </BottomFormDrawerBody>

        <BottomFormDrawerFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="submit" disabled={submitting}>{submitting ? 'Creating...' : 'Create Bill'}</Button>
        </BottomFormDrawerFooter>
      </form>
    </BottomFormDrawer>
  );
}
