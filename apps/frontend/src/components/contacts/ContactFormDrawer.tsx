'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { standardSchemaResolver } from '@hookform/resolvers/standard-schema';
import { z } from 'zod';
import { Collapsible } from '@base-ui/react/collapsible';
import { ChevronRight, Loader2, Users } from 'lucide-react';
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
import { ChatDrawer } from '@/components/chat/ChatDrawer';
import { ContactRelatedJobsSection } from '@/components/contacts/ContactRelatedJobsSection';
import {
  AddressAutocompleteInput,
  type AddressSuggestion,
} from '@/components/shared/AddressAutocompleteInput';
import { formatAddress } from '@/components/shared/detail';
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
import type { AddressPayload, Contact, ContactRelatedJob } from '@/types/api';

const AU_STATES = ['ACT', 'NSW', 'NT', 'QLD', 'SA', 'TAS', 'VIC', 'WA'] as const;

type SiteAddressForm = {
  unitNumber: string;
  streetNumber: string;
  streetName: string;
  suburb: string;
  state: string;
  postcode: string;
  country: string;
};

const EMPTY_ADDRESS: SiteAddressForm = {
  unitNumber: '',
  streetNumber: '',
  streetName: '',
  suburb: '',
  state: '',
  postcode: '',
  country: 'Australia',
};

function addressFromPayload(
  address: AddressPayload | Record<string, unknown> | null | undefined,
): SiteAddressForm {
  if (!address || typeof address !== 'object') return { ...EMPTY_ADDRESS };
  const a = address as AddressPayload;
  return {
    unitNumber: a.unitNumber ?? '',
    streetNumber: a.streetNumber ?? '',
    streetName: a.streetName ?? '',
    suburb: a.suburb ?? '',
    state: a.state ?? '',
    postcode: a.postcode ?? '',
    country: a.country ?? 'Australia',
  };
}

function toAddressPayload(form: SiteAddressForm): AddressPayload | undefined {
  const address: AddressPayload = {
    unitNumber: form.unitNumber.trim() || undefined,
    streetNumber: form.streetNumber.trim() || undefined,
    streetName: form.streetName.trim() || undefined,
    suburb: form.suburb.trim() || undefined,
    state: form.state.trim() || undefined,
    postcode: form.postcode.trim() || undefined,
    country: form.country.trim() || undefined,
  };
  return Object.values(address).some(Boolean) ? address : undefined;
}

function contactAddress(contact: Contact | null | undefined): SiteAddressForm {
  if (!contact) return { ...EMPTY_ADDRESS };
  if (contact.address) return addressFromPayload(contact.address);
  const payload = contact.contactPayload;
  if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
    const nested = (payload as Record<string, unknown>).address;
    if (nested && typeof nested === 'object') {
      return addressFromPayload(nested as AddressPayload);
    }
  }
  return { ...EMPTY_ADDRESS };
}

const contactFormSchema = z.object({
  typeLookupIds: z.array(z.string()).min(1, 'Select a contact type'),
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
  const [address, setAddress] = useState<SiteAddressForm>(EMPTY_ADDRESS);
  const [addressSearch, setAddressSearch] = useState('');
  const [addressFieldsOpen, setAddressFieldsOpen] = useState(false);

  const form = useForm<ContactFormValues>({
    resolver: standardSchemaResolver(contactFormSchema),
    defaultValues: emptyFormValues(),
  });

  const selectedTypeIds = form.watch('typeLookupIds');
  const selectedTypeId = selectedTypeIds[0] ?? '';

  const stateItems = useMemo(
    () => Object.fromEntries(AU_STATES.map((s) => [s, s])) as Record<string, string>,
    [],
  );

  const contactTypeItems = useMemo(
    () =>
      Object.fromEntries(
        contactTypes.map((t) => [t.id, t.name ?? t.externalReference ?? t.id]),
      ) as Record<string, string>,
    [contactTypes],
  );

  const addressSummary = useMemo(
    () => formatAddress(address, { full: true }) || null,
    [address],
  );

  useEffect(() => {
    if (!open) {
      setContact(contactProp ?? null);
      setRelatedJobs([]);
      setAddress({ ...EMPTY_ADDRESS });
      setAddressSearch('');
      setAddressFieldsOpen(false);
      return;
    }

    setContact(contactProp ?? null);
    const id = contactId?.trim();
    if (!id) {
      form.reset(emptyFormValues());
      setRelatedJobs([]);
      setAddress({ ...EMPTY_ADDRESS });
      setAddressSearch('');
      setAddressFieldsOpen(false);
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
          const nextAddress = contactAddress(resolved);
          setAddress(nextAddress);
          setAddressSearch(formatAddress(nextAddress, { full: true }) || '');
          setAddressFieldsOpen(false);
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
    // form methods are stable; omit `form` to avoid cancelling the lookup fetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional
  }, [open, defaultTypeRef, isEdit]);

  function updateAddressField<K extends keyof SiteAddressForm>(
    key: K,
    value: SiteAddressForm[K],
  ) {
    setAddress((prev) => ({ ...prev, [key]: value }));
  }

  async function onSubmit(values: ContactFormValues) {
    if (isEdit) setSubmitting(true);
    else startCreating();
    setError(null);
    try {
      const nextTypeId = values.typeLookupIds[0];
      const originalTypeIds = contact ? contactTypeIdsFromContact(contact) : [];
      const typeLookupIds =
        isEdit && nextTypeId && originalTypeIds.includes(nextTypeId)
          ? [nextTypeId, ...originalTypeIds.filter((id) => id !== nextTypeId)]
          : values.typeLookupIds;

      const payload = {
        typeLookupIds,
        firstName: values.firstName,
        lastName: values.lastName || undefined,
        email: values.email || undefined,
        mobilePhone: values.mobilePhone || undefined,
        homePhone: values.homePhone || undefined,
        workPhone: values.workPhone || undefined,
        notes: values.notes || undefined,
        address: toAddressPayload(address) ?? null,
      };
      const result = isEdit
        ? await updateContactAction(contact!.id, payload)
        : await createContactAction(payload);
      if (result.success) {
        if (!isEdit) resetPhase();
        onOpenChange(false);
        form.reset(emptyFormValues());
        setAddress({ ...EMPTY_ADDRESS });
        setAddressSearch('');
        setAddressFieldsOpen(false);
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
          formState: { ...form.getValues(), address },
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
              <div className="space-y-2 md:col-span-2 md:grid md:grid-cols-2 md:gap-x-6">
                <div className="space-y-2">
                  <Label htmlFor="contact-type">Contact type</Label>
                  <Select
                    value={selectedTypeId || null}
                    onValueChange={(v) =>
                      form.setValue('typeLookupIds', v ? [v] : [], {
                        shouldValidate: true,
                      })
                    }
                    items={contactTypeItems}
                  >
                    <SelectTrigger id="contact-type" className="w-full">
                      <SelectValue placeholder="Select contact type">
                        {(value: string | null) =>
                          value
                            ? (contactTypeItems[value] ?? value)
                            : 'Select contact type'
                        }
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {contactTypes.length === 0 ? (
                        <SelectItem value="__loading" disabled>
                          Loading types…
                        </SelectItem>
                      ) : (
                        contactTypes.map((t) => (
                          <SelectItem key={t.id} value={t.id}>
                            {t.name ?? t.externalReference ?? t.id}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  {form.formState.errors.typeLookupIds && (
                    <p className="text-sm text-destructive">
                      {form.formState.errors.typeLookupIds.message}
                    </p>
                  )}
                </div>
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

              <div className="md:col-span-2">
                <p className="mb-3 text-sm font-medium text-foreground">Address</p>
                <div className="mb-3 space-y-2">
                  <Label htmlFor="contact-address-search">Search address</Label>
                  <AddressAutocompleteInput
                    id="contact-address-search"
                    value={addressSearch}
                    onChange={setAddressSearch}
                    onSelect={(suggestion: AddressSuggestion) => {
                      const p = suggestion.parts ?? {};
                      setAddress({
                        unitNumber: p.unitNumber ?? '',
                        streetNumber: p.streetNumber ?? '',
                        streetName: p.streetName ?? '',
                        suburb: p.suburb ?? '',
                        state: p.state ?? '',
                        postcode: p.postcode ?? '',
                        country: p.country ?? 'Australia',
                      });
                      setAddressSearch(suggestion.label);
                      setAddressFieldsOpen(false);
                    }}
                    placeholder="Search Australian address to fill fields…"
                    name="contact-address-search"
                  />
                  {!addressFieldsOpen && addressSummary ? (
                    <p className="text-sm text-muted-foreground">{addressSummary}</p>
                  ) : null}
                </div>
                <Collapsible.Root
                  open={addressFieldsOpen}
                  onOpenChange={setAddressFieldsOpen}
                >
                  <Collapsible.Trigger className="group/address-fields flex w-full items-center gap-1.5 rounded-md py-1.5 text-left text-sm font-medium text-foreground hover:text-foreground/80">
                    <ChevronRight className="size-3.5 shrink-0 transition-transform duration-200 group-data-panel-open/address-fields:rotate-90" />
                    {addressSummary
                      ? 'Edit address manually'
                      : 'Enter address manually'}
                  </Collapsible.Trigger>
                  <Collapsible.Panel className="overflow-hidden transition-all duration-200 data-ending-style:h-0 data-starting-style:h-0">
                    <div className="grid grid-cols-1 gap-x-6 gap-y-4 pt-3 md:grid-cols-6">
                      <div className="space-y-2 md:col-span-1">
                        <Label htmlFor="contact-unit">Unit</Label>
                        <Input
                          id="contact-unit"
                          value={address.unitNumber}
                          onChange={(e) =>
                            updateAddressField('unitNumber', e.target.value)
                          }
                        />
                      </div>
                      <div className="space-y-2 md:col-span-1">
                        <Label htmlFor="contact-street-no">Street no.</Label>
                        <Input
                          id="contact-street-no"
                          value={address.streetNumber}
                          onChange={(e) =>
                            updateAddressField('streetNumber', e.target.value)
                          }
                        />
                      </div>
                      <div className="space-y-2 md:col-span-4">
                        <Label htmlFor="contact-street-name">Street name</Label>
                        <Input
                          id="contact-street-name"
                          value={address.streetName}
                          onChange={(e) =>
                            updateAddressField('streetName', e.target.value)
                          }
                          placeholder="e.g. Smith Street"
                        />
                      </div>
                      <div className="space-y-2 md:col-span-2">
                        <Label htmlFor="contact-suburb">Suburb</Label>
                        <Input
                          id="contact-suburb"
                          value={address.suburb}
                          onChange={(e) =>
                            updateAddressField('suburb', e.target.value)
                          }
                        />
                      </div>
                      <div className="space-y-2 md:col-span-1">
                        <Label htmlFor="contact-state">State</Label>
                        <Select
                          value={address.state || null}
                          onValueChange={(v) =>
                            updateAddressField('state', v ?? '')
                          }
                          items={stateItems}
                        >
                          <SelectTrigger id="contact-state" className="w-full">
                            <SelectValue placeholder="State" />
                          </SelectTrigger>
                          <SelectContent>
                            {AU_STATES.map((s) => (
                              <SelectItem key={s} value={s}>
                                {s}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2 md:col-span-1">
                        <Label htmlFor="contact-postcode">Postcode</Label>
                        <Input
                          id="contact-postcode"
                          value={address.postcode}
                          onChange={(e) =>
                            updateAddressField('postcode', e.target.value)
                          }
                        />
                      </div>
                      <div className="space-y-2 md:col-span-2">
                        <Label htmlFor="contact-country">Country</Label>
                        <Input
                          id="contact-country"
                          value={address.country}
                          onChange={(e) =>
                            updateAddressField('country', e.target.value)
                          }
                        />
                      </div>
                    </div>
                  </Collapsible.Panel>
                </Collapsible.Root>
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
