'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { standardSchemaResolver } from '@hookform/resolvers/standard-schema';
import { z } from 'zod';
import { Users } from 'lucide-react';
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
import { createContactAction } from '@/app/(app)/mutations';

const contactFormSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().optional(),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  mobilePhone: z.string().optional(),
  homePhone: z.string().optional(),
  workPhone: z.string().optional(),
  notes: z.string().optional(),
});

type ContactFormValues = z.infer<typeof contactFormSchema>;

export interface ContactFormDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ContactFormDrawer({
  open,
  onOpenChange,
}: ContactFormDrawerProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const form = useForm<ContactFormValues>({
    resolver: standardSchemaResolver(contactFormSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      mobilePhone: '',
      homePhone: '',
      workPhone: '',
      notes: '',
    },
  });

  async function onSubmit(values: ContactFormValues) {
    setSubmitting(true);
    setError(null);
    try {
      const result = await createContactAction({
        firstName: values.firstName,
        lastName: values.lastName || undefined,
        email: values.email || undefined,
        mobilePhone: values.mobilePhone || undefined,
        homePhone: values.homePhone || undefined,
        workPhone: values.workPhone || undefined,
        notes: values.notes || undefined,
      });
      if (result.success) {
        onOpenChange(false);
        form.reset();
        router.refresh();
      } else {
        setError(result.error ?? 'Failed to create contact');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create contact');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <BottomFormDrawer
      open={open}
      onOpenChange={onOpenChange}
      title="Create Contact"
      description="Add a new contact to your organisation."
      icon={<Users className="h-5 w-5" />}
    >
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="flex min-h-0 flex-1 flex-col"
      >
        <BottomFormDrawerBody>
          <div className="grid grid-cols-1 gap-x-6 gap-y-5 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="firstName">First Name</Label>
              <Input
                id="firstName"
                {...form.register('firstName')}
                placeholder="First name"
              />
              {form.formState.errors.firstName && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.firstName.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="lastName">Last Name</Label>
              <Input
                id="lastName"
                {...form.register('lastName')}
                placeholder="Last name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                {...form.register('email')}
                placeholder="email@example.com"
              />
              {form.formState.errors.email && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.email.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="mobilePhone">Mobile Phone</Label>
              <Input
                id="mobilePhone"
                type="tel"
                {...form.register('mobilePhone')}
                placeholder="04xx xxx xxx"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="homePhone">Home Phone</Label>
              <Input
                id="homePhone"
                type="tel"
                {...form.register('homePhone')}
                placeholder="Home phone"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="workPhone">Work Phone</Label>
              <Input
                id="workPhone"
                type="tel"
                {...form.register('workPhone')}
                placeholder="Work phone"
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="notes">Notes (optional)</Label>
              <Textarea
                id="notes"
                {...form.register('notes')}
                placeholder="Any additional notes..."
                rows={3}
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
            {submitting ? 'Creating...' : 'Create Contact'}
          </Button>
        </BottomFormDrawerFooter>
      </form>
    </BottomFormDrawer>
  );
}
