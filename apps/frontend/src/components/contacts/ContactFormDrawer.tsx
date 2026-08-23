'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { standardSchemaResolver } from '@hookform/resolvers/standard-schema';
import { z } from 'zod';
import { Loader2, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  BottomFormDrawer,
  BottomFormDrawerBody,
  BottomFormDrawerError,
  BottomFormDrawerFooter,
} from '@/components/forms/BottomFormDrawer';
import { ChatDrawer } from '@/components/chat/ChatDrawer';
import { ContactRelatedJobsSection } from '@/components/contacts/ContactRelatedJobsSection';
import { buildAIContext, type AIContextPayload } from '@/lib/ai/use-ai-context';
import {
  createContactAction,
  updateContactAction,
  fetchContactTypeLookupsAction,
} from '@/app/(app)/mutations';
import {
  fetchContactAction,
  fetchContactRelatedJobsAction,
} from '@/app/(app)/contacts/actions';
import {
  CreateSubmitOverlay,
  useCreateSubmitPhase,
} from '@/components/forms/CreateSubmitOverlay';
import type { Contact, ContactRelatedJob } from '@/types/api';

const contactFormSchema = z.object({
  typeLookupIds: z.array(z.string()).min(1, 'Select at least one contact type'),
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().optional(),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  mobilePhone: z.string().optional(),
  homePhone: z.string().optional(),
  workPhone: z.string().optional(),
  notes: z.string().optional(),
});

type ContactFormValues = z.infer<typeof contactFormSchema>;

const emptyFormValues = (): ContactFormValues => ({
  typeLookupIds: [],
  firstName: '',
  lastName: '',
  email: '',
  mobilePhone: '',
  homePhone: '',
  workPhone: '',
  notes: '',
});

function contactTypeIdsFromContact(contact: Contact): string[] {
  if (contact.typeLookupIds?.length) return contact.typeLookupIds;
  if (contact.typeLookupId) return [contact.typeLookupId];
  return [];
}

function valuesFromContact(contact: Contact): ContactFormValues {
  return {
    typeLookupIds: contactTypeIdsFromContact(contact),
    firstName: contact.firstName ?? '',
    lastName: contact.lastName ?? '',
    email: contact.email ?? '',
    mobilePhone: contact.mobilePhone ?? '',
    homePhone: contact.homePhone ?? '',
    workPhone: contact.workPhone ?? '',
    notes: contact.notes ?? '',
  };
}

type ContactTypeLookup = {
  id: string;
  name?: string;
  externalReference?: string;
};

export interface ContactFormDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  renderMode?: 'drawer' | 'canvas';
  aiAssistEnabled?: boolean;
  /** When set, forces companion layout for an already-open chat drawer. */
  companionChatOpen?: boolean;
  /** Called after a contact is created so the parent can update local state. */
  onSuccess?: (contact: Contact) => void;
  /** When set, opens the drawer in edit mode for this contact. */
  contact?: Contact | null;
  contactId?: string | null;
  /**
   * Prefill contact type by lookup externalReference
   * (e.g. `contact-type-vendor` or `seed-contact-type-vendor`).
   */
  defaultTypeRef?: string;
}

export function ContactFormDrawer({
  open,
  onOpenChange,
  renderMode = 'drawer',
  aiAssistEnabled = false,
  companionChatOpen: companionChatOpenProp,
  onSuccess,
  contact: contactProp,
  contactId,
  defaultTypeRef,
}: ContactFormDrawerProps) {
  const router = useRouter();
  const { phase, busy: createBusy, startCreating, resetPhase } = useCreateSubmitPhase();
  const [submitting, setSubmitting] = useState(false);
  const [loadingContact, setLoadingContact] = useState(false);
  const [loadingJobs, setLoadingJobs] = useState(false);
  const [contact, setContact] = useState<Contact | null>(contactProp ?? null);
  const [relatedJobs, setRelatedJobs] = useState<ContactRelatedJob[]>([]);
  const isEdit = Boolean((contactId ?? contactProp?.id)?.trim());
  const busy = createBusy || submitting;
  const [error, setError] = useState<string | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [aiContext, setAiContext] = useState<AIContextPayload | undefined>();
  const [contactTypes, setContactTypes] = useState<ContactTypeLookup[]>([]);

  const form = useForm<ContactFormValues>({
    resolver: standardSchemaResolver(contactFormSchema),
    defaultValues: emptyFormValues(),
  });

  const selectedTypeIds = form.watch('typeLookupIds');

  useEffect(() => {
    if (!open) {
      setContact(contactProp ?? null);
      setRelatedJobs([]);
      return;
    }

    setContact(contactProp ?? null);
    const id = contactId?.trim();
    if (!id) {
      form.reset(emptyFormValues());
      setRelatedJobs([]);
      return;
    }

    let cancelled = false;
    setLoadingContact(true);
    setLoadingJobs(true);

    void Promise.all([fetchContactAction(id), fetchContactRelatedJobsAction(id)])
      .then(([fetched, jobs]) => {
        if (cancelled) return;
        const resolved = fetched ?? (contactProp?.id === id ? contactProp : null);
        if (resolved) {
          setContact(resolved);
          form.reset(valuesFromContact(resolved));
        }
        setRelatedJobs(jobs);
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingContact(false);
          setLoadingJobs(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [open, contactId, contactProp, form]);

  useEffect(() => {
    if (!open) {
      setChatOpen(false);
      return;
    }
    let cancelled = false;
    void fetchContactTypeLookupsAction().then((rows) => {
      if (cancelled) return;
      setContactTypes(rows);
      if (!isEdit && defaultTypeRef) {
        const match = rows.find((t) => {
          const ext = t.externalReference ?? '';
          return ext === defaultTypeRef || ext === `seed-${defaultTypeRef}`;
        });
        if (match && !form.getValues('typeLookupIds').includes(match.id)) {
          form.setValue('typeLookupIds', [match.id], { shouldValidate: true });
        }
      }
    });
    return () => {
      cancelled = true;
    };
  }, [open, defaultTypeRef, isEdit, form]);

  function toggleContactType(typeId: string, checked: boolean) {
    const current = form.getValues('typeLookupIds');
    const next = checked
      ? [...new Set([...current, typeId])]
      : current.filter((id) => id !== typeId);
    form.setValue('typeLookupIds', next, { shouldValidate: true });
  }

  async function onSubmit(values: ContactFormValues) {
    if (isEdit) setSubmitting(true);
    else startCreating();
    setError(null);
    try {
      const payload = {
        typeLookupIds: values.typeLookupIds,
        firstName: values.firstName,
        lastName: values.lastName || undefined,
        email: values.email || undefined,
        mobilePhone: values.mobilePhone || undefined,
        homePhone: values.homePhone || undefined,
        workPhone: values.workPhone || undefined,
        notes: values.notes || undefined,
      };
      const result = isEdit
        ? await updateContactAction(contact!.id, payload)
        : await createContactAction(payload);
      if (result.success) {
        if (!isEdit) resetPhase();
        onOpenChange(false);
        form.reset(emptyFormValues());
        if (result.contact) onSuccess?.(result.contact);
        router.refresh();
      } else {
        setError(
          result.error ??
            (isEdit ? 'Failed to update contact' : 'Failed to create contact'),
        );
        if (!isEdit) resetPhase();
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : isEdit
            ? 'Failed to update contact'
            : 'Failed to create contact',
      );
      if (!isEdit) resetPhase();
    } finally {
      setSubmitting(false);
    }
  }

  function handleAIAssist() {
    setAiContext(
      buildAIContext(
        'ContactFormDrawer',
        {},
        {
          entityType: 'contact',
          formState: form.getValues(),
          summary: isEdit
            ? 'The user is editing a contact. Help suggest values or answer questions about this form.'
            : 'The user is creating a new contact. Help suggest values or answer questions about this form.',
        },
      ),
    );
    setChatOpen(true);
  }

  const displayName = contact
    ? [contact.firstName, contact.lastName].filter(Boolean).join(' ') || 'Contact'
    : 'Contact';

  const formContent = (
    <form
      onSubmit={form.handleSubmit(onSubmit)}
      className="flex min-h-0 flex-1 flex-col"
    >
      <BottomFormDrawerBody>
        {loadingContact ? (
          <p className="text-sm text-slate-500">Loading contact…</p>
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-x-6 gap-y-5 md:grid-cols-2">
              <div className="space-y-3 md:col-span-2">
                <Label>Contact types</Label>
                <p className="text-xs text-slate-500">
                  Select every role this person can have (e.g. vendor and insured).
                </p>
                <div className="flex flex-wrap gap-x-6 gap-y-3 rounded-lg border border-slate-200 bg-slate-50/60 p-4">
                  {contactTypes.map((t) => {
                    const label = t.name ?? t.externalReference ?? t.id;
                    const checked = selectedTypeIds.includes(t.id);
                    return (
                      <label
                        key={t.id}
                        className="flex cursor-pointer items-center gap-2 text-sm text-slate-700"
                      >
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(next) => toggleContactType(t.id, next)}
                        />
                        <span>{label}</span>
                      </label>
                    );
                  })}
                </div>
                {form.formState.errors.typeLookupIds && (
                  <p className="text-sm text-destructive">
                    {form.formState.errors.typeLookupIds.message}
                  </p>
                )}
              </div>

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

            {isEdit && (
              <ContactRelatedJobsSection
                relatedJobs={relatedJobs}
                loading={loadingJobs}
                onJobNavigate={() => onOpenChange(false)}
              />
            )}
          </div>
        )}

        <BottomFormDrawerError error={error} />
      </BottomFormDrawerBody>

      <BottomFormDrawerFooter>
        <Button
          type="button"
          variant="outline"
          disabled={busy || loadingContact}
          onClick={() => onOpenChange(false)}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={busy || loadingContact}>
          {busy ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              {isEdit ? 'Saving…' : 'Creating…'}
            </>
          ) : isEdit ? (
            'Save'
          ) : (
            'Create Contact'
          )}
        </Button>
      </BottomFormDrawerFooter>
    </form>
  );

  if (renderMode === 'canvas') {
    return (
      <>
        {formContent}
        <CreateSubmitOverlay phase={phase} entityLabel="contact" />
      </>
    );
  }

  return (
    <>
      <BottomFormDrawer
        open={open}
        onOpenChange={onOpenChange}
        title={isEdit ? `Edit ${displayName}` : 'Create Contact'}
        description={
          isEdit
            ? 'Update contact details, types, and review related jobs.'
            : 'Add a new contact to your organisation.'
        }
        icon={<Users className="h-5 w-5" />}
        aiAssistEnabled={aiAssistEnabled}
        onAIAssist={handleAIAssist}
        companionChatOpen={companionChatOpenProp ?? chatOpen}
        preventClose={busy}
      >
        {formContent}
      </BottomFormDrawer>
      {!isEdit && <CreateSubmitOverlay phase={phase} entityLabel="contact" />}
      {aiAssistEnabled && companionChatOpenProp === undefined && (
        <ChatDrawer
          open={chatOpen}
          onOpenChange={setChatOpen}
          initialContext={aiContext}
          relatedEntityType="contact"
          besideCanvas
        />
      )}
    </>
  );
}
