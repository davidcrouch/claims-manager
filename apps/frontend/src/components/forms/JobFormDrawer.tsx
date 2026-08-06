'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { standardSchemaResolver } from '@hookform/resolvers/standard-schema';
import { z } from 'zod';
import { Briefcase, ChevronRight } from 'lucide-react';
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
import { ContactFormDrawer } from '@/components/contacts/ContactFormDrawer';
import {
  JobContactsPicker,
  contactFromCreated,
  type JobContactRef,
} from '@/components/forms/JobContactsPicker';
import { createJobAction } from '@/app/(app)/jobs/mutations';
import type { Contact, Job } from '@/types/api';

type WizardStep = 'details' | 'contacts';

const STEPS: WizardStep[] = ['details', 'contacts'];
const STEP_LABELS: Record<WizardStep, string> = {
  details: 'Job Details',
  contacts: 'Contacts',
};

type JobProvider = 'internal' | 'crunchwork';

const JOB_PROVIDERS: { value: JobProvider; label: string; apiCode: string }[] = [
  { value: 'internal', label: 'Internal', apiCode: 'direct' },
  { value: 'crunchwork', label: 'Crunchwork', apiCode: 'crunchwork' },
];

const detailsSchema = z.object({
  provider: z.enum(['internal', 'crunchwork']),
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

const AU_STATES = ['ACT', 'NSW', 'NT', 'QLD', 'SA', 'TAS', 'VIC', 'WA'] as const;

export interface JobFormDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jobTypes: { id: string; name?: string; providerCode?: string | null }[];
  /** Called after a job is created so the parent list can refetch. */
  onSuccess?: (job: Job) => void;
}

export function JobFormDrawer({
  open,
  onOpenChange,
  jobTypes,
  onSuccess,
}: JobFormDrawerProps) {
  const router = useRouter();
  const [step, setStep] = useState<WizardStep>('details');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [contacts, setContacts] = useState<JobContactRef[]>([]);
  const [contactDrawerOpen, setContactDrawerOpen] = useState(false);

  const form = useForm<DetailsValues>({
    resolver: standardSchemaResolver(detailsSchema),
    defaultValues: {
      provider: 'internal',
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

  const provider = form.watch('provider');
  const jobTypeId = form.watch('jobTypeId');
  const stateValue = form.watch('state');

  const providerApiCode =
    JOB_PROVIDERS.find((p) => p.value === provider)?.apiCode ?? 'direct';

  const filteredJobTypes = useMemo(
    () =>
      jobTypes.filter(
        (jt) => !jt.providerCode || jt.providerCode === providerApiCode,
      ),
    [jobTypes, providerApiCode],
  );

  const jobTypeItems = useMemo(
    () =>
      Object.fromEntries(
        filteredJobTypes.map((jt) => [jt.id, jt.name ?? jt.id]),
      ) as Record<string, string>,
    [filteredJobTypes],
  );

  const providerItems = useMemo(
    () =>
      Object.fromEntries(JOB_PROVIDERS.map((p) => [p.value, p.label])) as Record<
        string,
        string
      >,
    [],
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
    setContactDrawerOpen(false);
    form.reset();
  }, [form]);

  useEffect(() => {
    if (!open) reset();
  }, [open, reset]);

  function handleOpenChange(next: boolean) {
    // Keep the job wizard open while the nested contact drawer is visible
    // (e.g. Escape would otherwise close both).
    if (!next && contactDrawerOpen) return;
    onOpenChange(next);
    if (!next) reset();
  }

  async function handleNext() {
    const valid = await form.trigger();
    if (!valid) return;
    setError(null);
    setStep('contacts');
  }

  function addContact(contact: JobContactRef) {
    setContacts((prev) => {
      if (contact.contactId && prev.some((c) => c.contactId === contact.contactId)) {
        return prev;
      }
      return [contact, ...prev];
    });
    setError(null);
  }

  function handleContactCreated(contact: Contact) {
    addContact(contactFromCreated(contact));
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
    const apiProvider =
      JOB_PROVIDERS.find((p) => p.value === values.provider)?.apiCode ?? 'direct';
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
        { provider: apiProvider },
      );
      if (result.success) {
        handleOpenChange(false);
        if (result.job) onSuccess?.(result.job);
        // Prefer detail navigation. Do not router.refresh()/replace here —
        // those race with push and can leave the jobs list on stale rows.
        if (result.job?.id) {
          router.push(`/jobs/${result.job.id}`);
        } else {
          router.refresh();
        }
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
    <>
    <BottomFormDrawer
      open={open}
      onOpenChange={handleOpenChange}
      title="Create Job"
      description="Add site details first, then optionally attach contacts."
      icon={<Briefcase className="h-5 w-5" />}
    >
      <div className="border-b border-slate-200 px-12 py-3">
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
            <div className="grid grid-cols-1 gap-x-6 gap-y-5 md:col-span-2 md:grid-cols-3">
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
                    {filteredJobTypes.map((jt) => (
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
                {filteredJobTypes.length === 0 && (
                  <p className="text-sm text-amber-700">
                    No job types found for this provider.
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="provider">Provider</Label>
                <Select
                  value={provider}
                  onValueChange={(v) => {
                    form.setValue('provider', (v as JobProvider) ?? 'internal', {
                      shouldValidate: true,
                    });
                    form.setValue('jobTypeId', '', { shouldValidate: false });
                  }}
                  items={providerItems}
                >
                  <SelectTrigger id="provider" className="w-full">
                    <SelectValue placeholder="Select provider" />
                  </SelectTrigger>
                  <SelectContent>
                    {JOB_PROVIDERS.map((p) => (
                      <SelectItem key={p.value} value={p.value}>
                        {p.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {form.formState.errors.provider && (
                  <p className="text-sm text-destructive">
                    {form.formState.errors.provider.message}
                  </p>
                )}
              </div>
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
          <JobContactsPicker
            contacts={contacts}
            onAdd={addContact}
            onRemove={removeContact}
            onNewContact={() => setContactDrawerOpen(true)}
          />
        )}

        <BottomFormDrawerError error={error} />
      </BottomFormDrawerBody>

      <BottomFormDrawerFooter>
        {step === 'contacts' && (
          <Button
            type="button"
            variant="outline"
            size="lg"
            className="mr-auto"
            onClick={() => {
              setError(null);
              setStep('details');
            }}
          >
            Back
          </Button>
        )}
        <Button
          type="button"
          variant="outline"
          size="lg"
          onClick={() => handleOpenChange(false)}
        >
          Cancel
        </Button>
        {step === 'details' ? (
          <Button type="button" size="lg" onClick={handleNext}>
            Next
            <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        ) : (
          <Button type="button" size="lg" disabled={submitting} onClick={handleSubmit}>
            {submitting ? 'Creating...' : 'Create Job'}
          </Button>
        )}
      </BottomFormDrawerFooter>
    </BottomFormDrawer>

    <ContactFormDrawer
      open={contactDrawerOpen}
      onOpenChange={setContactDrawerOpen}
      onSuccess={handleContactCreated}
    />
    </>
  );
}
