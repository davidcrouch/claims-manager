'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { standardSchemaResolver } from '@hookform/resolvers/standard-schema';
import { z } from 'zod';
import { Briefcase, ChevronRight, FileText, Loader2, Send } from 'lucide-react';
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
import {
  OrgUserSelect,
  type OrgUserOption,
} from '@/components/forms/OrgUserSelect';
import { listOrgUsersForSelectAction } from '@/app/(app)/mutations';
import {
  CreateSubmitOverlay,
  navigateToCreated,
  useCreateSubmitPhase,
} from '@/components/forms/CreateSubmitOverlay';
import {
  AddressAutocompleteInput,
  type AddressSuggestion,
} from '@/components/shared/AddressAutocompleteInput';
import { formatAddress, formatDate } from '@/components/shared/detail';
import {
  PublishSummaryCard,
  PublishSummaryRow,
} from '@/components/shared/PublishEntityContext';
import type { Claim, Contact, Job } from '@/types/api';
import {
  toJobFormClaimOption,
  type JobFormClaimOption,
} from '@/components/forms/job-form-claim';

export type { JobFormClaimOption };
export { toJobFormClaimOption };

type WizardStep = 'details' | 'contacts' | 'review';

const STEPS: WizardStep[] = ['details', 'contacts', 'review'];
const STEP_LABELS: Record<WizardStep, string> = {
  details: 'Job Details',
  contacts: 'Contacts',
  review: 'Review & publish',
};

type JobProvider = 'internal' | 'crunchwork';

const JOB_PROVIDERS: { value: JobProvider; label: string; apiCode: string }[] = [
  { value: 'internal', label: 'Internal', apiCode: 'direct' },
  { value: 'crunchwork', label: 'Crunchwork', apiCode: 'crunchwork' },
];

const detailsSchema = z.object({
  provider: z.enum(['internal', 'crunchwork']),
  claimId: z.string().optional(),
  name: z.string().min(1, 'Name is required'),
  jobTypeId: z.string().min(1, 'Job type is required'),
  filesystemTemplateId: z.string().optional(),
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
  assignedToUserId: z.string().optional(),
});

type DetailsValues = z.infer<typeof detailsSchema>;

const AU_STATES = ['ACT', 'NSW', 'NT', 'QLD', 'SA', 'TAS', 'VIC', 'WA'] as const;

const NONE_CLAIM_VALUE = '__none__';

const BUILDER_MAKE_SAFE_TYPE_NAME = 'builder make safe';

type ProjectTemplateOption = { id: string; name: string; isDefault?: boolean };

function isBuilderMakeSafeJobTypeName(name?: string | null): boolean {
  return (name ?? '').trim().toLowerCase() === BUILDER_MAKE_SAFE_TYPE_NAME;
}

function resolveDefaultJobTypeId(
  jobTypes: { id: string; name?: string; providerCode?: string | null }[],
  providerApiCode: string,
  defaultJobTypeName?: string | null,
): string {
  const needle = defaultJobTypeName?.trim().toLowerCase();
  if (!needle) return '';
  return (
    jobTypes.find((jt) => {
      if (jt.providerCode && jt.providerCode !== providerApiCode) return false;
      return (jt.name ?? '').trim().toLowerCase() === needle;
    })?.id ?? ''
  );
}

function jobTypeNameById(
  jobTypes: { id: string; name?: string; providerCode?: string | null }[],
  jobTypeId: string,
): string | undefined {
  return jobTypes.find((jt) => jt.id === jobTypeId)?.name;
}

function addressFromClaimOption(
  claim: JobFormClaimOption | undefined,
): Pick<
  DetailsValues,
  | 'unitNumber'
  | 'streetNumber'
  | 'streetName'
  | 'suburb'
  | 'state'
  | 'postcode'
  | 'country'
> {
  const a = claim?.address;
  return {
    unitNumber: a?.unitNumber ?? '',
    streetNumber: a?.streetNumber ?? '',
    streetName: a?.streetName ?? '',
    suburb: a?.suburb ?? '',
    state: a?.state ?? '',
    postcode: a?.postcode ?? '',
    country: a?.country ?? 'Australia',
  };
}

function normalizeProjectTemplates(payload: unknown): ProjectTemplateOption[] {
  const rows = Array.isArray(payload)
    ? payload
    : payload &&
        typeof payload === 'object' &&
        Array.isArray((payload as { data?: unknown }).data)
      ? (payload as { data: unknown[] }).data
      : [];
  return rows.flatMap((row) => {
    if (!row || typeof row !== 'object') return [];
    const rec = row as Record<string, unknown>;
    const id = typeof rec.id === 'string' ? rec.id : '';
    if (!id) return [];
    const name =
      (typeof rec.name === 'string' && rec.name.trim()) ||
      (typeof rec.displayName === 'string' && rec.displayName.trim()) ||
      '';
    return [
      {
        id,
        name,
        isDefault: rec.isDefault === true,
      },
    ];
  });
}

function projectTemplateLabel(t: ProjectTemplateOption): string {
  const name = t.name.trim();
  if (!name) return t.id;
  return t.isDefault ? `${name} (default)` : name;
}

function preferProjectTemplateId(
  preferred: string | null | undefined,
  templates: ProjectTemplateOption[],
): string {
  if (preferred && templates.some((t) => t.id === preferred)) return preferred;
  return templates.find((t) => t.isDefault)?.id ?? templates[0]?.id ?? '';
}

export interface JobFormDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jobTypes: { id: string; name?: string; providerCode?: string | null }[];
  /** Claims available in the Claim dropdown (optional link). */
  claims?: JobFormClaimOption[];
  /** Pre-select this claim when the drawer opens. */
  claimId?: string | null;
  /** Rich claim record for the review/publish summary (optional). */
  claimPreview?: Claim | null;
  /** Prefill Job Type by lookup name (e.g. "Builder Make Safe"). */
  defaultJobTypeName?: string | null;
  /** Signed-in org user — Assigned defaults to this person. */
  currentUserId?: string | null;
  /** Called after a job is created so the parent list can refetch. */
  onSuccess?: (job: Job) => void;
}

export function JobFormDrawer({
  open,
  onOpenChange,
  jobTypes,
  claims = [],
  claimId: initialClaimId,
  claimPreview,
  defaultJobTypeName,
  currentUserId,
  onSuccess,
}: JobFormDrawerProps) {
  const router = useRouter();
  const [step, setStep] = useState<WizardStep>('details');
  const { phase: submitPhase, busy, startCreating, startOpening, resetPhase } =
    useCreateSubmitPhase();
  const [error, setError] = useState<string | null>(null);
  const [addressSearch, setAddressSearch] = useState('');
  const [contacts, setContacts] = useState<JobContactRef[]>([]);
  const [contactDrawerOpen, setContactDrawerOpen] = useState(false);
  const [projectTemplates, setProjectTemplates] = useState<ProjectTemplateOption[]>(
    [],
  );
  const [orgUsers, setOrgUsers] = useState<OrgUserOption[]>([]);

  const buildDefaults = useCallback((): DetailsValues => {
    // Claim-linked creates are intended for NRMA (Crunchwork) publish.
    const provider: JobProvider = initialClaimId ? 'crunchwork' : 'internal';
    const providerApiCode =
      JOB_PROVIDERS.find((p) => p.value === provider)?.apiCode ?? 'direct';
    const claimId = initialClaimId ?? '';
    const selected = claims.find((c) => c.id === claimId);
    const jobTypeId = resolveDefaultJobTypeId(
      jobTypes,
      providerApiCode,
      defaultJobTypeName,
    );
    const jobTypeName =
      jobTypeNameById(jobTypes, jobTypeId) ?? defaultJobTypeName ?? '';
    return {
      provider,
      claimId,
      name: '',
      jobTypeId,
      filesystemTemplateId: '',
      jobInstructions: '',
      makeSafeRequired: isBuilderMakeSafeJobTypeName(jobTypeName),
      excess: '',
      ...addressFromClaimOption(selected),
      assignedToUserId: currentUserId ?? '',
    };
  }, [claims, currentUserId, defaultJobTypeName, initialClaimId, jobTypes]);

  const form = useForm<DetailsValues>({
    resolver: standardSchemaResolver(detailsSchema),
    defaultValues: buildDefaults(),
  });

  const provider = form.watch('provider');
  const claimId = form.watch('claimId');
  const jobTypeId = form.watch('jobTypeId');
  const filesystemTemplateId = form.watch('filesystemTemplateId');
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

  const claimItems = useMemo(
    () =>
      ({
        [NONE_CLAIM_VALUE]: 'None',
        ...Object.fromEntries(claims.map((c) => [c.id, c.label])),
      }) as Record<string, string>,
    [claims],
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

  const projectTemplateItems = useMemo(
    () =>
      Object.fromEntries(
        projectTemplates.map((t) => [t.id, projectTemplateLabel(t)]),
      ) as Record<string, string>,
    [projectTemplates],
  );

  const clearTransientState = useCallback(() => {
    setStep('details');
    setError(null);
    resetPhase();
    setContacts([]);
    setContactDrawerOpen(false);
    setAddressSearch('');
  }, [resetPhase]);

  useEffect(() => {
    if (!open) {
      clearTransientState();
      return;
    }
    form.reset(buildDefaults());
  }, [open, buildDefaults, clearTransientState, form]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    listOrgUsersForSelectAction().then((rows) => {
      if (!cancelled) setOrgUsers(rows);
    });
    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      try {
        const [templatesRes, defaultsRes] = await Promise.all([
          fetch('/api/filesystem-templates?kind=project'),
          fetch('/api/filesystems/defaults'),
        ]);
        const templatesJson = templatesRes.ok
          ? await templatesRes.json()
          : { data: [] };
        const defaultsJson = defaultsRes.ok ? await defaultsRes.json() : {};
        if (cancelled) return;
        const templates = normalizeProjectTemplates(templatesJson);
        setProjectTemplates(templates);
        const preferred = preferProjectTemplateId(
          defaultsJson.defaultProjectTemplateId as string | undefined,
          templates,
        );
        if (preferred) {
          form.setValue('filesystemTemplateId', preferred);
        }
      } catch {
        // non-blocking — job create falls back to org/platform default
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, form]);

  function handleOpenChange(next: boolean) {
    // Keep the job wizard open while the nested contact drawer is visible
    // (e.g. Escape would otherwise close both), and while create/navigation
    // is in progress so the list does not flash underneath.
    if (!next && (contactDrawerOpen || busy)) return;
    onOpenChange(next);
    if (!next) clearTransientState();
  }

  function applyClaimAddress(nextClaimId: string) {
    const selected = claims.find((c) => c.id === nextClaimId);
    if (!selected?.address) return;
    const addr = addressFromClaimOption(selected);
    form.setValue('unitNumber', addr.unitNumber);
    form.setValue('streetNumber', addr.streetNumber);
    form.setValue('streetName', addr.streetName);
    form.setValue('suburb', addr.suburb);
    form.setValue('state', addr.state);
    form.setValue('postcode', addr.postcode);
    form.setValue('country', addr.country);
    setAddressSearch('');
  }

  async function handleNextFromDetails() {
    const valid = await form.trigger();
    if (!valid) return;
    setError(null);
    setStep('contacts');
  }

  function handleNextFromContacts() {
    setError(null);
    const values = form.getValues();
    if (values.provider === 'crunchwork' && !values.claimId?.trim()) {
      setError('A claim is required when publishing the job to NRMA.');
      setStep('details');
      return;
    }
    setStep('review');
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

  const watchedValues = form.watch();
  const publishesToNrma = watchedValues.provider === 'crunchwork';

  const selectedJobTypeName =
    filteredJobTypes.find((jt) => jt.id === watchedValues.jobTypeId)?.name ??
    watchedValues.jobTypeId;
  const selectedClaimOption = claims.find((c) => c.id === watchedValues.claimId);
  const reviewClaim =
    claimPreview && claimPreview.id === watchedValues.claimId
      ? claimPreview
      : null;
  const assigneeName =
    orgUsers.find((u) => u.id === watchedValues.assignedToUserId)?.name ??
    (watchedValues.assignedToUserId ? watchedValues.assignedToUserId : 'Unassigned');
  const siteAddress = formatAddress(
    {
      unitNumber: watchedValues.unitNumber,
      streetNumber: watchedValues.streetNumber,
      streetName: watchedValues.streetName,
      suburb: watchedValues.suburb,
      state: watchedValues.state,
      postcode: watchedValues.postcode,
      country: watchedValues.country,
    },
    { full: true },
  );
  const folderTemplateName = watchedValues.filesystemTemplateId
    ? projectTemplateLabel(
        projectTemplates.find((t) => t.id === watchedValues.filesystemTemplateId) ?? {
          id: watchedValues.filesystemTemplateId,
          name: watchedValues.filesystemTemplateId,
        },
      )
    : '—';

  async function handleSubmit() {
    const valid = await form.trigger();
    if (!valid) {
      setStep('details');
      return;
    }

    const values = form.getValues();
    const apiProvider =
      JOB_PROVIDERS.find((p) => p.value === values.provider)?.apiCode ?? 'direct';
    if (apiProvider === 'crunchwork' && !values.claimId?.trim()) {
      setError('A claim is required when publishing the job to NRMA.');
      setStep('details');
      return;
    }
    startCreating();
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
    const linkedClaimId = values.claimId?.trim() || undefined;

    try {
      const result = await createJobAction(
        {
          name: values.name.trim(),
          jobTypeLookupId: values.jobTypeId,
          ...(linkedClaimId ? { claimId: linkedClaimId } : {}),
          jobInstructions: values.jobInstructions?.trim() || undefined,
          makeSafeRequired: values.makeSafeRequired ?? false,
          excess: values.excess ? parseFloat(values.excess) : undefined,
          ...(values.filesystemTemplateId
            ? { filesystemTemplateId: values.filesystemTemplateId }
            : {}),
          ...(hasAddress ? { address } : {}),
          ...(values.assignedToUserId
            ? { assignedToUserId: values.assignedToUserId }
            : {}),
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
        if (result.job) onSuccess?.(result.job);
        // Keep the overlay up and the drawer open until the detail page
        // mounts — closing here flashes the stale jobs list.
        if (result.job?.id) {
          startOpening();
          navigateToCreated(router, `/jobs/${result.job.id}`);
          return;
        }
        resetPhase();
        handleOpenChange(false);
        router.refresh();
      } else {
        setError(result.error ?? 'Failed to create job');
        resetPhase();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create job');
      resetPhase();
    }
  }

  const stepIndex = STEPS.indexOf(step);

  return (
    <>
    <BottomFormDrawer
      open={open}
      onOpenChange={handleOpenChange}
      title="Create Job"
      description={
        step === 'review'
          ? publishesToNrma
            ? 'Review the claim and job summary, then send this job to NRMA.'
            : 'Review the claim and job summary, then create the job.'
          : 'Add site details first, then optionally attach contacts, then review before creating.'
      }
      icon={
        step === 'review' && publishesToNrma ? (
          <Send className="h-5 w-5 text-amber-600" />
        ) : (
          <Briefcase className="h-5 w-5" />
        )
      }
      preventClose={busy}
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
                <Label htmlFor="job-claimId">Claim</Label>
                <Select
                  value={claimId ? claimId : NONE_CLAIM_VALUE}
                  onValueChange={(v) => {
                    const next =
                      !v || v === NONE_CLAIM_VALUE ? '' : v;
                    form.setValue('claimId', next, { shouldValidate: false });
                    if (next) applyClaimAddress(next);
                  }}
                  items={claimItems}
                >
                  <SelectTrigger id="job-claimId" className="w-full">
                    <SelectValue placeholder="Select claim (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE_CLAIM_VALUE}>None</SelectItem>
                    {claims.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

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
                  onValueChange={(v) => {
                    const nextId = v ?? '';
                    form.setValue('jobTypeId', nextId, { shouldValidate: true });
                    form.setValue(
                      'makeSafeRequired',
                      isBuilderMakeSafeJobTypeName(
                        jobTypeNameById(jobTypes, nextId),
                      ),
                      { shouldValidate: false },
                    );
                  }}
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

              {projectTemplates.length > 0 && (
                <div className="space-y-2">
                  <Label htmlFor="filesystemTemplateId">Document folders</Label>
                  <Select
                    value={filesystemTemplateId || null}
                    onValueChange={(v) =>
                      form.setValue('filesystemTemplateId', v ?? '', {
                        shouldValidate: true,
                      })
                    }
                    items={projectTemplateItems}
                  >
                    <SelectTrigger id="filesystemTemplateId" className="w-full">
                      <SelectValue placeholder="Project folder template">
                        {(value: string | null) =>
                          value
                            ? (projectTemplateItems[value] ?? value)
                            : 'Project folder template'
                        }
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {projectTemplates.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {projectTemplateLabel(t)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Creates this job&apos;s project document filesystem from the
                    selected template.
                  </p>
                </div>
              )}

              <div className="space-y-2">
                <OrgUserSelect
                  id="job-assignedToUserId"
                  value={form.watch('assignedToUserId') || null}
                  onChange={(userId) =>
                    form.setValue('assignedToUserId', userId ?? '', {
                      shouldValidate: false,
                    })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="provider">Provider</Label>
                <Select
                  value={provider}
                  onValueChange={(v) => {
                    const nextProvider = (v as JobProvider) ?? 'internal';
                    form.setValue('provider', nextProvider, {
                      shouldValidate: true,
                    });
                    const nextApiCode =
                      JOB_PROVIDERS.find((p) => p.value === nextProvider)
                        ?.apiCode ?? 'direct';
                    const nextJobTypeId = resolveDefaultJobTypeId(
                      jobTypes,
                      nextApiCode,
                      defaultJobTypeName,
                    );
                    form.setValue('jobTypeId', nextJobTypeId, {
                      shouldValidate: false,
                    });
                    form.setValue(
                      'makeSafeRequired',
                      isBuilderMakeSafeJobTypeName(
                        jobTypeNameById(jobTypes, nextJobTypeId) ??
                          defaultJobTypeName,
                      ),
                      { shouldValidate: false },
                    );
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
              <div className="mb-4 space-y-2">
                <Label htmlFor="job-address-search">Search address</Label>
                <AddressAutocompleteInput
                  id="job-address-search"
                  value={addressSearch}
                  onChange={setAddressSearch}
                  onSelect={(suggestion: AddressSuggestion) => {
                    const p = suggestion.parts ?? {};
                    form.setValue('unitNumber', p.unitNumber ?? '');
                    form.setValue('streetNumber', p.streetNumber ?? '');
                    form.setValue('streetName', p.streetName ?? '');
                    form.setValue('suburb', p.suburb ?? '');
                    form.setValue('state', p.state ?? '');
                    form.setValue('postcode', p.postcode ?? '');
                    form.setValue('country', p.country ?? 'Australia');
                    setAddressSearch(suggestion.label);
                  }}
                  placeholder="Search Australian address to fill fields…"
                  name="job-address-search"
                />
              </div>
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

        {step === 'review' && (
          <div className="mx-auto max-w-2xl space-y-4">
            {publishesToNrma ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-950">
                <p className="font-medium">This will be pushed to NRMA</p>
                <p className="mt-2 text-amber-900/80">
                  Submitting creates the job in Crunchwork for NRMA against the
                  selected claim. This cannot be undone from this screen.
                </p>
              </div>
            ) : (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-950">
                <p className="font-medium">This job will be created internally</p>
                <p className="mt-2 text-amber-900/80">
                  The job stays in EnsureOS and is not sent to NRMA. Switch the
                  provider to Crunchwork on the previous steps if you need it
                  published externally.
                </p>
              </div>
            )}

            <PublishSummaryCard title="Job summary">
              <PublishSummaryRow
                label="Name"
                value={watchedValues.name.trim() || '—'}
              />
              <PublishSummaryRow
                label="Job type"
                value={selectedJobTypeName?.trim() || '—'}
              />
              <PublishSummaryRow
                label="Provider"
                value={publishesToNrma ? 'Crunchwork (NRMA)' : 'Internal'}
              />
              <PublishSummaryRow label="Assignee" value={assigneeName} />
              <PublishSummaryRow
                label="Make-safe required"
                value={watchedValues.makeSafeRequired ? 'Yes' : 'No'}
              />
              <PublishSummaryRow
                label="Excess"
                value={
                  watchedValues.excess?.trim()
                    ? watchedValues.excess.trim()
                    : '—'
                }
              />
              <PublishSummaryRow
                label="Document folders"
                value={folderTemplateName}
              />
              <PublishSummaryRow
                label="Contacts"
                value={
                  contacts.length === 0
                    ? 'None'
                    : `${contacts.length} contact${contacts.length === 1 ? '' : 's'}`
                }
              />
              <PublishSummaryRow
                label="Site address"
                value={siteAddress.trim() || '—'}
              />
              <PublishSummaryRow
                label="Instructions"
                value={watchedValues.jobInstructions?.trim() || '—'}
              />
            </PublishSummaryCard>

            <PublishSummaryCard title="Claim">
              <PublishSummaryRow
                label="Claim number"
                value={
                  reviewClaim?.claimNumber ??
                  reviewClaim?.externalReference ??
                  selectedClaimOption?.label ??
                  'Not linked'
                }
              />
              <PublishSummaryRow
                label="Insurer reference"
                value={reviewClaim?.externalClaimId?.trim() || '—'}
              />
              <PublishSummaryRow
                label="Status"
                value={reviewClaim?.status?.name?.trim() || '—'}
              />
              <PublishSummaryRow
                label="Policy name"
                value={reviewClaim?.policyName?.trim() || '—'}
              />
              <PublishSummaryRow
                label="Policy number"
                value={reviewClaim?.policyNumber?.trim() || '—'}
              />
              <PublishSummaryRow
                label="Date of loss"
                value={
                  reviewClaim?.dateOfLoss
                    ? formatDate(reviewClaim.dateOfLoss)
                    : '—'
                }
              />
              <PublishSummaryRow
                label="Loss description"
                value={reviewClaim?.incidentDescription?.trim() || '—'}
              />
              <PublishSummaryRow
                label="Risk address"
                value={
                  reviewClaim
                    ? formatAddress(
                        (reviewClaim.address as Record<string, unknown> | undefined) ??
                          {},
                        {
                          full: true,
                          fallback: {
                            suburb: reviewClaim.addressSuburb,
                            state: reviewClaim.addressState,
                            postcode: reviewClaim.addressPostcode,
                            country: reviewClaim.addressCountry,
                          },
                        },
                      ).trim() ||
                      siteAddress.trim() ||
                      '—'
                    : selectedClaimOption?.address
                      ? formatAddress(selectedClaimOption.address, {
                          full: true,
                        }).trim() ||
                        siteAddress.trim() ||
                        '—'
                      : siteAddress.trim() || '—'
                }
              />
            </PublishSummaryCard>
          </div>
        )}

        <BottomFormDrawerError error={error} />
      </BottomFormDrawerBody>

      <BottomFormDrawerFooter>
        {step !== 'details' && (
          <Button
            type="button"
            variant="outline"
            size="lg"
            className="mr-auto"
            disabled={busy}
            onClick={() => {
              setError(null);
              setStep(step === 'review' ? 'contacts' : 'details');
            }}
          >
            Back
          </Button>
        )}
        <Button
          type="button"
          variant="outline"
          size="lg"
          disabled={busy}
          onClick={() => handleOpenChange(false)}
        >
          Cancel
        </Button>
        {step === 'details' ? (
          <Button type="button" size="lg" onClick={() => void handleNextFromDetails()}>
            Next
            <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        ) : step === 'contacts' ? (
          <Button type="button" size="lg" onClick={handleNextFromContacts}>
            Next
            <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        ) : (
          <Button
            type="button"
            size="lg"
            disabled={busy}
            onClick={() => void handleSubmit()}
            className="bg-blue-600 text-white hover:bg-blue-500"
          >
            {busy ? (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            ) : publishesToNrma ? (
              <Send className="mr-1.5 h-4 w-4" />
            ) : (
              <FileText className="mr-1.5 h-4 w-4" />
            )}
            {busy
              ? submitPhase === 'opening'
                ? 'Opening...'
                : publishesToNrma
                  ? 'Sending to NRMA…'
                  : 'Creating...'
              : publishesToNrma
                ? 'Submit to NRMA'
                : 'Create Job'}
          </Button>
        )}
      </BottomFormDrawerFooter>
    </BottomFormDrawer>

    <CreateSubmitOverlay phase={submitPhase} entityLabel="job" />

    <ContactFormDrawer
      open={contactDrawerOpen}
      onOpenChange={setContactDrawerOpen}
      onSuccess={handleContactCreated}
    />
    </>
  );
}
