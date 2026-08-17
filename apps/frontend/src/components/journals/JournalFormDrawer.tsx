'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Collapsible } from '@base-ui/react/collapsible';
import { BookOpen, ChevronRight, Loader2, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
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
import { JobSelectField } from '@/components/forms/JobSelectField';
import {
  CreateSubmitOverlay,
  navigateToCreated,
  useCreateSubmitPhase,
} from '@/components/forms/CreateSubmitOverlay';
import type { JobOption } from '@/components/shared/job-label';
import {
  AddressAutocompleteInput,
  type AddressSuggestion,
} from '@/components/shared/AddressAutocompleteInput';
import { formatAddress } from '@/components/shared/detail';
import type { AddressPayload, Journal } from '@/types/api';

const AU_STATES = ['ACT', 'NSW', 'NT', 'QLD', 'SA', 'TAS', 'VIC', 'WA'] as const;

function todayLocalDateInputValue(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export type CreateJournalInput = {
  name: string;
  description?: string;
  address?: AddressPayload;
  latitude?: number;
  longitude?: number;
  metadata?: Record<string, unknown>;
};

export interface JournalFormDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entityType?: string;
  entityId?: string;
  createJournal: (data: CreateJournalInput) => Promise<Journal | null>;
  linkJournal?: (journalId: string) => Promise<boolean>;
  /** Link the new journal to a Job entity (used when a job is selected). */
  linkToJob?: (journalId: string, jobId: string) => Promise<boolean>;
  onCreated?: (journal: Journal) => void;
  jobId?: string | null;
  jobs?: JobOption[];
}

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

function addressFromJob(job: JobOption | undefined): SiteAddressForm {
  if (!job) return { ...EMPTY_ADDRESS };
  const a = job.address ?? {};
  return {
    unitNumber: a.unitNumber ?? '',
    streetNumber: a.streetNumber ?? '',
    streetName: a.streetName ?? '',
    suburb: a.suburb ?? job.addressSuburb ?? '',
    state: a.state ?? job.addressState ?? '',
    postcode: a.postcode ?? job.addressPostcode ?? '',
    country: a.country ?? job.addressCountry ?? 'Australia',
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

export function JournalFormDrawer({
  open,
  onOpenChange,
  entityType,
  entityId,
  createJournal,
  linkJournal,
  linkToJob,
  onCreated,
  jobId,
  jobs = [],
}: JournalFormDrawerProps) {
  const router = useRouter();
  const [selectedJobId, setSelectedJobId] = useState(jobId ?? '');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [visitDate, setVisitDate] = useState(todayLocalDateInputValue);
  const [address, setAddress] = useState<SiteAddressForm>(EMPTY_ADDRESS);
  const [addressSearch, setAddressSearch] = useState('');
  const [addressFieldsOpen, setAddressFieldsOpen] = useState(false);
  const [location, setLocation] = useState<{
    latitude: number;
    longitude: number;
    accuracy?: number;
  } | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  const { phase: submitPhase, busy, startCreating, startOpening, resetPhase } =
    useCreateSubmitPhase();
  const [error, setError] = useState<string | null>(null);

  const jobRequired = jobs.length > 0 || Boolean(jobId);

  const stateItems = useMemo(
    () => Object.fromEntries(AU_STATES.map((s) => [s, s])) as Record<string, string>,
    [],
  );

  const addressSummary = useMemo(
    () => formatAddress(address, { full: true }) || null,
    [address],
  );

  useEffect(() => {
    if (!open) return;
    const initialJobId = jobId ?? '';
    setSelectedJobId(initialJobId);
    const job = jobs.find((j) => j.id === initialJobId);
    setAddress(addressFromJob(job));
    setVisitDate(todayLocalDateInputValue());
  }, [open, jobId, jobs]);

  const handleJobChange = (nextJobId: string) => {
    setSelectedJobId(nextJobId);
    const job = jobs.find((j) => j.id === nextJobId);
    if (job?.address || job?.addressSuburb) {
      setAddress(addressFromJob(job));
    }
  };

  const resetForm = () => {
    setSelectedJobId(jobId ?? '');
    setName('');
    setDescription('');
    setVisitDate(todayLocalDateInputValue());
    setAddress(addressFromJob(jobs.find((j) => j.id === (jobId ?? ''))));
    setAddressSearch('');
    setAddressFieldsOpen(false);
    setLocation(null);
    setLocationError(null);
    setLocating(false);
    setError(null);
    resetPhase();
  };

  const handleOpenChange = (next: boolean) => {
    if (!next && busy) return;
    if (!next) resetForm();
    onOpenChange(next);
  };

  const updateAddressField = <K extends keyof SiteAddressForm>(
    key: K,
    value: SiteAddressForm[K],
  ) => {
    setAddress((prev) => ({ ...prev, [key]: value }));
  };

  const captureLocation = () => {
    if (!navigator.geolocation) {
      setLocationError('Geolocation not supported by this browser');
      return;
    }
    setLocating(true);
    setLocationError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        });
        setLocating(false);
      },
      (err) => {
        setLocationError(err.message);
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  const canSubmit =
    Boolean(name.trim()) &&
    (!jobRequired || Boolean(selectedJobId.trim())) &&
    !busy;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Name is required');
      return;
    }
    if (jobRequired && !selectedJobId.trim()) {
      setError('Job is required');
      return;
    }

    startCreating();
    setError(null);
    try {
      const addressPayload = toAddressPayload(address);
      const metadata: Record<string, unknown> = {};
      if (visitDate.trim()) metadata.visitDate = visitDate.trim();
      if (location?.accuracy != null) metadata.locationAccuracy = location.accuracy;

      const journal = await createJournal({
        name: name.trim(),
        description: description.trim() || undefined,
        address: addressPayload,
        latitude: location?.latitude,
        longitude: location?.longitude,
        metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
      });

      if (!journal) {
        setError('Failed to create journal');
        resetPhase();
        return;
      }

      if (selectedJobId && linkToJob) {
        await linkToJob(journal.id, selectedJobId);
      }

      const alreadyLinkedToSelectedJob =
        entityType === 'Job' && entityId === selectedJobId;
      if (journal && entityType && entityId && linkJournal && !alreadyLinkedToSelectedJob) {
        await linkJournal(journal.id);
      }

      onCreated?.(journal);
      startOpening();
      const linkedJobId =
        selectedJobId.trim() || (entityType === 'Job' ? entityId : undefined);
      const href = linkedJobId
        ? `/journals/${journal.id}?jobId=${linkedJobId}`
        : `/journals/${journal.id}`;
      navigateToCreated(router, href);
    } catch (err) {
      console.error('JournalFormDrawer.handleSubmit:', err);
      setError(err instanceof Error ? err.message : 'Failed to create journal');
      resetPhase();
    }
  };

  return (
    <>
    <BottomFormDrawer
      open={open}
      onOpenChange={handleOpenChange}
      title="Create Journal"
      description={
        entityType
          ? `Create a site-visit journal and link it to this ${entityType.toLowerCase()}.`
          : 'Create a site-visit journal for a job.'
      }
      icon={<BookOpen className="h-5 w-5" />}
      widthClassName="w-[60%]"
      preventClose={busy}
    >
      <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
        <BottomFormDrawerBody>
          <div className="grid grid-cols-1 gap-x-6 gap-y-5 md:grid-cols-2">
            {(jobs.length > 0 || jobId) && (
              <JobSelectField
                jobs={jobs}
                value={selectedJobId}
                onValueChange={handleJobChange}
              />
            )}

            <div className="space-y-2">
              <Label htmlFor="journal-visit-date">Visit date</Label>
              <Input
                id="journal-visit-date"
                type="date"
                value={visitDate}
                onChange={(e) => setVisitDate(e.target.value)}
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="journal-name">
                Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="journal-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Initial site inspection"
                required
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="journal-description">Purpose / notes</Label>
              <Textarea
                id="journal-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Why you're on site, scope of visit, access notes…"
                rows={3}
              />
            </div>

            <div className="md:col-span-2">
              <p className="mb-3 text-sm font-medium text-foreground">Site address</p>
              <div className="mb-3 space-y-2">
                <Label htmlFor="journal-address-search">Search address</Label>
                <AddressAutocompleteInput
                  id="journal-address-search"
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
                  name="journal-address-search"
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
                      <Label htmlFor="journal-unit">Unit</Label>
                      <Input
                        id="journal-unit"
                        value={address.unitNumber}
                        onChange={(e) =>
                          updateAddressField('unitNumber', e.target.value)
                        }
                      />
                    </div>
                    <div className="space-y-2 md:col-span-1">
                      <Label htmlFor="journal-street-no">Street no.</Label>
                      <Input
                        id="journal-street-no"
                        value={address.streetNumber}
                        onChange={(e) =>
                          updateAddressField('streetNumber', e.target.value)
                        }
                      />
                    </div>
                    <div className="space-y-2 md:col-span-4">
                      <Label htmlFor="journal-street-name">Street name</Label>
                      <Input
                        id="journal-street-name"
                        value={address.streetName}
                        onChange={(e) =>
                          updateAddressField('streetName', e.target.value)
                        }
                        placeholder="e.g. Smith Street"
                      />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="journal-suburb">Suburb</Label>
                      <Input
                        id="journal-suburb"
                        value={address.suburb}
                        onChange={(e) =>
                          updateAddressField('suburb', e.target.value)
                        }
                      />
                    </div>
                    <div className="space-y-2 md:col-span-1">
                      <Label htmlFor="journal-state">State</Label>
                      <Select
                        value={address.state || null}
                        onValueChange={(v) =>
                          updateAddressField('state', v ?? '')
                        }
                        items={stateItems}
                      >
                        <SelectTrigger id="journal-state" className="w-full">
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
                      <Label htmlFor="journal-postcode">Postcode</Label>
                      <Input
                        id="journal-postcode"
                        value={address.postcode}
                        onChange={(e) =>
                          updateAddressField('postcode', e.target.value)
                        }
                      />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="journal-country">Country</Label>
                      <Input
                        id="journal-country"
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
              <div className="flex items-center justify-between gap-3">
                <Label>GPS location</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={captureLocation}
                  disabled={locating}
                >
                  <MapPin className="size-3.5" />
                  {locating ? 'Locating…' : location ? 'Update location' : 'Use current location'}
                </Button>
              </div>
              {location ? (
                <p className="rounded-md border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                  {location.latitude.toFixed(5)}, {location.longitude.toFixed(5)}
                  {location.accuracy != null && (
                    <span className="ml-2 text-xs">±{Math.round(location.accuracy)}m</span>
                  )}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Optional — capture GPS when you are at the job site.
                </p>
              )}
              {locationError && (
                <p className="text-sm text-destructive">{locationError}</p>
              )}
            </div>
          </div>

          <BottomFormDrawerError error={error} />
        </BottomFormDrawerBody>

        <BottomFormDrawerFooter>
          <Button
            type="button"
            variant="outline"
            size="lg"
            className="min-w-36 px-8"
            disabled={busy}
            onClick={() => handleOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            size="lg"
            className="min-w-36 px-8"
            disabled={!canSubmit}
          >
            {busy ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {submitPhase === 'opening' ? 'Opening…' : 'Creating…'}
              </>
            ) : (
              'Create Journal'
            )}
          </Button>
        </BottomFormDrawerFooter>
      </form>
    </BottomFormDrawer>

    <CreateSubmitOverlay phase={submitPhase} entityLabel="journal" />
    </>
  );
}
