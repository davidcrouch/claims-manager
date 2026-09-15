'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Collapsible } from '@base-ui/react/collapsible';
import { Calendar, ChevronRight, ExternalLink, FileText, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { StatusBadge } from '@/components/ui/status-badge';
import {
  DefRow,
  SectionCard,
  formatAddress,
  formatDateTime,
  formatStreetLine,
  type AddressLike,
} from '@/components/shared/detail';
import { LocationMap } from '@/components/shared/LocationMap';
import { jobDisplayName } from '@/components/shared/job-label';
import { EditText, EditTextarea } from '@/components/jobs/JobEditControls';
import {
  AUTOSAVE_DEBOUNCE_MS,
  MAX_UNDO,
  SAVE_STATUS_CLEAR_MS,
  cloneJson,
  pushUndoEntry,
} from '@/components/shared/detail-autosave';
import { HeaderSaveStatus } from '@/components/shared/HeaderSaveStatus';
import { OrgUserLabel } from '@/components/shared/DetailAssignee';
import {
  AddressAutocompleteInput,
  type AddressSuggestion,
} from '@/components/shared/AddressAutocompleteInput';
import { updateJournalAction } from '@/app/(app)/journals/actions';
import { isJournalLocked } from './journal-lock';
import type { AddressPayload, Job, Journal } from '@/types/api';

const AU_STATES = ['ACT', 'NSW', 'NT', 'QLD', 'SA', 'TAS', 'VIC', 'WA'] as const;

type AddressDraft = {
  unitNumber: string;
  streetNumber: string;
  streetName: string;
  suburb: string;
  state: string;
  postcode: string;
  country: string;
};

export type JournalOverviewDraft = {
  name: string;
  description: string;
  visitDate: string;
  address: AddressDraft;
  latitude: string;
  longitude: string;
};

export type JournalAutosaveChrome = {
  canUndo: boolean;
  undoDisabled: boolean;
  onUndo: () => void;
  draftName: string;
};

export interface JournalOverviewProps {
  journal: Journal;
  entryCount: number;
  job?: Job | null;
  onAutosaveChromeChange?: (chrome: JournalAutosaveChrome) => void;
}

function asText(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function addressDraftFromJournal(journal: Journal): AddressDraft {
  const a = (journal.address ?? {}) as Partial<AddressPayload>;
  return {
    unitNumber: asText(a.unitNumber),
    streetNumber: asText(a.streetNumber),
    streetName: asText(a.streetName),
    suburb: asText(a.suburb) || journal.addressSuburb || '',
    state: asText(a.state) || journal.addressState || '',
    postcode: asText(a.postcode) || journal.addressPostcode || '',
    country: asText(a.country) || journal.addressCountry || 'Australia',
  };
}

function toAddressPayload(form: AddressDraft): AddressPayload {
  return {
    unitNumber: form.unitNumber.trim() || undefined,
    streetNumber: form.streetNumber.trim() || undefined,
    streetName: form.streetName.trim() || undefined,
    suburb: form.suburb.trim() || undefined,
    state: form.state.trim() || undefined,
    postcode: form.postcode.trim() || undefined,
    country: form.country.trim() || undefined,
  };
}

function parseCoord(value: string): number | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : undefined;
}

function draftFromJournal(journal: Journal): JournalOverviewDraft {
  return {
    name: journal.name ?? '',
    description: journal.description ?? '',
    visitDate:
      (typeof journal.metadata?.visitDate === 'string' ? journal.metadata.visitDate : '') ?? '',
    address: addressDraftFromJournal(journal),
    latitude: journal.latitude != null ? String(journal.latitude) : '',
    longitude: journal.longitude != null ? String(journal.longitude) : '',
  };
}

function addressDraftsEqual(a: AddressDraft, b: AddressDraft): boolean {
  return (
    a.unitNumber === b.unitNumber &&
    a.streetNumber === b.streetNumber &&
    a.streetName === b.streetName &&
    a.suburb === b.suburb &&
    a.state === b.state &&
    a.postcode === b.postcode &&
    a.country === b.country
  );
}

function draftsEqual(a: JournalOverviewDraft, b: JournalOverviewDraft): boolean {
  return (
    a.name === b.name &&
    a.description === b.description &&
    a.visitDate === b.visitDate &&
    a.latitude === b.latitude &&
    a.longitude === b.longitude &&
    addressDraftsEqual(a.address, b.address)
  );
}

export function JournalOverview({
  journal,
  entryCount,
  job = null,
  onAutosaveChromeChange,
}: JournalOverviewProps) {
  const router = useRouter();

  const [journalState, setJournalState] = useState(journal);
  const [draft, setDraft] = useState(() => draftFromJournal(journal));
  const [savedBaseline, setSavedBaseline] = useState(() => draftFromJournal(journal));
  const [undoStack, setUndoStack] = useState<JournalOverviewDraft[]>([]);
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [addressSearch, setAddressSearch] = useState('');
  const [addressFieldsOpen, setAddressFieldsOpen] = useState(false);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  const locked = isJournalLocked(journalState.status);

  const skipFieldUndoRef = useRef(false);
  const saveInFlightRef = useRef(false);
  const baselineRef = useRef(savedBaseline);
  baselineRef.current = savedBaseline;

  const dirty = !draftsEqual(draft, savedBaseline);
  const canUndo = dirty || undoStack.length > 0;

  const stateItems = useMemo(
    () => Object.fromEntries(AU_STATES.map((s) => [s, s])) as Record<string, string>,
    [],
  );

  const addressSummary = useMemo(
    () => formatAddress(draft.address as AddressLike, { full: true }) || null,
    [draft.address],
  );
  const streetLine = formatStreetLine(draft.address as AddressLike);
  const addressLine = streetLine || addressSummary;
  const addressQuery = addressSummary?.trim() || null;

  const lat = parseCoord(draft.latitude);
  const lng = parseCoord(draft.longitude);
  const hasCoords = lat != null && lng != null;

  useEffect(() => {
    if (dirty) return;
    setJournalState(journal);
    const next = draftFromJournal(journal);
    setDraft(next);
    setSavedBaseline(next);
  }, [journal, dirty]);

  useEffect(() => {
    setUndoStack([]);
    setSaveError(null);
    setJustSaved(false);
    setAddressSearch('');
    setAddressFieldsOpen(false);
    setLocationError(null);
    setLocating(false);
  }, [journal.id]);

  const updateField = useCallback(
    <K extends keyof JournalOverviewDraft>(field: K, value: JournalOverviewDraft[K]) => {
      if (locked) return;
      setDraft((prev) => (prev[field] === value ? prev : { ...prev, [field]: value }));
    },
    [locked],
  );

  const updateAddressField = useCallback(
    <K extends keyof AddressDraft>(field: K, value: AddressDraft[K]) => {
      if (locked) return;
      setDraft((prev) => {
        if (prev.address[field] === value) return prev;
        return { ...prev, address: { ...prev.address, [field]: value } };
      });
    },
    [locked],
  );

  const applyAddressSuggestion = useCallback(
    (suggestion: AddressSuggestion) => {
      if (locked) return;
      const p = suggestion.parts ?? {};
      setDraft((prev) => ({
        ...prev,
        address: {
          unitNumber: p.unitNumber ?? '',
          streetNumber: p.streetNumber ?? '',
          streetName: p.streetName ?? '',
          suburb: p.suburb ?? '',
          state: p.state ?? '',
          postcode: p.postcode ?? '',
          country: p.country ?? 'Australia',
        },
      }));
      setAddressSearch(suggestion.label);
      setAddressFieldsOpen(false);
    },
    [locked],
  );

  const captureLocation = useCallback(() => {
    if (locked) return;
    if (!navigator.geolocation) {
      setLocationError('Geolocation not supported by this browser');
      return;
    }
    setLocating(true);
    setLocationError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setDraft((prev) => ({
          ...prev,
          latitude: String(pos.coords.latitude),
          longitude: String(pos.coords.longitude),
        }));
        setLocating(false);
      },
      (err) => {
        setLocationError(err.message);
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }, [locked]);

  const persistDraft = useCallback(
    async (nextDraft: JournalOverviewDraft) => {
      if (locked || saveInFlightRef.current) return;
      const name = nextDraft.name.trim();
      if (!name) {
        setSaveError('Name is required');
        return;
      }
      if (draftsEqual(nextDraft, baselineRef.current)) return;

      const undoSnapshot = skipFieldUndoRef.current
        ? null
        : cloneJson(baselineRef.current);
      skipFieldUndoRef.current = false;

      saveInFlightRef.current = true;
      setSaving(true);
      setJustSaved(false);
      setSaveError(null);

      const metadata = { ...(journalState.metadata ?? {}) };
      if (nextDraft.visitDate.trim()) {
        metadata.visitDate = nextDraft.visitDate.trim();
      } else {
        delete metadata.visitDate;
      }

      const address = toAddressPayload(nextDraft.address);
      const latitude = parseCoord(nextDraft.latitude);
      const longitude = parseCoord(nextDraft.longitude);

      try {
        const result = await updateJournalAction(journalState.id, {
          name,
          description: nextDraft.description.trim() || undefined,
          metadata,
          address,
          ...(latitude != null ? { latitude } : {}),
          ...(longitude != null ? { longitude } : {}),
        });
        if (!result.success) {
          setSaveError(result.error ?? 'Failed to save journal');
          return;
        }

        const syncedJournal: Journal =
          result.journal ??
          ({
            ...journalState,
            name,
            description: nextDraft.description.trim() || undefined,
            metadata,
            address,
            addressSuburb: address.suburb ?? null,
            addressState: address.state ?? null,
            addressPostcode: address.postcode ?? null,
            addressCountry: address.country ?? null,
            latitude: latitude != null ? String(latitude) : journalState.latitude,
            longitude: longitude != null ? String(longitude) : journalState.longitude,
            updatedAt: new Date().toISOString(),
          } as Journal);
        const synced = draftFromJournal(syncedJournal);
        setJournalState(syncedJournal);
        setDraft(synced);
        setSavedBaseline(synced);
        if (undoSnapshot) {
          setUndoStack((prev) => pushUndoEntry(prev, undoSnapshot, MAX_UNDO));
        }
        setJustSaved(true);
        router.refresh();
      } catch (err) {
        setSaveError(err instanceof Error ? err.message : 'Failed to save journal');
      } finally {
        saveInFlightRef.current = false;
        setSaving(false);
      }
    },
    [journalState, router, locked],
  );

  useEffect(() => {
    if (locked || !dirty || saving) return;
    const timer = setTimeout(() => {
      void persistDraft(draft);
    }, AUTOSAVE_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [locked, dirty, saving, draft, persistDraft]);

  useEffect(() => {
    if (!justSaved) return;
    const timer = setTimeout(() => setJustSaved(false), SAVE_STATUS_CLEAR_MS);
    return () => clearTimeout(timer);
  }, [justSaved]);

  const handleUndo = useCallback(() => {
    if (locked || saving) return;

    if (dirty) {
      skipFieldUndoRef.current = true;
      setDraft(cloneJson(baselineRef.current));
      setSaveError(null);
      return;
    }

    const entry = undoStack[undoStack.length - 1];
    if (!entry) return;
    setUndoStack((prev) => prev.slice(0, -1));
    skipFieldUndoRef.current = true;
    setDraft(cloneJson(entry));
    setSaveError(null);
  }, [locked, saving, dirty, undoStack]);

  useEffect(() => {
    onAutosaveChromeChange?.({
      canUndo: locked ? false : canUndo,
      undoDisabled: locked || saving,
      onUndo: handleUndo,
      draftName: draft.name.trim() || journalState.name,
    });
  }, [
    onAutosaveChromeChange,
    locked,
    canUndo,
    saving,
    handleUndo,
    draft.name,
    journalState.name,
  ]);

  return (
    <div className="space-y-4">
      {!locked && (
        <HeaderSaveStatus
          saving={saving}
          saveError={saveError}
          justSaved={justSaved}
          dirty={dirty}
        />
      )}
      {locked && (
        <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
          This journal is locked and cannot be edited.
        </div>
      )}
      {saveError && !locked && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {saveError}
        </div>
      )}
      <div className="grid items-start gap-4 md:grid-cols-2">
        <div className="flex flex-col gap-4">
          <SectionCard
            title="Journal Details"
            icon={<FileText className="h-4 w-4 text-muted-foreground" />}
          >
            <DefRow
              label="Name"
              value={
                locked ? (
                  <span className="text-sm">{draft.name || '—'}</span>
                ) : (
                  <EditText
                    value={draft.name}
                    onChange={(value) => updateField('name', value)}
                    disabled={saving}
                  />
                )
              }
            />
            <DefRow
              label="Job"
              value={
                job ? (
                  <Link
                    href={`/jobs/${job.id}`}
                    className="inline-flex items-center gap-1 text-primary hover:underline"
                  >
                    {jobDisplayName(job)}
                    <ExternalLink className="h-3 w-3" />
                  </Link>
                ) : (
                  '—'
                )
              }
            />
            <DefRow label="Status" value={<StatusBadge status={journalState.status} />} />
            <DefRow
              label="Description"
              value={
                locked ? (
                  <span className="whitespace-pre-wrap text-sm">
                    {draft.description || '—'}
                  </span>
                ) : (
                  <EditTextarea
                    value={draft.description}
                    onChange={(value) => updateField('description', value)}
                    disabled={saving}
                    rows={3}
                  />
                )
              }
            />
            <DefRow
              label="Entries"
              value={`${entryCount} ${entryCount === 1 ? 'entry' : 'entries'}`}
            />
            <DefRow
              label="Visit date"
              value={
                locked ? (
                  <span className="text-sm">{draft.visitDate || '—'}</span>
                ) : (
                  <EditText
                    type="date"
                    value={draft.visitDate}
                    onChange={(value) => updateField('visitDate', value)}
                    disabled={saving}
                    className="h-9 w-40 text-sm"
                  />
                )
              }
            />
            <DefRow
              label="Created"
              value={
                <span className="inline-flex items-center gap-1.5" suppressHydrationWarning>
                  <Calendar className="size-3.5 text-muted-foreground" />
                  {formatDateTime(journalState.createdAt)}
                </span>
              }
            />
            <DefRow
              label="Created by"
              value={<OrgUserLabel userId={journalState.createdByUserId} />}
            />
            <DefRow
              label="Updated"
              value={
                <span suppressHydrationWarning>{formatDateTime(journalState.updatedAt)}</span>
              }
            />
            <DefRow
              label="Updated by"
              value={<OrgUserLabel userId={journalState.updatedByUserId} />}
            />
          </SectionCard>
        </div>

        <div className="flex flex-col gap-4">
          <SectionCard
            title="Location"
            icon={<MapPin className="h-4 w-4 text-muted-foreground" />}
          >
            {locked ? (
              <>
                <DefRow label="Address" value={addressLine ?? '—'} />
                <DefRow label="Suburb" value={draft.address.suburb || '—'} />
                <DefRow label="State" value={draft.address.state || '—'} />
                <DefRow label="Postcode" value={draft.address.postcode || '—'} />
                <DefRow label="Country" value={draft.address.country || '—'} />
                {hasCoords && (
                  <DefRow
                    label="Coordinates"
                    value={`${lat!.toFixed(5)}, ${lng!.toFixed(5)}`}
                  />
                )}
              </>
            ) : (
              <div className="space-y-4 px-4 py-3">
                <div className="space-y-2">
                  <Label htmlFor="journal-overview-address-search">Search address</Label>
                  <AddressAutocompleteInput
                    id="journal-overview-address-search"
                    value={addressSearch}
                    onChange={setAddressSearch}
                    onSelect={applyAddressSuggestion}
                    placeholder="Search Australian address to fill fields…"
                    name="journal-overview-address-search"
                    disabled={saving}
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
                    {addressSummary ? 'Edit address manually' : 'Enter address manually'}
                  </Collapsible.Trigger>
                  <Collapsible.Panel className="overflow-hidden transition-all duration-200 data-ending-style:h-0 data-starting-style:h-0">
                    <div className="grid grid-cols-1 gap-x-4 gap-y-3 pt-2 md:grid-cols-6">
                      <div className="space-y-1.5 md:col-span-1">
                        <Label htmlFor="journal-overview-unit">Unit</Label>
                        <Input
                          id="journal-overview-unit"
                          value={draft.address.unitNumber}
                          onChange={(e) =>
                            updateAddressField('unitNumber', e.target.value)
                          }
                          disabled={saving}
                          className="h-8 text-sm"
                        />
                      </div>
                      <div className="space-y-1.5 md:col-span-1">
                        <Label htmlFor="journal-overview-street-no">Street no.</Label>
                        <Input
                          id="journal-overview-street-no"
                          value={draft.address.streetNumber}
                          onChange={(e) =>
                            updateAddressField('streetNumber', e.target.value)
                          }
                          disabled={saving}
                          className="h-8 text-sm"
                        />
                      </div>
                      <div className="space-y-1.5 md:col-span-4">
                        <Label htmlFor="journal-overview-street-name">Street name</Label>
                        <Input
                          id="journal-overview-street-name"
                          value={draft.address.streetName}
                          onChange={(e) =>
                            updateAddressField('streetName', e.target.value)
                          }
                          disabled={saving}
                          className="h-8 text-sm"
                          placeholder="e.g. Smith Street"
                        />
                      </div>
                      <div className="space-y-1.5 md:col-span-2">
                        <Label htmlFor="journal-overview-suburb">Suburb</Label>
                        <Input
                          id="journal-overview-suburb"
                          value={draft.address.suburb}
                          onChange={(e) => updateAddressField('suburb', e.target.value)}
                          disabled={saving}
                          className="h-8 text-sm"
                        />
                      </div>
                      <div className="space-y-1.5 md:col-span-1">
                        <Label htmlFor="journal-overview-state">State</Label>
                        <Select
                          value={draft.address.state || null}
                          onValueChange={(v) => updateAddressField('state', v ?? '')}
                          items={stateItems}
                          disabled={saving}
                        >
                          <SelectTrigger id="journal-overview-state" className="h-8 w-full">
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
                      <div className="space-y-1.5 md:col-span-1">
                        <Label htmlFor="journal-overview-postcode">Postcode</Label>
                        <Input
                          id="journal-overview-postcode"
                          value={draft.address.postcode}
                          onChange={(e) =>
                            updateAddressField('postcode', e.target.value)
                          }
                          disabled={saving}
                          className="h-8 text-sm"
                        />
                      </div>
                      <div className="space-y-1.5 md:col-span-2">
                        <Label htmlFor="journal-overview-country">Country</Label>
                        <Input
                          id="journal-overview-country"
                          value={draft.address.country}
                          onChange={(e) =>
                            updateAddressField('country', e.target.value)
                          }
                          disabled={saving}
                          className="h-8 text-sm"
                        />
                      </div>
                    </div>
                  </Collapsible.Panel>
                </Collapsible.Root>

                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <Label>GPS location</Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="gap-1.5"
                      onClick={captureLocation}
                      disabled={saving || locating}
                    >
                      <MapPin className="size-3.5" />
                      {locating
                        ? 'Locating…'
                        : hasCoords
                          ? 'Update location'
                          : 'Use current location'}
                    </Button>
                  </div>
                  {hasCoords ? (
                    <p className="rounded-md border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                      {lat!.toFixed(5)}, {lng!.toFixed(5)}
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
            )}
          </SectionCard>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                Location map
              </CardTitle>
            </CardHeader>
            <CardContent>
              {hasCoords || addressQuery ? (
                <LocationMap
                  title="Journal location map"
                  latitude={hasCoords ? lat : undefined}
                  longitude={hasCoords ? lng : undefined}
                  address={addressQuery}
                  mapClassName="h-64 w-full border-0"
                />
              ) : (
                <div className="flex h-40 items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground">
                  No map location available
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
