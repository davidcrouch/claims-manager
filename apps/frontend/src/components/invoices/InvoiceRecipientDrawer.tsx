'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Building2,
  Loader2,
  Shield,
  User,
  Users,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  BottomFormDrawer,
  BottomFormDrawerBody,
  BottomFormDrawerError,
  BottomFormDrawerFooter,
} from '@/components/forms/BottomFormDrawer';
import {
  JobContactsPicker,
  contactFromCreated,
  contactTypeRefMatches,
  type JobContactRef,
} from '@/components/forms/JobContactsPicker';
import { ContactFormDrawer } from '@/components/contacts/ContactFormDrawer';
import { fetchContactsAction } from '@/app/(app)/contacts/actions';
import {
  fetchContactTypeLookupsAction,
  updateInvoiceAction,
} from '@/app/(app)/mutations';
import { resolveJobKindCaps } from '@/lib/job-kind-registry';
import type { Contact, Invoice, Job } from '@/types/api';

export type InvoiceRecipientType = 'insurer' | 'insured' | 'other';

function isInsuredContactType(params: {
  contact: Contact;
  insuredTypeIds: Set<string>;
}): boolean {
  const { contact, insuredTypeIds } = params;
  if (contact.typeLookupId && insuredTypeIds.has(contact.typeLookupId)) return true;
  if (contact.typeLookupIds?.some((id) => insuredTypeIds.has(id))) return true;
  return (contact.contactTypes ?? []).some((t) => {
    const name = (t.name ?? '').trim().toLowerCase();
    return (
      name === 'insured' ||
      name === 'customer' ||
      contactTypeRefMatches(t.externalReference, 'contact-type-insured')
    );
  });
}

function contactToRef(contact: Contact): JobContactRef {
  return {
    key: `existing-${contact.id}`,
    contactId: contact.id,
    firstName: contact.firstName?.trim() || contact.email || 'Contact',
    lastName: contact.lastName?.trim() || undefined,
    email: contact.email?.trim() || undefined,
    mobilePhone: contact.mobilePhone?.trim() || undefined,
  };
}

function recipientContactToRef(invoice: Invoice): JobContactRef | null {
  const id = invoice.recipientContactId ?? invoice.recipientContact?.id;
  if (!id) return null;
  const name = invoice.recipientContact?.name?.trim() || '';
  const [firstName, ...rest] = name.split(/\s+/).filter(Boolean);
  return {
    key: `existing-${id}`,
    contactId: id,
    firstName: firstName || invoice.recipientContact?.email || 'Contact',
    lastName: rest.length ? rest.join(' ') : undefined,
    email: invoice.recipientContact?.email?.trim() || undefined,
  };
}

export function formatInvoiceRecipientLabel(invoice: Invoice): string {
  if (invoice.recipientType === 'insurer') return 'Insurer';
  if (invoice.recipientType === 'insured') {
    return `Insured${invoice.recipientContact?.name ? ` — ${invoice.recipientContact.name}` : ''}${invoice.recipientContact?.email ? ` <${invoice.recipientContact.email}>` : ''}`;
  }
  if (invoice.recipientType === 'other') {
    return `Other${invoice.recipientContact?.name ? ` — ${invoice.recipientContact.name}` : ''}${invoice.recipientContact?.email ? ` <${invoice.recipientContact.email}>` : ''}`;
  }
  return '—';
}

export interface InvoiceRecipientDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoice: Invoice;
  job?: Job | null;
}

export function InvoiceRecipientDrawer({
  open,
  onOpenChange,
  invoice,
  job,
}: InvoiceRecipientDrawerProps) {
  const router = useRouter();
  const [recipientType, setRecipientType] =
    useState<InvoiceRecipientType>('insured');
  const [insuredContact, setInsuredContact] = useState<JobContactRef | null>(
    null,
  );
  const [otherContacts, setOtherContacts] = useState<JobContactRef[]>([]);
  const [contactsLoading, setContactsLoading] = useState(false);
  const [contactDrawerOpen, setContactDrawerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const jobCaps = useMemo(
    () =>
      resolveJobKindCaps({
        provider: job?.provider,
        jobType: job?.jobType,
      }),
    [job?.provider, job?.jobType],
  );
  const insurerAvailable = jobCaps.publishMode === 'external';
  const jobId = invoice.jobId ?? job?.id ?? null;

  const resetFromInvoice = useCallback(() => {
    const type = (invoice.recipientType ?? 'insured') as InvoiceRecipientType;
    const nextType =
      type === 'insurer' && !insurerAvailable ? 'insured' : type;
    setRecipientType(nextType);
    setError(null);
    setSaving(false);
    setContactDrawerOpen(false);

    const existing = recipientContactToRef(invoice);
    if (nextType === 'other' && existing) {
      setOtherContacts([existing]);
    } else {
      setOtherContacts([]);
    }
  }, [invoice, insurerAvailable]);

  useEffect(() => {
    if (!open) return;
    resetFromInvoice();
  }, [open, resetFromInvoice]);

  useEffect(() => {
    if (!open || !jobId) {
      setInsuredContact(null);
      return;
    }
    let cancelled = false;
    setContactsLoading(true);
    void (async () => {
      try {
        const [types, contactsRes] = await Promise.all([
          fetchContactTypeLookupsAction(),
          fetchContactsAction({ jobId, limit: 100 }),
        ]);
        if (cancelled) return;
        const insuredTypeIds = new Set(
          types
            .filter((t) => {
              const name = (t.name ?? '').trim().toLowerCase();
              return (
                name === 'insured' ||
                name === 'customer' ||
                contactTypeRefMatches(t.externalReference, 'contact-type-insured')
              );
            })
            .map((t) => t.id),
        );
        const contacts = contactsRes?.data ?? [];
        const insured =
          contacts.find(
            (c) =>
              isInsuredContactType({ contact: c, insuredTypeIds }) &&
              !!c.email?.trim(),
          ) ??
          contacts.find((c) =>
            isInsuredContactType({ contact: c, insuredTypeIds }),
          ) ??
          null;
        setInsuredContact(insured ? contactToRef(insured) : null);
      } catch (err) {
        console.error(
          '[frontend:InvoiceRecipientDrawer.loadInsuredContact]',
          err,
        );
        if (!cancelled) setInsuredContact(null);
      } finally {
        if (!cancelled) setContactsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, jobId]);

  useEffect(() => {
    if (!insurerAvailable && recipientType === 'insurer') {
      setRecipientType('insured');
    }
  }, [insurerAvailable, recipientType]);

  function handleOpenChange(next: boolean) {
    if (saving) return;
    if (!next && contactDrawerOpen) return;
    onOpenChange(next);
  }

  async function handleSave() {
    setError(null);
    if (recipientType === 'insurer' && !insurerAvailable) {
      setError('Insurer delivery is only available for Crunchwork jobs');
      return;
    }
    if (recipientType === 'insured') {
      if (!insuredContact?.contactId) {
        setError('No insured/customer contact found on this job');
        return;
      }
      if (!insuredContact.email?.trim()) {
        setError('Insured contact must have an email address');
        return;
      }
    }
    if (recipientType === 'other') {
      const other = otherContacts[0];
      if (!other?.contactId) {
        setError('Select a contact for Other recipient');
        return;
      }
      if (!other.email?.trim()) {
        setError('Selected contact must have an email address');
        return;
      }
    }

    setSaving(true);
    try {
      const result = await updateInvoiceAction(invoice.id, {
        recipientType,
        ...(recipientType !== 'insurer'
          ? {
              recipientContactId:
                recipientType === 'insured'
                  ? insuredContact!.contactId
                  : otherContacts[0]!.contactId,
            }
          : { recipientContactId: null }),
      });
      if (!result.success) {
        setError(result.error ?? 'Failed to update recipient');
        return;
      }
      toast.success('Invoice recipient updated');
      onOpenChange(false);
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to update recipient',
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <BottomFormDrawer
        open={open}
        onOpenChange={handleOpenChange}
        title="Change recipient"
        description="Who should receive this invoice when you publish?"
        icon={<Users className="h-5 w-5" />}
        preventClose={saving}
      >
        <BottomFormDrawerBody>
          <div className="mx-auto max-w-2xl space-y-5">
            <div className="space-y-3">
              <button
                type="button"
                disabled={!insurerAvailable}
                onClick={() => insurerAvailable && setRecipientType('insurer')}
                className={`flex w-full items-start gap-3 rounded-lg border px-4 py-3 text-left transition-colors ${
                  recipientType === 'insurer'
                    ? 'border-emerald-300 bg-emerald-50 ring-1 ring-emerald-200'
                    : insurerAvailable
                      ? 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                      : 'cursor-not-allowed border-slate-100 bg-slate-50 opacity-60'
                }`}
              >
                <Shield className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-900">Insurer</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Push the invoice to Crunchwork via their API.
                  </p>
                  {!insurerAvailable && (
                    <p className="mt-1 text-xs text-amber-700">
                      Available only for Crunchwork / external jobs.
                    </p>
                  )}
                </div>
                <Building2 className="h-4 w-4 shrink-0 text-slate-400" />
              </button>

              <button
                type="button"
                onClick={() => setRecipientType('insured')}
                className={`flex w-full items-start gap-3 rounded-lg border px-4 py-3 text-left transition-colors ${
                  recipientType === 'insured'
                    ? 'border-emerald-300 bg-emerald-50 ring-1 ring-emerald-200'
                    : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                <User className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-900">Insured</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Generate a Word/PDF invoice and email the insured contact.
                  </p>
                  {contactsLoading ? (
                    <p className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Loading insured contact…
                    </p>
                  ) : insuredContact ? (
                    <p className="mt-2 text-xs text-slate-700">
                      {[insuredContact.firstName, insuredContact.lastName]
                        .filter(Boolean)
                        .join(' ')}
                      {insuredContact.email
                        ? ` · ${insuredContact.email}`
                        : ' · No email'}
                    </p>
                  ) : (
                    <p className="mt-2 text-xs text-amber-700">
                      No Customer/Insured contact found on this job.
                    </p>
                  )}
                </div>
              </button>

              <button
                type="button"
                onClick={() => setRecipientType('other')}
                className={`flex w-full items-start gap-3 rounded-lg border px-4 py-3 text-left transition-colors ${
                  recipientType === 'other'
                    ? 'border-emerald-300 bg-emerald-50 ring-1 ring-emerald-200'
                    : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                <Users className="mt-0.5 h-5 w-5 shrink-0 text-violet-600" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-900">Other</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Generate a Word/PDF invoice and email a contact you select.
                  </p>
                </div>
              </button>
            </div>

            {recipientType === 'other' && (
              <div className="rounded-lg border border-slate-200 bg-white px-4 py-4">
                <JobContactsPicker
                  contacts={otherContacts}
                  onAdd={(c) => setOtherContacts([c])}
                  onRemove={() => setOtherContacts([])}
                  onNewContact={() => setContactDrawerOpen(true)}
                  description="Select one contact to receive this invoice. They must have an email address."
                  newContactLabel="New contact"
                />
              </div>
            )}
          </div>
          <BottomFormDrawerError error={error} />
        </BottomFormDrawerBody>

        <BottomFormDrawerFooter>
          <Button
            type="button"
            variant="outline"
            size="lg"
            disabled={saving}
            onClick={() => handleOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="lg"
            disabled={saving || contactsLoading}
            onClick={() => void handleSave()}
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Saving…
              </>
            ) : (
              'Save recipient'
            )}
          </Button>
        </BottomFormDrawerFooter>
      </BottomFormDrawer>

      <ContactFormDrawer
        open={contactDrawerOpen}
        onOpenChange={setContactDrawerOpen}
        onSuccess={(contact) => {
          setOtherContacts([contactFromCreated(contact)]);
          setContactDrawerOpen(false);
        }}
      />
    </>
  );
}
