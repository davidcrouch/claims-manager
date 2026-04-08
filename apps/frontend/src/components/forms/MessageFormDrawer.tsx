'use client';

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
import { createMessageAction } from '@/app/(app)/jobs/[id]/actions';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

const messageFormSchema = z.object({
  subject: z.string().min(1, 'Subject is required'),
  body: z.string().min(1, 'Message body is required'),
});

type MessageFormValues = z.infer<typeof messageFormSchema>;

export interface MessageFormDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jobId: string;
  claimId: string;
}

export function MessageFormDrawer({ open, onOpenChange, jobId, claimId }: MessageFormDrawerProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const form = useForm<MessageFormValues>({
    resolver: standardSchemaResolver(messageFormSchema),
    defaultValues: {
      subject: '',
      body: '',
    },
  });

  async function onSubmit(values: MessageFormValues) {
    setSubmitting(true);
    setError(null);
    try {
      const result = await createMessageAction({
        fromJobId: jobId,
        fromClaimId: claimId,
        toClaimId: claimId,
        toJobId: jobId,
        subject: values.subject,
        body: values.body,
      });
      if (result.success) {
        onOpenChange(false);
        form.reset();
        router.refresh();
      } else {
        setError(result.error ?? 'Failed to send message');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send message');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Send Message</SheetTitle>
        </SheetHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="subject">Subject</Label>
            <Input
              id="subject"
              {...form.register('subject')}
              placeholder="Message subject"
            />
            {form.formState.errors.subject && (
              <p className="text-sm text-destructive">{form.formState.errors.subject.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="body">Message</Label>
            <Textarea
              id="body"
              {...form.register('body')}
              placeholder="Enter your message..."
              rows={5}
            />
            {form.formState.errors.body && (
              <p className="text-sm text-destructive">{form.formState.errors.body.message}</p>
            )}
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <SheetFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Sending...' : 'Send Message'}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
