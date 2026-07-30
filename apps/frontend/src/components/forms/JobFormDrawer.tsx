'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { standardSchemaResolver } from '@hookform/resolvers/standard-schema';
import { z } from 'zod';
import {
  Briefcase,
  ChevronRight,
  Loader2,
  Plus,
  Search,
  UserPlus,
  X,
} from 'lucide-react';
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
import { searchContactsAction } from '@/app/(app)/mutations';

type WizardStep = 'details' | 'contacts';

const STEPS: WizardStep[] = ['details', 'contacts'];
const STEP_LABELS: Record<WizardStep, string> = {
  details: 'Job Details',
  contacts: 'Contacts',
};

const detailsSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  jobTypeId: z.string().min(1, 'Job type is required'),
  jobInstructions: z.string().optional(),
  makeSafeRequired: z.boolean().optional(),
  excess: z.string().optional(),
  unitNumber: z.string().optional(),
  streetNumber: z.string().optional(),
  streetName: z.string().optional(),
  suburb: z.string().optional(),
  state: z.string().optional(),
  postcode: z.string().optional(),
  country: z.string().optional(),
});

type DetailsValues = z.infer<typeof detailsSchema>;

type ContactRef = {
  key: string;
  contactId?: string;
  firstName: string;
  lastName?: string;
  email?: string;
  mobilePhone?: string;
};

type SearchHit = {
  id: string;
  type: 'USER' | 'CONTACT';
  name: string;
  email?: string;
};

const AU_STATES = ['ACT', 'NSW', 'NT', 'QLD', 'SA', 'TAS', 'VIC', 'WA'] as const;

export interface JobFormDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jobTypes: { id: string; name?: string }[];
}

export function JobFormDrawer({
  open,
  onOpenChange,
  jobTypes,
}: JobFormDrawerProps) {
  const router = useRouter();
  const [step, setStep] = useState<WizardStep>('details');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [contacts, setContacts] = useState<ContactRef[]>([]);
  const [showNewContact, setShowNewContact] = useState(false);
  const [newFirstName, setNewFirstName] = useState('');
  const [newLastName, setNewLastName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newMobile, setNewMobile] = useState('');

  const form = useForm<DetailsValues>({
    resolver: standardSchemaResolver(detailsSchema),
    defaultValues: {
      name: '',
      jobTypeId: '',
      jobInstructions: '',
      makeSafeRequired: false,
      excess: '',
      unitNumber: '',
      streetNumber: '',
      streetName: '',
      suburb: '',
      state: '',
      postcode: '',
      country: 'Australia',
    },
  });

  const jobTypeId = form.watch('jobTypeId');
  const stateValue = form.watch('state');

  const jobTypeItems = useMemo(
    () =>
      Object.fromEntries(
        jobTypes.map((jt) => [jt.id, jt.name ?? jt.id]),
      ) as Record<string, string>,
    [jobTypes],
  );

  const stateItems = useMemo(
    () => Object.fromEntries(AU_STATES.map((s) => [s, s])) as Record<string, string>,
    [],
  );

  const reset = useCallback(() => {
    setStep('details');
    setError(null);
    setSubmitting(false);
    setContacts([]);
    setShowNewContact(false);
    setNewFirstName('');
    setNewLastName('');
    setNewEmail('');
    setNewMobile('');
    form.reset();
  }, [form]);

  useEffect(() => {
    if (!open) reset();
  }, [open, reset]);

  function handleOpenChange(next: boolean) {
    onOpenChange(next);
    if (!next) reset();
  }

  async function handleNext() {
    const valid = await form.trigger();
    if (!valid) return;
    setError(null);
    setStep('contacts');
  }

  function addSearchedContact(hit: SearchHit) {
    if (contacts.some((c) => c.contactId === hit.id)) return;
    const [firstName, ...rest] = hit.name.split(' ');
    setContacts((prev) => [
      ...prev,
      {
        key: `existing-${hit.id}`,
        contactId: hit.id,
        firstName: firstName || hit.name,
        lastName: rest.join(' ') || undefined,
        email: hit.email,
      },
    ]);
  }

  function addNewContact() {
    const firstName = newFirstName.trim();
    if (!firstName) {
      setError('First name is required for a new contact');
      return;
    }
    setContacts((prev) => [
      ...prev,
      {
        key: `new-${Date.now()}`,
        firstName,
        lastName: newLastName.trim() || undefined,
        email: newEmail.trim() || undefined,
        mobilePhone: newMobile.trim() || undefined,
      },
    ]);
    setNewFirstName('');
    setNewLastName('');
    setNewEmail('');
    setNewMobile('');
    setShowNewContact(false);
    setError(null);
  }

  function removeContact(key: string) {
    setContacts((prev) => prev.filter((c) => c.key !== key));
  }

  async function handleSubmit() {
    const valid = await form.trigger();
    if (!valid) {
      setStep('details');
      return;
    }

    const values = form.getValues();
    setSubmitting(true);
    setError(null);

    const address = {
      unitNumber: values.unitNumber?.trim() || undefined,
      streetNumber: values.streetNumber?.trim() || undefined,
      streetName: values.streetName?.trim() || undefined,
      suburb: values.suburb?.trim() || undefined,
      state: values.state?.trim() || undefined,
      postcode: values.postcode?.trim() || undefined,
      country: values.country?.trim() || undefined,
    };
    const hasAddress = Object.values(address).some(Boolean);

    try {
      const result = await createJobAction(
        {
          name: values.name.trim(),
          jobTypeLookupId: values.jobTypeId,
          jobInstructions: values.jobInstructions?.trim() || undefined,
          makeSafeRequired: values.makeSafeRequired ?? false,
          excess: values.excess ? parseFloat(values.excess) : undefined,
          ...(hasAddress ? { address } : {}),
          contacts: contacts.map((c) =>
            c.contactId
              ? { contactId: c.contactId }
              : {
                  firstName: c.firstName,
                  lastName: c.lastName,
                  email: c.email,
                  mobilePhone: c.mobilePhone,
                },
          ),
        },
        { provider: 'direct' },
      );
      if (result.success) {
        handleOpenChange(false);
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

  const stepIndex = STEPS.indexOf(step);

  return (
    <BottomFormDrawer
      open={open}
      onOpenChange={handleOpenChange}
      title="Create Job"
      description="Create an internal job. Add site details first, then optionally attach contacts."
      icon={<Briefcase className="h-5 w-5" />}
    >
      <div className="border-b border-slate-200 px-8 py-3">
        <ol className="flex flex-wrap gap-2 text-xs">
          {STEPS.map((s, i) => (
            <li
              key={s}
              className={`rounded-full px-3 py-1 ${
                i === stepIndex
                  ? 'bg-slate-900 text-white'
                  : i < stepIndex
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-slate-100 text-slate-500'
              }`}
            >
              {i + 1}. {STEP_LABELS[s]}
            </li>
          ))}
        </ol>
      </div>

      <BottomFormDrawerBody>
        {step === 'details' && (
          <div className="grid grid-cols-1 gap-x-6 gap-y-5 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="job-name">Name</Label>
              <Input
                id="job-name"
                {...form.register('name')}
                placeholder="e.g. Kitchen make-safe"
              />
              {form.formState.errors.name && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.name.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="jobTypeId">Job Type</Label>
              <Select
                value={jobTypeId || null}
                onValueChange={(v) =>
                  form.setValue('jobTypeId', v ?? '', { shouldValidate: true })
                }
                items={jobTypeItems}
              >
                <SelectTrigger id="jobTypeId" className="w-full">
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
              {jobTypes.length === 0 && (
                <p className="text-sm text-amber-700">
                  No internal job types found. Run migrations to seed direct job types.
                </p>
              )}
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="jobInstructions">Instructions</Label>
              <Textarea
                id="jobInstructions"
                {...form.register('jobInstructions')}
                placeholder="Job instructions..."
                rows={3}
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

            <div className="flex items-center gap-2">
              <input
                id="makeSafeRequired"
                type="checkbox"
                className="h-4 w-4 rounded border-gray-300"
                {...form.register('makeSafeRequired')}
              />
              <Label htmlFor="makeSafeRequired" className="text-sm font-normal">
                Make safe required
              </Label>
            </div>

            <div className="md:col-span-2">
              <p className="mb-3 text-sm font-medium text-foreground">Site address</p>
              <div className="grid grid-cols-1 gap-x-6 gap-y-4 md:grid-cols-6">
                <div className="space-y-2 md:col-span-1">
                  <Label htmlFor="unitNumber">Unit</Label>
                  <Input id="unitNumber" {...form.register('unitNumber')} />
                </div>
                <div className="space-y-2 md:col-span-1">
                  <Label htmlFor="streetNumber">Street no.</Label>
                  <Input id="streetNumber" {...form.register('streetNumber')} />
                </div>
                <div className="space-y-2 md:col-span-4">
                  <Label htmlFor="streetName">Street name</Label>
                  <Input id="streetName" {...form.register('streetName')} />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="suburb">Suburb</Label>
                  <Input id="suburb" {...form.register('suburb')} />
                </div>
                <div className="space-y-2 md:col-span-1">
                  <Label htmlFor="state">State</Label>
                  <Select
                    value={stateValue || null}
                    onValueChange={(v) => form.setValue('state', v ?? '')}
                    items={stateItems}
                  >
                    <SelectTrigger id="state" className="w-full">
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
                  <Label htmlFor="postcode">Postcode</Label>
                  <Input id="postcode" {...form.register('postcode')} />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="country">Country</Label>
                  <Input id="country" {...form.register('country')} />
                </div>
              </div>
            </div>
          </div>
        )}

        {step === 'contacts' && (
          <div className="space-y-6">
            <div className="space-y-2">
              <Label>Add contacts</Label>
              <p className="text-sm text-muted-foreground">
                Search existing contacts or add a new one. Contacts are optional.
              </p>
              <ContactSearchField
                selectedIds={contacts.map((c) => c.contactId).filter(Boolean) as string[]}
                onSelect={addSearchedContact}
              />
            </div>

            {contacts.length > 0 && (
              <ul className="space-y-2">
                {contacts.map((c) => (
                  <li
                    key={c.key}
                    className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
                  >
                    <div>
                      <span className="font-medium">
                        {[c.firstName, c.lastName].filter(Boolean).join(' ')}
                      </span>
                      {c.email && (
                        <span className="ml-2 text-muted-foreground">{c.email}</span>
                      )}
                      {!c.contactId && (
                        <span className="ml-2 rounded bg-emerald-50 px-1.5 py-0.5 text-xs text-emerald-700">
                          New
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => removeContact(c.key)}
                      className="rounded p-1 hover:bg-destructive/10"
                      aria-label="Remove contact"
                    >
                      <X className="h-4 w-4 text-muted-foreground" />
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {!showNewContact ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowNewContact(true)}
              >
                <UserPlus className="mr-1.5 h-4 w-4" />
                New contact
              </Button>
            ) : (
              <div className="space-y-3 rounded-md border p-4">
                <p className="text-sm font-medium">New contact</p>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="new-first">First name</Label>
                    <Input
                      id="new-first"
                      value={newFirstName}
                      onChange={(e) => setNewFirstName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="new-last">Last name</Label>
                    <Input
                      id="new-last"
                      value={newLastName}
                      onChange={(e) => setNewLastName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="new-email">Email</Label>
                    <Input
                      id="new-email"
                      type="email"
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="new-mobile">Mobile</Label>
                    <Input
                      id="new-mobile"
                      value={newMobile}
                      onChange={(e) => setNewMobile(e.target.value)}
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button type="button" size="sm" onClick={addNewContact}>
                    <Plus className="mr-1 h-4 w-4" />
                    Add
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => setShowNewContact(false)}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        <BottomFormDrawerError error={error} />
      </BottomFormDrawerBody>

      <BottomFormDrawerFooter>
        <Button
          type="button"
          variant="outline"
          onClick={() => handleOpenChange(false)}
        >
          Cancel
        </Button>
        {step === 'contacts' && (
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setError(null);
              setStep('details');
            }}
          >
            Back
          </Button>
        )}
        {step === 'details' ? (
          <Button type="button" onClick={handleNext}>
            Next
            <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        ) : (
          <Button type="button" disabled={submitting} onClick={handleSubmit}>
            {submitting ? 'Creating...' : 'Create Job'}
          </Button>
        )}
      </BottomFormDrawerFooter>
    </BottomFormDrawer>
  );
}

function ContactSearchField({
  selectedIds,
  onSelect,
}: {
  selectedIds: string[];
  onSelect: (hit: SearchHit) => void;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function handleSearch(value: string) {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (value.trim().length < 2) {
      setResults([]);
      setShowDropdown(false);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await searchContactsAction(value.trim());
        const selected = new Set(selectedIds);
        setResults((res ?? []).filter((r) => !selected.has(r.id)));
        setShowDropdown(true);
      } finally {
        setSearching(false);
      }
    }, 300);
  }

  return (
    <div className="relative" ref={containerRef}>
      <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={query}
        onChange={(e) => handleSearch(e.target.value)}
        onFocus={() => results.length > 0 && setShowDropdown(true)}
        placeholder="Search contacts by name or email..."
        className="pl-8"
      />
      {searching && (
        <Loader2 className="absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-muted-foreground" />
      )}
      {showDropdown && results.length > 0 && (
        <ul className="absolute z-20 mt-1 max-h-48 w-full overflow-auto rounded-md border bg-popover py-1 shadow-md">
          {results.map((r) => (
            <li key={r.id}>
              <button
                type="button"
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-accent"
                onClick={() => {
                  onSelect(r);
                  setQuery('');
                  setResults([]);
                  setShowDropdown(false);
                }}
              >
                <span className="font-medium">{r.name}</span>
                {r.email && (
                  <span className="text-muted-foreground">{r.email}</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
