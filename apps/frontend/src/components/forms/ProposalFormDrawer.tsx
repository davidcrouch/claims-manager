'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { standardSchemaResolver } from '@hookform/resolvers/standard-schema';
import { z } from 'zod';
import { FileText } from 'lucide-react';
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
import { createProposalAction } from '@/app/(app)/mutations';
import { fetchJobQuotesAction } from '@/app/(app)/jobs/[id]/actions';
import type { Quote } from '@/types/api';

const schema = z.object({
  quoteId: z.string().min(1, 'Estimate is required'),
  proposalNumber: z.string().optional(),
  name: z.string().optional(),
  proposalFromName: z.string().optional(),
  totalAmount: z.coerce.number().optional(),
  receivedDate: z.string().optional(),
  note: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export interface ProposalFormDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jobId: string;
}

export function ProposalFormDrawer({
  open,
  onOpenChange,
  jobId,
}: ProposalFormDrawerProps) {
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
      proposalNumber: '',
      name: '',
      proposalFromName: '',
      totalAmount: undefined,
      receivedDate: todayISO(),
      note: '',
    },
  });

  async function onSubmit(values: FormValues) {
    setSubmitting(true);
    setError(null);
    try {
      const result = await createProposalAction({
        quoteId: values.quoteId,
        jobId,
        proposalNumber: values.proposalNumber || undefined,
        name: values.name || undefined,
        proposalFromName: values.proposalFromName || undefined,
        totalAmount: values.totalAmount ?? undefined,
        receivedDate: values.receivedDate ? new Date(values.receivedDate).toISOString() : undefined,
        note: values.note || undefined,
      });
      if (result.success) {
        onOpenChange(false);
        form.reset();
        router.refresh();
      } else {
        setError(result.error ?? 'Failed to create proposal');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create proposal');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <BottomFormDrawer
      open={open}
      onOpenChange={onOpenChange}
      title="Create Proposal"
      description="Record a vendor proposal linked to an estimate on this job."
      icon={<FileText className="h-5 w-5" />}
    >
      <form onSubmit={form.handleSubmit(onSubmit)} className="flex min-h-0 flex-1 flex-col">
        <BottomFormDrawerBody>
          <div className="grid grid-cols-1 gap-x-6 gap-y-5 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="prop-quoteId">Estimate</Label>
              <Select
                value={form.watch('quoteId')}
                onValueChange={(v) => form.setValue('quoteId', v ?? '')}
              >
                <SelectTrigger id="prop-quoteId">
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
              {form.formState.errors.quoteId && (
                <p className="text-sm text-destructive">{form.formState.errors.quoteId.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="prop-proposalNumber">Proposal # (optional)</Label>
              <Input id="prop-proposalNumber" {...form.register('proposalNumber')} placeholder="e.g. PROP-001" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="prop-name">Name (optional)</Label>
              <Input id="prop-name" {...form.register('name')} placeholder="Proposal name" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="prop-proposalFromName">Vendor Name (optional)</Label>
              <Input id="prop-proposalFromName" {...form.register('proposalFromName')} placeholder="Vendor name" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="prop-totalAmount">Total Amount (optional)</Label>
              <Input id="prop-totalAmount" type="number" step="0.01" min="0" {...form.register('totalAmount')} placeholder="0.00" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="prop-receivedDate">Received Date (optional)</Label>
              <Input id="prop-receivedDate" type="date" {...form.register('receivedDate')} />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="prop-note">Note (optional)</Label>
              <Textarea id="prop-note" {...form.register('note')} placeholder="Add a note..." rows={3} />
            </div>
          </div>
          <BottomFormDrawerError error={error} />
        </BottomFormDrawerBody>

        <BottomFormDrawerFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="submit" disabled={submitting}>{submitting ? 'Creating...' : 'Create Proposal'}</Button>
        </BottomFormDrawerFooter>
      </form>
    </BottomFormDrawer>
  );
}
