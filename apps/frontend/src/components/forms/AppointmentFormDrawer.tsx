'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
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
import { createAppointmentAction } from '@/app/(app)/mutations';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

const appointmentFormSchema = z.object({
  jobId: z.string().min(1, 'Job is required'),
  name: z.string().min(1, 'Name is required'),
  location: z.string().min(1, 'Location is required'),
  startDate: z.string().min(1, 'Start date is required'),
  startTime: z.string().min(1, 'Start time is required'),
  endDate: z.string().min(1, 'End date is required'),
  endTime: z.string().min(1, 'End time is required'),
});

type AppointmentFormValues = z.infer<typeof appointmentFormSchema>;

export interface AppointmentFormDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jobId: string;
}

export function AppointmentFormDrawer({ open, onOpenChange, jobId }: AppointmentFormDrawerProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const form = useForm<AppointmentFormValues>({
    resolver: zodResolver(appointmentFormSchema),
    defaultValues: {
      jobId,
      name: '',
      location: 'ONSITE',
      startDate: '',
      startTime: '09:00',
      endDate: '',
      endTime: '10:00',
    },
  });

  useEffect(() => {
    form.reset({ ...form.getValues(), jobId });
  }, [jobId, form]);

  async function onSubmit(values: AppointmentFormValues) {
    setSubmitting(true);
    setError(null);
    try {
      const startDate = new Date(`${values.startDate}T${values.startTime}`);
      const endDate = new Date(`${values.endDate}T${values.endTime}`);
      const result = await createAppointmentAction({
        jobId: values.jobId,
        name: values.name,
        location: values.location,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      });
      if (result.success) {
        onOpenChange(false);
        form.reset({
          jobId,
          name: '',
          location: '',
          startDate: '',
          startTime: '09:00',
          endDate: '',
          endTime: '10:00',
        });
        router.refresh();
      } else {
        setError(result.error ?? 'Failed to create appointment');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create appointment');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Create Appointment</SheetTitle>
        </SheetHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input id="name" {...form.register('name')} placeholder="Appointment name" />
            {form.formState.errors.name && (
              <p className="text-sm text-destructive">{form.formState.errors.name.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="location">Location</Label>
            <select
              id="location"
              {...form.register('location')}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors"
            >
              <option value="ONSITE">On-site</option>
              <option value="DIGITAL">Digital</option>
            </select>
            {form.formState.errors.location && (
              <p className="text-sm text-destructive">{form.formState.errors.location.message}</p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startDate">Start Date</Label>
              <Input id="startDate" type="date" {...form.register('startDate')} />
              {form.formState.errors.startDate && (
                <p className="text-sm text-destructive">{form.formState.errors.startDate.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="startTime">Start Time</Label>
              <Input id="startTime" type="time" {...form.register('startTime')} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="endDate">End Date</Label>
              <Input id="endDate" type="date" {...form.register('endDate')} />
              {form.formState.errors.endDate && (
                <p className="text-sm text-destructive">{form.formState.errors.endDate.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="endTime">End Time</Label>
              <Input id="endTime" type="time" {...form.register('endTime')} />
            </div>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <SheetFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Creating...' : 'Create Appointment'}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
