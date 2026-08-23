'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { standardSchemaResolver } from '@hookform/resolvers/standard-schema';
import { z } from 'zod';
import { FileText, Loader2, UserPlus, X } from 'lucide-react';
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
import {
  CreateSubmitOverlay,
  navigateToCreated,
  useCreateSubmitPhase,
} from '@/components/forms/CreateSubmitOverlay';
import { fetchRfqsSentToContactAction } from '@/app/(app)/rfqs/actions';
import { JobSelectField } from '@/components/forms/JobSelectField';
import {
  ContactSearchField,
  contactFromCreated,
  type ContactSearchHit,
} from '@/components/forms/JobContactsPicker';
import { ContactFormDrawer } from '@/components/contacts/ContactFormDrawer';
import type { JobOption } from '@/components/shared/job-label';
import type { Contact, Rfq } from '@/types/api';

const schema = z.object({
  contactId: z.string().min(1, 'Received from is required'),
  rfqId: z.string().min(1, 'Request for proposal is required'),
  proposalNumber: z.string().optional(),
  name: z.string().optional(),
  totalAmount: z.number().optional(),
  receivedDate: z.string().optional(),
  note: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

type ReceivedFromContact = {
  id: string;
  name: string;
  email?: string;
};

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function rfqLabel(rfq: Rfq): string {
  const title =
    rfq.rfqNumber?.trim() ||
    rfq.name?.trim() ||
    rfq.internalNumber?.trim() ||
    rfq.id;
  const sentTo = rfq.rfqToName?.trim();
  return sentTo ? `${title} — ${sentTo}` : title;
}

function contactFromHit(hit: ContactSearchHit): ReceivedFromContact {
  return {
    id: hit.id,
    name: hit.name,
    email: hit.email,
  };
}

function receivedFromCreated(contact: Contact): ReceivedFromContact {
  const created = contactFromCreated(contact);
  return {
    id: contact.id,
    name: [created.firstName, created.lastName].filter(Boolean).join(' '),
    email: created.email,
  };
}

export interface ProposalFormDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When omitted, a job picker is shown (requires `jobs`). */
  jobId?: string;
  jobs?: JobOption[];
}

export function ProposalFormDrawer({
  open,
  onOpenChange,
  jobId,
  jobs,
}: ProposalFormDrawerProps) {
  const router = useRouter();
  const { phase, busy, startCreating, startOpening, resetPhase } =
    useCreateSubmitPhase();
  const [error, setError] = useState<string | null>(null);
  const [rfqs, setRfqs] = useState<Rfq[]>([]);
  const [rfqsLoading, setRfqsLoading] = useState(false);
  const [pickedJobId, setPickedJobId] = useState('');
  const [receivedFrom, setReceivedFrom] = useState<ReceivedFromContact | null>(
    null,
  );
  const [contactDrawerOpen, setContactDrawerOpen] = useState(false);
  const needsJobPicker = (jobs?.length ?? 0) > 0;
  const effectiveJobId = needsJobPicker ? pickedJobId : (jobId ?? '');

  const form = useForm<FormValues>({
    resolver: standardSchemaResolver(schema),
    defaultValues: {
      contactId: '',
      rfqId: '',
      proposalNumber: '',
      name: '',
      totalAmount: undefined,
      receivedDate: todayISO(),
      note: '',
    },
  });

  useEffect(() => {
    if (open) {
      setPickedJobId(jobId ?? '');
      return;
    }
    setPickedJobId('');
    setRfqs([]);
    setRfqsLoading(false);
    setReceivedFrom(null);
    setContactDrawerOpen(false);
    setError(null);
    form.reset({
      contactId: '',
      rfqId: '',
      proposalNumber: '',
      name: '',
      totalAmount: undefined,
      receivedDate: todayISO(),
      note: '',
    });
  }, [open, jobId, form]);

  useEffect(() => {
    const contactId = receivedFrom?.id;
    if (!open || !contactId) {
      setRfqs([]);
      setRfqsLoading(false);
      return;
    }

    let cancelled = false;
    setRfqsLoading(true);
    fetchRfqsSentToContactAction(contactId, effectiveJobId || undefined)
      .then((data) => {
        if (cancelled) return;
        const list = data ?? [];
        setRfqs(list);
        if (list.length === 1) {
          form.setValue('rfqId', list[0].id, { shouldValidate: true });
        }
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        console.error('[frontend:ProposalFormDrawer.loadRfqs]', err);
        setRfqs([]);
      })
      .finally(() => {
        if (!cancelled) setRfqsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, receivedFrom?.id, effectiveJobId, form]);

  function selectContact(contact: ReceivedFromContact) {
    setReceivedFrom(contact);
    form.setValue('contactId', contact.id, { shouldValidate: true });
    form.setValue('rfqId', '');
    setRfqs([]);
    setError(null);
  }

  function clearContact() {
    setReceivedFrom(null);
    form.setValue('contactId', '');
    form.setValue('rfqId', '');
    setRfqs([]);
  }

  function handleOpenChange(next: boolean) {
    if (!next && contactDrawerOpen) return;
    onOpenChange(next);
  }

  async function onSubmit(values: FormValues) {
    const selectedRfq = rfqs.find((r) => r.id === values.rfqId);
    const submitJobId = selectedRfq?.jobId || effectiveJobId;
    if (!submitJobId) {
      setError('Job is required');
      return;
    }
    if (!selectedRfq?.quoteId) {
      setError('The selected request is not linked to an estimate');
      return;
    }

    startCreating();
    setError(null);
    try {
      const result = await createProposalAction({
        quoteId: selectedRfq.quoteId,
        rfqId: selectedRfq.id,
        jobId: submitJobId,
        claimId: selectedRfq.claimId || undefined,
        proposalNumber: values.proposalNumber || undefined,
        name: values.name || undefined,
        proposalFromName: receivedFrom?.name || undefined,
        proposalFrom: {
          contactId: receivedFrom?.id,
          name: receivedFrom?.name,
          email: receivedFrom?.email,
        },
        totalAmount: values.totalAmount ?? undefined,
        receivedDate: values.receivedDate
          ? new Date(values.receivedDate).toISOString()
          : undefined,
        note: values.note || undefined,
      });
      if (result.success) {
        if (result.proposal?.id) {
          startOpening();
          navigateToCreated(router, `/proposals/${result.proposal.id}`);
          return;
        }
        resetPhase();
        onOpenChange(false);
        router.refresh();
      } else {
        setError(result.error ?? 'Failed to create proposal');
        resetPhase();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create proposal');
      resetPhase();
    }
  }

  return (
    <>
      <BottomFormDrawer
        open={open}
        onOpenChange={handleOpenChange}
        title="Receive Proposal"
        description="Record a vendor proposal received from a contact."
        icon={<FileText className="h-5 w-5" />}
        preventClose={busy}
      >
        <form onSubmit={form.handleSubmit(onSubmit)} className="flex min-h-0 flex-1 flex-col">
          <BottomFormDrawerBody>
            <div className="grid grid-cols-1 gap-x-6 gap-y-5 md:grid-cols-2">
              {needsJobPicker && jobs && (
                <JobSelectField
                  jobs={jobs}
                  value={pickedJobId}
                  onValueChange={(id) => {
                    setPickedJobId(id);
                    form.setValue('rfqId', '');
                  }}
                />
              )}

              <div className="space-y-2 md:col-span-2">
                <Label>
                  Received From <span className="text-destructive">*</span>
                </Label>
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <ContactSearchField
                      selectedIds={receivedFrom ? [receivedFrom.id] : []}
                      onSelect={(hit) => selectContact(contactFromHit(hit))}
                    />
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => setContactDrawerOpen(true)}
                    className="h-9 shrink-0 gap-1.5 bg-blue-600 text-white hover:bg-blue-500"
                  >
                    <UserPlus className="h-4 w-4" />
                    Create Contact
                  </Button>
                </div>
                {receivedFrom && (
                  <div className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                    <div className="min-w-0">
                      <span className="font-medium">{receivedFrom.name}</span>
                      {receivedFrom.email && (
                        <span className="ml-2 text-muted-foreground">
                          {receivedFrom.email}
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={clearContact}
                      className="rounded p-1 hover:bg-destructive/10"
                      aria-label="Clear received from"
                    >
                      <X className="h-4 w-4 text-muted-foreground" />
                    </button>
                  </div>
                )}
                {form.formState.errors.contactId && (
                  <p className="text-sm text-destructive">
                    {form.formState.errors.contactId.message}
                  </p>
                )}
              </div>

              {receivedFrom && (
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="prop-rfqId">
                    Request for Proposal <span className="text-destructive">*</span>
                  </Label>
                  {rfqsLoading ? (
                    <div className="flex h-9 items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Looking up requests sent to this email…
                    </div>
                  ) : rfqs.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      {!receivedFrom.email
                        ? 'This contact has no email address, so matching requests for proposal cannot be found.'
                        : `No requests for proposal were sent to ${receivedFrom.email}${effectiveJobId ? ' for the selected job' : ''}.`}
                    </p>
                  ) : (
                    <Select
                      value={form.watch('rfqId') || null}
                      onValueChange={(v) =>
                        form.setValue('rfqId', v ?? '', { shouldValidate: true })
                      }
                      items={Object.fromEntries(rfqs.map((r) => [r.id, rfqLabel(r)]))}
                    >
                      <SelectTrigger id="prop-rfqId" className="w-full">
                        <SelectValue placeholder="Select request for proposal" />
                      </SelectTrigger>
                      <SelectContent>
                        {rfqs.map((r) => (
                          <SelectItem key={r.id} value={r.id}>
                            {rfqLabel(r)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  {form.formState.errors.rfqId && (
                    <p className="text-sm text-destructive">
                      {form.formState.errors.rfqId.message}
                    </p>
                  )}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="prop-proposalNumber">Proposal #</Label>
                <Input
                  id="prop-proposalNumber"
                  {...form.register('proposalNumber')}
                  placeholder="e.g. PROP-001"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="prop-name">Name</Label>
                <Input
                  id="prop-name"
                  {...form.register('name')}
                  placeholder="Proposal name"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="prop-totalAmount">Total Amount</Label>
                <Input
                  id="prop-totalAmount"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  {...form.register('totalAmount', {
                    setValueAs: (v) =>
                      v === '' || v == null || Number.isNaN(Number(v))
                        ? undefined
                        : Number(v),
                  })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="prop-receivedDate">Received Date</Label>
                <Input
                  id="prop-receivedDate"
                  type="date"
                  {...form.register('receivedDate')}
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="prop-note">Note</Label>
                <Textarea
                  id="prop-note"
                  {...form.register('note')}
                  placeholder="Add a note..."
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
              size="lg"
              disabled={busy}
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" size="lg" disabled={busy}>
              {busy ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {phase === 'opening' ? 'Opening…' : 'Creating…'}
                </>
              ) : (
                'Receive Proposal'
              )}
            </Button>
          </BottomFormDrawerFooter>
        </form>
      </BottomFormDrawer>
      <ContactFormDrawer
        open={contactDrawerOpen}
        onOpenChange={setContactDrawerOpen}
        onSuccess={(contact) => selectContact(receivedFromCreated(contact))}
        defaultTypeRef="contact-type-vendor"
      />
      <CreateSubmitOverlay phase={phase} entityLabel="proposal" />
    </>
  );
}
