'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { standardSchemaResolver } from '@hookform/resolvers/standard-schema';
import { z } from 'zod';
import { Briefcase } from 'lucide-react';
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
import { createJobAction } from '@/app/(app)/jobs/mutations';
import type { Claim } from '@/types/api';

const jobFormSchema = z.object({
  claimId: z.string().min(1, 'Claim is required'),
  jobTypeId: z.string().min(1, 'Job type is required'),
  jobInstructions: z.string().optional(),
  makeSafeRequired: z.boolean().optional(),
  collectExcess: z.boolean().optional(),
  excess: z.string().optional(),
});

type JobFormValues = z.infer<typeof jobFormSchema>;

export interface JobFormDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  claims: Claim[];
  jobTypes: { id: string; name?: string }[];
}

export function JobFormDrawer({
  open,
  onOpenChange,
  claims,
  jobTypes,
}: JobFormDrawerProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const form = useForm<JobFormValues>({
    resolver: standardSchemaResolver(jobFormSchema),
    defaultValues: {
      claimId: '',
      jobTypeId: '',
      jobInstructions: '',
      makeSafeRequired: false,
      collectExcess: false,
      excess: '',
    },
  });

  async function onSubmit(values: JobFormValues) {
    setSubmitting(true);
    setError(null);
    try {
      const result = await createJobAction({
        claimId: values.claimId,
        jobType: { id: values.jobTypeId },
        jobInstructions: values.jobInstructions,
        makeSafeRequired: values.makeSafeRequired,
        collectExcess: values.collectExcess,
        excess: values.excess ? parseFloat(values.excess) : undefined,
      });
      if (result.success) {
        onOpenChange(false);
        form.reset();
        router.refresh();
      } else {
        setError(result.error ?? 'Failed to create job');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create job');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <BottomFormDrawer
      open={open}
      onOpenChange={onOpenChange}
      title="Create Job"
      description="Add a new job to an existing claim. Choose the job type, include any instructions, and set the excess if applicable."
      icon={<Briefcase className="h-5 w-5" />}
    >
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="flex min-h-0 flex-1 flex-col"
      >
        <BottomFormDrawerBody>
          <div className="grid grid-cols-1 gap-x-6 gap-y-5 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="claimId">Claim</Label>
              <Select
                value={form.watch('claimId')}
                onValueChange={(v) => form.setValue('claimId', v ?? '')}
              >
                <SelectTrigger id="claimId">
                  <SelectValue placeholder="Select claim" />
                </SelectTrigger>
                <SelectContent>
                  {claims.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.claimNumber ?? c.externalReference ?? c.id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {form.formState.errors.claimId && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.claimId.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="jobTypeId">Job Type</Label>
              <Select
                value={form.watch('jobTypeId')}
                onValueChange={(v) => form.setValue('jobTypeId', v ?? '')}
              >
                <SelectTrigger id="jobTypeId">
                  <SelectValue placeholder="Select job type" />
                </SelectTrigger>
                <SelectContent>
                  {jobTypes.map((jt) => (
                    <SelectItem key={jt.id} value={jt.id}>
                      {jt.name ?? jt.id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {form.formState.errors.jobTypeId && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.jobTypeId.message}
                </p>
              )}
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="jobInstructions">Instructions</Label>
              <Textarea
                id="jobInstructions"
                {...form.register('jobInstructions')}
                placeholder="Job instructions..."
                rows={4}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="excess">Excess</Label>
              <Input
                id="excess"
                type="number"
                step="0.01"
                {...form.register('excess')}
                placeholder="0.00"
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
            {submitting ? 'Creating...' : 'Create Job'}
          </Button>
        </BottomFormDrawerFooter>
      </form>
    </BottomFormDrawer>
  );
}
