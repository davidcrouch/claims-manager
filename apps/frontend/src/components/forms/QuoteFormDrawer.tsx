'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { standardSchemaResolver } from '@hookform/resolvers/standard-schema';
import { z } from 'zod';
import { FileSignature } from 'lucide-react';
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
import { createQuoteAction } from '@/app/(app)/mutations';

const quoteFormSchema = z.object({
  jobId: z.string().min(1, 'Job is required'),
  claimId: z.string().min(1, 'Claim is required'),
  quoteType: z.string().optional(),
  name: z.string().optional(),
  note: z.string().optional(),
  estimatedStart: z.string().optional(),
  estimatedCompletion: z.string().optional(),
});

type QuoteFormValues = z.infer<typeof quoteFormSchema>;

export interface QuoteFormDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jobId: string;
  claimId: string;
}

export function QuoteFormDrawer({
  open,
  onOpenChange,
  jobId,
  claimId,
}: QuoteFormDrawerProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const form = useForm<QuoteFormValues>({
    resolver: standardSchemaResolver(quoteFormSchema),
    defaultValues: {
      jobId,
      claimId,
      quoteType: '',
      name: '',
      note: '',
      estimatedStart: '',
      estimatedCompletion: '',
    },
  });

  useEffect(() => {
    form.reset({ ...form.getValues(), jobId, claimId });
  }, [jobId, claimId, form]);

  async function onSubmit(values: QuoteFormValues) {
    setSubmitting(true);
    setError(null);
    try {
      const result = await createQuoteAction({
        jobId: values.jobId,
        claimId: values.claimId,
        quoteType: values.quoteType || undefined,
        name: values.name || undefined,
        note: values.note || undefined,
        estimatedStart: values.estimatedStart || undefined,
        estimatedCompletion: values.estimatedCompletion || undefined,
      });
      if (result.success) {
        onOpenChange(false);
        form.reset({
          jobId,
          claimId,
          quoteType: '',
          name: '',
          note: '',
          estimatedStart: '',
          estimatedCompletion: '',
        });
        router.refresh();
      } else {
        setError(result.error ?? 'Failed to create estimate');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create estimate');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <BottomFormDrawer
      open={open}
      onOpenChange={onOpenChange}
      title="Create Estimate"
      description="Create a new draft estimate for this job. You can publish it to Crunchwork later."
      icon={<FileSignature className="h-5 w-5" />}
    >
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="flex min-h-0 flex-1 flex-col"
      >
        <BottomFormDrawerBody>
          <p className="mb-5 text-sm text-muted-foreground">
            Creating estimate for job {jobId}
          </p>

          <div className="grid grid-cols-1 gap-x-6 gap-y-5 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="quoteType">Quote Type (optional)</Label>
              <Select
                value={form.watch('quoteType')}
                onValueChange={(v) => form.setValue('quoteType', v ?? '')}
              >
                <SelectTrigger id="quoteType">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Initial">Initial</SelectItem>
                  <SelectItem value="Variation">Variation</SelectItem>
                  <SelectItem value="Supplementary">Supplementary</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">Name (optional)</Label>
              <Input
                id="name"
                {...form.register('name')}
                placeholder="Estimate name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="estimatedStart">Estimated Start (optional)</Label>
              <Input
                id="estimatedStart"
                type="date"
                {...form.register('estimatedStart')}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="estimatedCompletion">Estimated Completion (optional)</Label>
              <Input
                id="estimatedCompletion"
                type="date"
                {...form.register('estimatedCompletion')}
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
            {submitting ? 'Creating...' : 'Create Estimate'}
          </Button>
        </BottomFormDrawerFooter>
      </form>
    </BottomFormDrawer>
  );
}
