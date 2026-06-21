'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { standardSchemaResolver } from '@hookform/resolvers/standard-schema';
import { z } from 'zod';
import { Send } from 'lucide-react';
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
import { createRfqAction } from '@/app/(app)/mutations';

const schema = z.object({
  rfqNumber: z.string().optional(),
  name: z.string().optional(),
  rfqToName: z.string().optional(),
  rfqToEmail: z.string().email('Invalid email').optional().or(z.literal('')),
  sentDate: z.string().optional(),
  dueDate: z.string().optional(),
  note: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export interface RfqFormDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jobId: string;
}

export function RfqFormDrawer({
  open,
  onOpenChange,
  jobId,
}: RfqFormDrawerProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const form = useForm<FormValues>({
    resolver: standardSchemaResolver(schema),
    defaultValues: {
      rfqNumber: '',
      name: '',
      rfqToName: '',
      rfqToEmail: '',
      sentDate: todayISO(),
      dueDate: '',
      note: '',
    },
  });

  async function onSubmit(values: FormValues) {
    setSubmitting(true);
    setError(null);
    try {
      const result = await createRfqAction({
        jobId,
        rfqNumber: values.rfqNumber || undefined,
        name: values.name || undefined,
        rfqToName: values.rfqToName || undefined,
        rfqToEmail: values.rfqToEmail || undefined,
        sentDate: values.sentDate ? new Date(values.sentDate).toISOString() : undefined,
        dueDate: values.dueDate ? new Date(values.dueDate).toISOString() : undefined,
        note: values.note || undefined,
        includePricing: true,
        includeQuantities: true,
      });
      if (result.success) {
        onOpenChange(false);
        form.reset();
        router.refresh();
      } else {
        setError(result.error ?? 'Failed to create RFQ');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create RFQ');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <BottomFormDrawer
      open={open}
      onOpenChange={onOpenChange}
      title="Create RFQ"
      description="Send a request for quote to a vendor or subcontractor."
      icon={<Send className="h-5 w-5" />}
    >
      <form onSubmit={form.handleSubmit(onSubmit)} className="flex min-h-0 flex-1 flex-col">
        <BottomFormDrawerBody>
          <div className="grid grid-cols-1 gap-x-6 gap-y-5 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="rfq-rfqNumber">RFQ # (optional)</Label>
              <Input id="rfq-rfqNumber" {...form.register('rfqNumber')} placeholder="e.g. RFQ-001" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="rfq-name">Name (optional)</Label>
              <Input id="rfq-name" {...form.register('name')} placeholder="RFQ name" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="rfq-rfqToName">Vendor / Sub Name (optional)</Label>
              <Input id="rfq-rfqToName" {...form.register('rfqToName')} placeholder="Vendor name" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="rfq-rfqToEmail">Vendor Email (optional)</Label>
              <Input id="rfq-rfqToEmail" type="email" {...form.register('rfqToEmail')} placeholder="vendor@example.com" />
              {form.formState.errors.rfqToEmail && (
                <p className="text-sm text-destructive">{form.formState.errors.rfqToEmail.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="rfq-sentDate">Sent Date (optional)</Label>
              <Input id="rfq-sentDate" type="date" {...form.register('sentDate')} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="rfq-dueDate">Due Date (optional)</Label>
              <Input id="rfq-dueDate" type="date" {...form.register('dueDate')} />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="rfq-note">Note (optional)</Label>
              <Textarea id="rfq-note" {...form.register('note')} placeholder="Add a note..." rows={3} />
            </div>
          </div>
          <BottomFormDrawerError error={error} />
        </BottomFormDrawerBody>

        <BottomFormDrawerFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="submit" disabled={submitting}>{submitting ? 'Creating...' : 'Create RFQ'}</Button>
        </BottomFormDrawerFooter>
      </form>
    </BottomFormDrawer>
  );
}
