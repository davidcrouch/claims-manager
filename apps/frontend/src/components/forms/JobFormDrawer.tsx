'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { standardSchemaResolver } from '@hookform/resolvers/standard-schema';
import { z } from 'zod';
import {
  Briefcase,
  Building2,
  Check,
  ChevronRight,
  FileText,
  Loader2,
  Search,
  Send,
  ShieldAlert,
  User,
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
import { ContactFormDrawer } from '@/components/contacts/ContactFormDrawer';
import { ClaimsPickerDrawer } from '@/components/claims/ClaimsPickerDrawer';
import {
  JobContactsPicker,
  contactFromCreated,
  type JobContactRef,
} from '@/components/forms/JobContactsPicker';
import { createJobAction } from '@/app/(app)/jobs/mutations';
import { type OrgUserOption } from '@/components/forms/OrgUserSelect';
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
import { resolveJobKindCapsFromParts } from '@/lib/job-kind-registry';
import {
  toJobFormClaimOption,
  type JobFormClaimOption,
} from '@/components/forms/job-form-claim';
import { cn } from '@/lib/utils';

export type { JobFormClaimOption };
export { toJobFormClaimOption };

type WizardStep = 'jobType' | 'assignee' | 'claim' | 'details' | 'contacts' | 'review';

const STEP_LABELS: Record<WizardStep, string> = {
  jobType: 'Job Type',
  assignee: 'Assigned',
  claim: 'Claim',
  details: 'Job Details',
  contacts: 'Contacts',
  review: 'Review & publish',
};

type JobProvider = 'internal' | 'crunchwork';

const JOB_PROVIDERS: {
  value: JobProvider;
  label: string;
  apiCode: string;
  description: string;
}[] = [
  {
    value: 'internal',
    label: 'Internal',
    apiCode: 'direct',
    description:
      'Create and manage the job in EnsureOS only. Best for internal work that is not published to the insurer.',
  },
  {
    value: 'crunchwork',
    label: 'Builder Make-Safe',
    apiCode: 'crunchwork',
    description:
      'Create a Builder Make-Safe job and publish it to NRMA through Crunchwork. You will choose an assignee and claim next.',
  },
];

const BUILDER_MAKE_SAFE_DISPLAY_NAME = 'Builder Make Safe';
const BUILDER_MAKE_SAFE_TYPE_NAME = 'builder make safe';

const detailsSchema = z.object({
  provider: z.enum(['internal', 'crunchwork']),
  claimId: z.string().optional(),
  name: z.string().min(1, 'Name is required'),
  /** Empty when the provider has no job_type lookups configured. */
  jobTypeId: z.string().optional(),
  filesystemTemplateId: z.string().optional(),
  jobInstructions: z.string().optional(),
  makeSafeRequired: z.boolean().optional(),
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

type ProjectTemplateOption = { id: string; name: string; isDefault?: boolean };
type JobTypeLookup = { id: string; name?: string; providerCode?: string | null };

/** Internal create form: only explicit `direct` job types (never null/CW). */
function internalJobTypes(jobTypes: JobTypeLookup[]): JobTypeLookup[] {
  return jobTypes.filter((jt) => jt.providerCode === 'direct');
}

function isBuilderMakeSafeName(name?: string | null): boolean {
  return (name ?? '').trim().toLowerCase() === BUILDER_MAKE_SAFE_TYPE_NAME;
}

/** Resolve Builder Make Safe lookup for Crunchwork publish. */
function resolveBuilderMakeSafeJobTypeId(jobTypes: JobTypeLookup[]): string {
  const crunchwork = jobTypes.filter((jt) => jt.providerCode === 'crunchwork');
  const unscoped = jobTypes.filter((jt) => !jt.providerCode);
  for (const pool of [crunchwork, unscoped, jobTypes]) {
    const hit = pool.find((jt) => isBuilderMakeSafeName(jt.name));
    if (hit) return hit.id;
  }
  return '';
}

function resolveDefaultJobTypeId(
  jobTypes: JobTypeLookup[],
  providerApiCode: string,
  defaultJobTypeName?: string | null,
): string {
  if (providerApiCode === 'crunchwork') {
    return resolveBuilderMakeSafeJobTypeId(jobTypes);
  }
  const pool = internalJobTypes(jobTypes);
  const needle = defaultJobTypeName?.trim().toLowerCase();
  if (needle) {
    const named = pool.find(
      (jt) => (jt.name ?? '').trim().toLowerCase() === needle,
    );
    if (named) return named.id;
  }
  return pool[0]?.id ?? '';
}

function jobTypeNameById(
  jobTypes: JobTypeLookup[],
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
  const [step, setStep] = useState<WizardStep>('jobType');
  const { phase: submitPhase, busy, startCreating, startOpening, resetPhase } =
    useCreateSubmitPhase();
  const [error, setError] = useState<string | null>(null);
  const [addressSearch, setAddressSearch] = useState('');
  const [assigneeSearch, setAssigneeSearch] = useState('');
  const [contacts, setContacts] = useState<JobContactRef[]>([]);
  const [contactDrawerOpen, setContactDrawerOpen] = useState(false);
  const [projectTemplates, setProjectTemplates] = useState<ProjectTemplateOption[]>(
    [],
  );
  const [orgUsers, setOrgUsers] = useState<OrgUserOption[]>([]);
  const [claimsPickerOpen, setClaimsPickerOpen] = useState(false);
  const [pickedClaimOption, setPickedClaimOption] =
    useState<JobFormClaimOption | null>(null);
  const [pickedClaimPreview, setPickedClaimPreview] = useState<Claim | null>(null);
  /** False until the user picks Internal / Make-Safe (or claim-linked create preselects). */
  const [providerChosen, setProviderChosen] = useState(false);

  const buildDefaults = useCallback((): DetailsValues => {
    // Claim-linked creates are intended for Builder Make-Safe (Crunchwork) publish.
    const provider: JobProvider = initialClaimId ? 'crunchwork' : 'internal';
    const providerApiCode =
      JOB_PROVIDERS.find((p) => p.value === provider)?.apiCode ?? 'direct';
    const claimId = initialClaimId ?? '';
    const selected = claims.find((c) => c.id === claimId);
    const initCaps = resolveJobKindCapsFromParts({
      providerCode: providerApiCode,
      jobTypeName: provider === 'crunchwork' ? BUILDER_MAKE_SAFE_DISPLAY_NAME : defaultJobTypeName,
    });
    const defaultTypeName =
      initCaps.publishTarget !== 'none'
        ? BUILDER_MAKE_SAFE_DISPLAY_NAME
        : defaultJobTypeName;
    const jobTypeId = resolveDefaultJobTypeId(
      jobTypes,
      providerApiCode,
      defaultTypeName,
    );
    return {
      provider,
      claimId,
      name: '',
      jobTypeId,
      filesystemTemplateId: '',
      jobInstructions: '',
      makeSafeRequired: initCaps.create.autoMakeSafe,
      ...addressFromClaimOption(selected),
      assignedToUserId: currentUserId ?? '',
    };
  }, [claims, currentUserId, defaultJobTypeName, initialClaimId, jobTypes]);

  const form = useForm<DetailsValues>({
    resolver: standardSchemaResolver(detailsSchema),
    defaultValues: buildDefaults(),
  });

  function applyProviderDefaults(nextProvider: JobProvider) {
    setProviderChosen(true);
    form.setValue('provider', nextProvider, { shouldValidate: true });
    const nextApiCode =
      JOB_PROVIDERS.find((p) => p.value === nextProvider)?.apiCode ?? 'direct';
    const nextCaps = resolveJobKindCapsFromParts({
      providerCode: nextApiCode,
      jobTypeName: nextProvider === 'crunchwork' ? BUILDER_MAKE_SAFE_DISPLAY_NAME : defaultJobTypeName,
    });
    const defaultTypeName =
      nextCaps.publishTarget !== 'none'
        ? BUILDER_MAKE_SAFE_DISPLAY_NAME
        : defaultJobTypeName;
    const nextJobTypeId = resolveDefaultJobTypeId(
      jobTypes,
      nextApiCode,
      defaultTypeName,
    );
    form.setValue('jobTypeId', nextJobTypeId, { shouldValidate: false });
    form.setValue('makeSafeRequired', nextCaps.create.autoMakeSafe, {
      shouldValidate: false,
    });
    if (!nextCaps.create.requiresClaim) {
      form.setValue('claimId', '', { shouldValidate: false });
      setPickedClaimOption(null);
      setPickedClaimPreview(null);
    }
  }

  const provider = form.watch('provider');
  const claimId = form.watch('claimId');
  const jobTypeId = form.watch('jobTypeId');
  const filesystemTemplateId = form.watch('filesystemTemplateId');
  const assignedToUserId = form.watch('assignedToUserId');
  const stateValue = form.watch('state');

  const createCaps = useMemo(
    () => resolveJobKindCapsFromParts({
      providerCode: JOB_PROVIDERS.find((p) => p.value === provider)?.apiCode ?? 'direct',
      jobTypeName: provider === 'crunchwork' ? BUILDER_MAKE_SAFE_DISPLAY_NAME : undefined,
    }),
    [provider],
  );
  const publishesToNrma = createCaps.publishTarget !== 'none';

  const steps = useMemo((): WizardStep[] => {
    if (createCaps.create.requiresClaim) {
      return ['jobType', 'assignee', 'claim', 'details', 'contacts', 'review'];
    }
    return ['jobType', 'assignee', 'details', 'contacts', 'review'];
  }, [createCaps.create.requiresClaim]);

  const assigneeUsers = useMemo(() => {
    const currentId = currentUserId?.trim() || '';
    const sorted = [...orgUsers].sort((a, b) => {
      if (currentId && a.id === currentId) return -1;
      if (currentId && b.id === currentId) return 1;
      return a.name.localeCompare(b.name);
    });
    const needle = assigneeSearch.trim().toLowerCase();
    if (!needle) return sorted;
    return sorted.filter((u) => {
      const name = u.name.toLowerCase();
      const email = (u.email ?? '').toLowerCase();
      return name.includes(needle) || email.includes(needle);
    });
  }, [orgUsers, currentUserId, assigneeSearch]);

  const providerApiCode =
    JOB_PROVIDERS.find((p) => p.value === provider)?.apiCode ?? 'direct';

  const filteredJobTypes = useMemo(
    () =>
      providerApiCode === 'direct' ? internalJobTypes(jobTypes) : [],
    [jobTypes, providerApiCode],
  );

  const jobTypeItems = useMemo(
    () =>
      Object.fromEntries(
        filteredJobTypes.map((jt) => [jt.id, jt.name ?? jt.id]),
      ) as Record<string, string>,
    [filteredJobTypes],
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
    setStep('jobType');
    setProviderChosen(false);
    setError(null);
    resetPhase();
    setContacts([]);
    setContactDrawerOpen(false);
    setClaimsPickerOpen(false);
    setPickedClaimOption(null);
    setPickedClaimPreview(null);
    setAddressSearch('');
    setAssigneeSearch('');
  }, [resetPhase]);

  // Always start on Job Type when the drawer opens. Do not rely on close-time
  // reset alone — Fast Refresh can preserve a mid-wizard `step` while closed.
  const wasOpenRef = useRef(false);
  useEffect(() => {
    if (!open) {
      wasOpenRef.current = false;
      clearTransientState();
      return;
    }
    if (wasOpenRef.current) return;
    wasOpenRef.current = true;
    setStep('jobType');
    setProviderChosen(Boolean(initialClaimId));
    form.reset(buildDefaults());
    if (claimPreview && initialClaimId && claimPreview.id === initialClaimId) {
      setPickedClaimPreview(claimPreview);
      setPickedClaimOption(toJobFormClaimOption(claimPreview));
    } else if (initialClaimId) {
      const option = claims.find((c) => c.id === initialClaimId);
      setPickedClaimOption(option ?? null);
      setPickedClaimPreview(null);
    } else {
      setPickedClaimOption(null);
      setPickedClaimPreview(null);
    }
  }, [
    open,
    buildDefaults,
    clearTransientState,
    form,
    claimPreview,
    initialClaimId,
    claims,
  ]);

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
    // Keep the job wizard open while nested drawers are visible
    // (e.g. Escape would otherwise close both), and while create/navigation
    // is in progress so the list does not flash underneath.
    if (!next && (contactDrawerOpen || claimsPickerOpen || busy)) return;
    onOpenChange(next);
    if (!next) clearTransientState();
  }

  function applyClaimSelection(claim: Claim) {
    const option = toJobFormClaimOption(claim);
    form.setValue('claimId', option.id, { shouldValidate: false });
    setPickedClaimOption(option);
    setPickedClaimPreview(claim);
    const addr = addressFromClaimOption(option);
    form.setValue('unitNumber', addr.unitNumber);
    form.setValue('streetNumber', addr.streetNumber);
    form.setValue('streetName', addr.streetName);
    form.setValue('suburb', addr.suburb);
    form.setValue('state', addr.state);
    form.setValue('postcode', addr.postcode);
    form.setValue('country', addr.country);
    setAddressSearch('');
    setError(null);
  }

  function applyClaimAddress(nextClaimId: string) {
    const selected =
      pickedClaimOption?.id === nextClaimId
        ? pickedClaimOption
        : claims.find((c) => c.id === nextClaimId);
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

  function handleNextFromJobType() {
    if (!providerChosen) {
      setError('Select Internal or Builder Make-Safe to continue.');
      return;
    }
    setError(null);
    setStep('assignee');
  }

  function handleNextFromAssignee() {
    setError(null);
    if (createCaps.create.requiresClaim) {
      setStep('claim');
      if (!form.getValues('claimId')?.trim()) {
        setClaimsPickerOpen(true);
      }
      return;
    }
    setStep('details');
  }

  function handleNextFromClaim() {
    const values = form.getValues();
    if (!values.claimId?.trim()) {
      setError('Select a claim to continue.');
      setClaimsPickerOpen(true);
      return;
    }
    setError(null);
    setStep('details');
  }

  async function handleNextFromDetails() {
    const valid = await form.trigger(['name', 'provider']);
    if (!valid) return;
    const values = form.getValues();
    if (createCaps.create.requiresClaim && !values.claimId?.trim()) {
      setError(`A claim is required for ${createCaps.providerLabel} jobs.`);
      setStep('claim');
      return;
    }
    if (publishesToNrma && !values.jobTypeId?.trim()) {
      setError(
        `${BUILDER_MAKE_SAFE_DISPLAY_NAME} job type is not configured. Add a Crunchwork job type lookup before creating this job.`,
      );
      return;
    }
    if (
      !publishesToNrma &&
      filteredJobTypes.length > 0 &&
      !values.jobTypeId?.trim()
    ) {
      setError('Job type is required.');
      return;
    }
    if (!publishesToNrma && filteredJobTypes.length === 0) {
      setError(
        'No Internal job types are configured. Add job type lookups before creating an Internal job.',
      );
      return;
    }
    setError(null);
    setStep('contacts');
  }

  function handleBack() {
    setError(null);
    if (step === 'review') setStep('contacts');
    else if (step === 'contacts') setStep('details');
    else if (step === 'details') {
      setStep(createCaps.create.requiresClaim ? 'claim' : 'assignee');
    } else if (step === 'claim') setStep('assignee');
    else if (step === 'assignee') setStep('jobType');
  }

  function handleNextFromContacts() {
    setError(null);
    const values = form.getValues();
    if (createCaps.create.requiresClaim && !values.claimId?.trim()) {
      setError(`A claim is required for ${createCaps.providerLabel} jobs.`);
      setStep('claim');
      return;
    }
    setStep('review');
  }

  function handleClaimPicked(claim: Claim) {
    applyClaimSelection(claim);
    setStep('details');
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

  const selectedJobTypeName = publishesToNrma
    ? BUILDER_MAKE_SAFE_DISPLAY_NAME
    : filteredJobTypes.find((jt) => jt.id === watchedValues.jobTypeId)?.name ??
      jobTypeNameById(jobTypes, watchedValues.jobTypeId ?? '') ??
      watchedValues.jobTypeId;
  const selectedClaimOption =
    pickedClaimOption?.id === watchedValues.claimId
      ? pickedClaimOption
      : claims.find((c) => c.id === watchedValues.claimId);
  const reviewClaim =
    pickedClaimPreview && pickedClaimPreview.id === watchedValues.claimId
      ? pickedClaimPreview
      : claimPreview && claimPreview.id === watchedValues.claimId
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
    const valid = await form.trigger(['name', 'provider']);
    if (!valid) {
      setStep('details');
      return;
    }

    const values = form.getValues();
    const apiProvider =
      JOB_PROVIDERS.find((p) => p.value === values.provider)?.apiCode ?? 'direct';
    if (createCaps.create.requiresClaim && !values.claimId?.trim()) {
      setError(`A claim is required for ${createCaps.providerLabel} jobs.`);
      setStep('claim');
      return;
    }
    if (!values.jobTypeId?.trim()) {
      setError(
        publishesToNrma
          ? `${BUILDER_MAKE_SAFE_DISPLAY_NAME} job type is not configured.`
          : 'No Internal job types are configured.',
      );
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
    const linkedClaimId = createCaps.create.requiresClaim
      ? values.claimId?.trim() || undefined
      : undefined;

    try {
      const result = await createJobAction(
        {
          name: values.name.trim(),
          jobTypeLookupId: values.jobTypeId,
          ...(linkedClaimId ? { claimId: linkedClaimId } : {}),
          jobInstructions: values.jobInstructions?.trim() || undefined,
          makeSafeRequired: createCaps.create.autoMakeSafe,
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

  const stepIndex = steps.indexOf(step);

  return (
    <>
    <BottomFormDrawer
      open={open}
      onOpenChange={handleOpenChange}
      title="Create Job"
      description={
        step === 'jobType'
          ? 'Choose Internal or Builder Make-Safe to continue.'
          : step === 'assignee'
            ? 'Choose who this job is assigned to. You are selected by default.'
            : step === 'claim'
              ? 'Select the claim this Builder Make-Safe job will be published against.'
              : step === 'details'
                ? publishesToNrma
                  ? 'Confirm the Make-Safe details before attaching contacts.'
                  : 'Enter the details for this internal job.'
                : step === 'contacts'
                  ? 'Optionally attach contacts to the job before reviewing.'
                  : publishesToNrma
                    ? 'Review the claim and job summary, then send this Make-Safe job to NRMA.'
                    : 'Review the claim and job summary, then create the job.'
      }
      icon={
        step === 'review' && publishesToNrma ? (
          <Send className="h-5 w-5 text-amber-600" />
        ) : step === 'assignee' ? (
          <User className="h-5 w-5" />
        ) : step === 'jobType' ? (
          <Building2 className="h-5 w-5" />
        ) : step === 'claim' || publishesToNrma ? (
          <ShieldAlert className="h-5 w-5" />
        ) : (
          <Briefcase className="h-5 w-5" />
        )
      }
      preventClose={busy}
    >
      <div className="border-b border-slate-200 px-12 py-3">
        <ol className="flex flex-wrap gap-2 text-xs">
          {steps.map((s, i) => (
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
        {step === 'jobType' && (
          <div className="mx-auto w-full max-w-3xl">
            <p className="mb-3 text-sm font-medium text-foreground">
              Select job type
            </p>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {JOB_PROVIDERS.map((option) => {
                const selected = providerChosen && provider === option.value;
                const Icon =
                  option.value === 'crunchwork' ? ShieldAlert : Building2;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => {
                      applyProviderDefaults(option.value);
                      setError(null);
                    }}
                    className={cn(
                      'relative flex flex-col items-start gap-3 rounded-xl border px-5 py-5 text-left transition-colors',
                      selected
                        ? 'border-blue-600 bg-blue-50 ring-1 ring-blue-600'
                        : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50',
                    )}
                  >
                    {selected && (
                      <span className="absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-white">
                        <Check className="h-3.5 w-3.5" />
                      </span>
                    )}
                    <span
                      className={cn(
                        'flex h-10 w-10 items-center justify-center rounded-lg',
                        selected
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-slate-100 text-slate-600',
                      )}
                    >
                      <Icon className="h-5 w-5" />
                    </span>
                    <span className="space-y-1.5 pr-6">
                      <span className="block text-base font-semibold text-foreground">
                        {option.label}
                      </span>
                      <span className="block text-sm leading-relaxed text-muted-foreground">
                        {option.description}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {step === 'assignee' && (
          <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                aria-hidden
              />
              <Input
                id="job-assignee-search"
                value={assigneeSearch}
                onChange={(e) => setAssigneeSearch(e.target.value)}
                placeholder="Search by name or email…"
                className="pl-9 pr-9"
              />
              {assigneeSearch ? (
                <button
                  type="button"
                  onClick={() => setAssigneeSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  aria-label="Clear search"
                >
                  <X className="h-4 w-4" />
                </button>
              ) : null}
            </div>

            {orgUsers.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Loading users…
              </p>
            ) : assigneeUsers.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No users match &ldquo;{assigneeSearch.trim()}&rdquo;.
              </p>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {assigneeUsers.map((user) => {
                  const selected = assignedToUserId === user.id;
                  const isCurrent = Boolean(
                    currentUserId && user.id === currentUserId,
                  );
                  return (
                    <button
                      key={user.id}
                      type="button"
                      onClick={() => {
                        form.setValue('assignedToUserId', user.id, {
                          shouldValidate: false,
                        });
                        setError(null);
                      }}
                      className={cn(
                        'relative flex items-start gap-3 rounded-xl border px-4 py-4 text-left transition-colors',
                        selected
                          ? 'border-blue-600 bg-blue-50 ring-1 ring-blue-600'
                          : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50',
                      )}
                    >
                      {selected && (
                        <span className="absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-white">
                          <Check className="h-3.5 w-3.5" />
                        </span>
                      )}
                      <span
                        className={cn(
                          'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg',
                          selected
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-slate-100 text-slate-600',
                        )}
                      >
                        <User className="h-5 w-5" />
                      </span>
                      <span className="min-w-0 flex-1 space-y-1 pr-8">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="block text-sm font-semibold text-foreground">
                            {user.name}
                          </span>
                          {isCurrent ? (
                            <span className="rounded-full bg-slate-900 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-white">
                              You
                            </span>
                          ) : null}
                        </span>
                        <span className="block truncate text-sm text-muted-foreground">
                          {user.email?.trim() || 'No email'}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {step === 'claim' && (
          <div className="mx-auto max-w-xl space-y-4">
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-sm font-medium text-foreground">
                Builder Make-Safe requires a claim
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Choose the NRMA claim this job will be published against. The
                list uses the same search and filters as Switch job.
              </p>
            </div>

            {selectedClaimOption ? (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 px-5 py-4">
                <p className="text-xs font-medium uppercase tracking-wide text-emerald-800">
                  Selected claim
                </p>
                <p className="mt-1 text-base font-semibold text-foreground">
                  {selectedClaimOption.label}
                </p>
                {reviewClaim?.insuredName?.trim() ? (
                  <p className="mt-1 text-sm text-muted-foreground">
                    {reviewClaim.insuredName.trim()}
                  </p>
                ) : null}
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setClaimsPickerOpen(true)}
                  >
                    Change claim
                  </Button>
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-slate-300 px-5 py-8 text-center">
                <p className="text-sm text-muted-foreground">
                  No claim selected yet.
                </p>
                <Button
                  type="button"
                  className="mt-4"
                  onClick={() => setClaimsPickerOpen(true)}
                >
                  Select claim
                </Button>
              </div>
            )}
          </div>
        )}

        {step === 'details' && (
          <div className="grid grid-cols-1 gap-x-6 gap-y-5 md:grid-cols-2">
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 md:col-span-2">
              <p className="text-sm font-medium text-foreground">
                {publishesToNrma ? 'Builder Make-Safe job' : 'Internal job'}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {publishesToNrma
                  ? 'Fields below are for a Crunchwork Make-Safe publish to NRMA.'
                  : 'Fields below use Internal (EnsureOS) options only.'}
              </p>
            </div>

            {publishesToNrma && (
              <div className="grid grid-cols-1 gap-x-6 md:col-span-2 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Claim</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      readOnly
                      value={selectedClaimOption?.label ?? '—'}
                      className="bg-slate-50"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setStep('claim');
                        setClaimsPickerOpen(true);
                      }}
                    >
                      Change
                    </Button>
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 gap-x-6 gap-y-5 md:col-span-2 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="job-name">Name</Label>
                <Input
                  id="job-name"
                  {...form.register('name')}
                  placeholder={
                    publishesToNrma
                      ? 'e.g. Kitchen make-safe'
                      : 'e.g. Internal assessment'
                  }
                />
                {form.formState.errors.name && (
                  <p className="text-sm text-destructive">
                    {form.formState.errors.name.message}
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

              {!publishesToNrma && filteredJobTypes.length > 0 && (
                <div className="space-y-2">
                  <Label htmlFor="jobTypeId">Job type</Label>
                  <Select
                    value={jobTypeId || null}
                    onValueChange={(v) => {
                      form.setValue('jobTypeId', v ?? '', {
                        shouldValidate: true,
                      });
                    }}
                    items={jobTypeItems}
                  >
                    <SelectTrigger id="jobTypeId" className="w-full">
                      <SelectValue placeholder="Select internal job type" />
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
                </div>
              )}
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="jobInstructions">Instructions</Label>
              <Textarea
                id="jobInstructions"
                {...form.register('jobInstructions')}
                placeholder={
                  publishesToNrma
                    ? 'Instructions for the insurer job…'
                    : 'Job instructions…'
                }
                rows={3}
              />
            </div>

            {!publishesToNrma && (
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
            )}
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
                  The job stays in EnsureOS and is not sent to NRMA. Go back to
                  Job Type if you need a Builder Make-Safe job instead.
                </p>
              </div>
            )}

            <PublishSummaryCard title="Job summary">
              <PublishSummaryRow
                label="Name"
                value={watchedValues.name.trim() || '—'}
              />
              <PublishSummaryRow
                label="Provider"
                value={publishesToNrma ? 'Builder Make-Safe (Crunchwork)' : 'Internal'}
              />
              <PublishSummaryRow label="Assignee" value={assigneeName} />
              {(!publishesToNrma &&
                (selectedJobTypeName?.trim() || watchedValues.jobTypeId)) ||
              publishesToNrma ? (
                <PublishSummaryRow
                  label="Job type"
                  value={
                    publishesToNrma
                      ? BUILDER_MAKE_SAFE_DISPLAY_NAME
                      : selectedJobTypeName?.trim() || '—'
                  }
                />
              ) : null}
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
              {!publishesToNrma && (
                <PublishSummaryRow
                  label="Site address"
                  value={siteAddress.trim() || '—'}
                />
              )}
              <PublishSummaryRow
                label="Instructions"
                value={watchedValues.jobInstructions?.trim() || '—'}
              />
            </PublishSummaryCard>

            {publishesToNrma && (
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
            )}
          </div>
        )}

        <BottomFormDrawerError error={error} />
      </BottomFormDrawerBody>

      <BottomFormDrawerFooter>
        {step !== 'jobType' && (
          <Button
            type="button"
            variant="outline"
            size="lg"
            className="mr-auto"
            disabled={busy}
            onClick={handleBack}
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
        {step === 'jobType' ? (
          <Button type="button" size="lg" onClick={handleNextFromJobType}>
            Next
            <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        ) : step === 'assignee' ? (
          <Button type="button" size="lg" onClick={handleNextFromAssignee}>
            Next
            <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        ) : step === 'claim' ? (
          <Button type="button" size="lg" onClick={handleNextFromClaim}>
            Next
            <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        ) : step === 'details' ? (
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

    <ClaimsPickerDrawer
      open={claimsPickerOpen}
      onOpenChange={setClaimsPickerOpen}
      selectedClaimId={claimId || undefined}
      onClaimSelect={handleClaimPicked}
      title="Select claim"
      description="Select the claim for this Builder Make-Safe job."
    />

    <ContactFormDrawer
      open={contactDrawerOpen}
      onOpenChange={setContactDrawerOpen}
      onSuccess={handleContactCreated}
    />
    </>
  );
}
