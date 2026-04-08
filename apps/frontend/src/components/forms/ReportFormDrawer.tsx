'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { standardSchemaResolver } from '@hookform/resolvers/standard-schema';
import { z } from 'zod';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { createReportAction } from '@/app/(app)/mutations';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

const reportFormSchema = z.object({
  jobId: z.string().min(1, 'Job is required'),
  claimId: z.string().min(1, 'Claim is required'),
  title: z.string().min(1, 'Title is required'),
  reportData: z.string().optional(),
});

type ReportFormValues = z.infer<typeof reportFormSchema>;

export interface ReportFormDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jobId: string;
  claimId: string;
}

export function ReportFormDrawer({ open, onOpenChange, jobId, claimId }: ReportFormDrawerProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const form = useForm<ReportFormValues>({
    resolver: standardSchemaResolver(reportFormSchema),
    defaultValues: {
      jobId,
      claimId,
      title: '',
      reportData: '',
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({ jobId, claimId, title: '', reportData: '' });
    }
  }, [open, jobId, claimId, form]);

  async function onSubmit(values: ReportFormValues) {
    setSubmitting(true);
    setError(null);
    try {
      const reportData = values.reportData
        ? (() => {
            try {
              return JSON.parse(values.reportData) as Record<string, unknown>;
            } catch {
              return { notes: values.reportData };
            }
          })()
        : {};
      const result = await createReportAction({
        jobId: values.jobId,
        claimId: values.claimId,
        title: values.title,
        reportData,
      });
      if (result.success) {
        onOpenChange(false);
        form.reset({ jobId, claimId, title: '', reportData: '' });
        router.refresh();
      } else {
        setError(result.error ?? 'Failed to create report');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create report');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Create Report</SheetTitle>
        </SheetHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input id="title" {...form.register('title')} placeholder="Report title" />
            {form.formState.errors.title && (
              <p className="text-sm text-destructive">{form.formState.errors.title.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="reportData">Notes (JSON or plain text)</Label>
            <Textarea
              id="reportData"
              {...form.register('reportData')}
              placeholder='{"notes": "..."} or plain text'
              rows={4}
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <SheetFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Creating...' : 'Create Report'}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
