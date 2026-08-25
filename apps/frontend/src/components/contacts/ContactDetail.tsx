'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Check, Loader2, Mail, User } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { BackButton } from '@/components/layout/BackButton';
import {
  PageHeaderField,
  PageHeaderIcon,
  PageHeaderLayout,
} from '@/components/layout/PageHeaderLayout';
import { SetPageHeader } from '@/components/layout/SetPageHeader';
import { SetHeaderActions } from '@/components/layout/SetHeaderActions';
import { ContactRelatedJobsSection } from '@/components/contacts/ContactRelatedJobsSection';
import { SectionCard, formatDateTime } from '@/components/shared/detail';
import {
  fetchContactTypeLookupsAction,
  updateContactAction,
} from '@/app/(app)/mutations';
import type { Contact, ContactRelatedJob } from '@/types/api';

const AUTOSAVE_DEBOUNCE_MS = 600;

type ContactDraft = {
  firstName: string;
  lastName: string;
  email: string;
  mobilePhone: string;
  homePhone: string;
  workPhone: string;
  notes: string;
  typeLookupIds: string[];
};

type ContactTypeLookup = {
  id: string;
  name?: string;
  externalReference?: string;
};

type SaveState = 'idle' | 'pending' | 'saving' | 'saved' | 'error';

function contactTypeIdsFromContact(contact: Contact): string[] {
  if (contact.typeLookupIds?.length) return contact.typeLookupIds;
  if (contact.typeLookupId) return [contact.typeLookupId];
  return [];
}

function draftFromContact(contact: Contact): ContactDraft {
  return {
    firstName: contact.firstName ?? '',
    lastName: contact.lastName ?? '',
    email: contact.email ?? '',
    mobilePhone: contact.mobilePhone ?? '',
    homePhone: contact.homePhone ?? '',
    workPhone: contact.workPhone ?? '',
    notes: contact.notes ?? '',
    typeLookupIds: contactTypeIdsFromContact(contact),
  };
}

function draftsEqual(a: ContactDraft, b: ContactDraft): boolean {
  return (
    a.firstName === b.firstName &&
    a.lastName === b.lastName &&
    a.email === b.email &&
    a.mobilePhone === b.mobilePhone &&
    a.homePhone === b.homePhone &&
    a.workPhone === b.workPhone &&
    a.notes === b.notes &&
    a.typeLookupIds.length === b.typeLookupIds.length &&
    a.typeLookupIds.every((id, i) => id === b.typeLookupIds[i])
  );
}

function contactDisplayName(contact: Pick<Contact, 'firstName' | 'lastName' | 'email'>): string {
  const parts = [contact.firstName, contact.lastName].filter(Boolean);
  return parts.join(' ').trim() || contact.email?.trim() || 'Contact';
}

function contactTypeLabels(
  contact: Contact,
  lookups: ContactTypeLookup[],
): string[] {
  if (contact.contactTypes?.length) {
    return contact.contactTypes
      .map((t) => t.name ?? t.externalReference ?? '')
      .filter(Boolean);
  }
  const ids = contactTypeIdsFromContact(contact);
  return ids
    .map((id) => {
      const match = lookups.find((t) => t.id === id);
      return match?.name ?? match?.externalReference ?? '';
    })
    .filter(Boolean);
}

function EditableFieldRow({
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <div className="grid grid-cols-[minmax(0,180px)_1fr] gap-2 border-b border-border/40 py-1.5 text-sm last:border-b-0">
      <dt className="pt-2 text-muted-foreground">{label}</dt>
      <dd>
        <Input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="h-9 border-slate-200 bg-white"
        />
      </dd>
    </div>
  );
}

function ReadOnlyFieldRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="grid grid-cols-[minmax(0,180px)_1fr] gap-2 border-b border-border/40 py-1.5 text-sm last:border-b-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-foreground wrap-break-word">{value?.trim() ? value : '—'}</dd>
    </div>
  );
}

function ContactSaveStatus({
  saveState,
  saveError,
}: {
  saveState: SaveState;
  saveError: string | null;
}) {
  if (saveState === 'saving' || saveState === 'pending') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Saving…
      </span>
    );
  }
  if (saveState === 'saved') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-emerald-600">
        <Check className="h-3.5 w-3.5" />
        Saved
      </span>
    );
  }
  if (saveState === 'error' && saveError) {
    return <span className="text-xs text-destructive">{saveError}</span>;
  }
  return null;
}

function ContactPageHeader({
  contact,
  draft,
  relatedJobCount,
  backHref,
  backLabel,
  typeLookups,
  saveState,
  saveError,
}: {
  contact: Contact;
  draft: ContactDraft;
  relatedJobCount: number;
  backHref: string;
  backLabel: string;
  typeLookups: ContactTypeLookup[];
  saveState: SaveState;
  saveError: string | null;
}) {
  const displayContact: Contact = {
    ...contact,
    firstName: draft.firstName,
    lastName: draft.lastName,
    email: draft.email,
    typeLookupIds: draft.typeLookupIds,
  };
  const title = contactDisplayName(displayContact);
  const typeLabels = contactTypeLabels(displayContact, typeLookups);

  return (
    <>
      <SetHeaderActions>
        <ContactSaveStatus saveState={saveState} saveError={saveError} />
      </SetHeaderActions>
      <PageHeaderLayout
        leading={<BackButton href={backHref} label={backLabel} />}
        icon={
          <PageHeaderIcon
            icon={User}
            className="bg-muted"
            iconClassName="text-muted-foreground"
          />
        }
        title={title}
        topRow={
          <>
            {typeLabels.map((label) => (
              <span
                key={label}
                className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-800"
              >
                {label}
              </span>
            ))}
          </>
        }
        bottomRow={
          <>
            {displayContact.email && (
              <div className="flex items-baseline gap-1">
                <span className="text-muted-foreground">Email:</span>
                <a
                  href={`mailto:${displayContact.email}`}
                  className="font-medium text-primary hover:underline"
                >
                  {displayContact.email}
                </a>
              </div>
            )}
            {relatedJobCount > 0 && (
              <PageHeaderField label="Related jobs">{relatedJobCount}</PageHeaderField>
            )}
          </>
        }
      />
    </>
  );
}

export interface ContactDetailClientProps {
  initialContact: Contact;
  relatedJobs: ContactRelatedJob[];
  currentJobId?: string | null;
  backHref: string;
  backLabel: string;
}

export function ContactDetailClient({
  initialContact,
  relatedJobs,
  currentJobId,
  backHref,
  backLabel,
}: ContactDetailClientProps) {
  const router = useRouter();
  const [contact, setContact] = useState(initialContact);
  const [draft, setDraft] = useState(() => draftFromContact(initialContact));
  const [savedBaseline, setSavedBaseline] = useState(() => draftFromContact(initialContact));
  const [typeLookups, setTypeLookups] = useState<ContactTypeLookup[]>([]);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [saveError, setSaveError] = useState<string | null>(null);
  const saveInFlightRef = useRef(false);

  const dirty = !draftsEqual(draft, savedBaseline);

  useEffect(() => {
    if (dirty) return;
    const next = draftFromContact(initialContact);
    setContact(initialContact);
    setDraft(next);
    setSavedBaseline(next);
  }, [initialContact, dirty]);

  useEffect(() => {
    let cancelled = false;
    void fetchContactTypeLookupsAction().then((rows) => {
      if (!cancelled) setTypeLookups(rows);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const persistDraft = useCallback(
    async (nextDraft: ContactDraft) => {
      if (saveInFlightRef.current) return;
      if (nextDraft.typeLookupIds.length === 0) {
        setSaveState('error');
        setSaveError('Select at least one contact type');
        return;
      }

      saveInFlightRef.current = true;
      setSaveState('saving');
      setSaveError(null);

      try {
        const result = await updateContactAction(contact.id, {
          typeLookupIds: nextDraft.typeLookupIds,
          firstName: nextDraft.firstName,
          lastName: nextDraft.lastName || undefined,
          email: nextDraft.email || undefined,
          mobilePhone: nextDraft.mobilePhone || undefined,
          homePhone: nextDraft.homePhone || undefined,
          workPhone: nextDraft.workPhone || undefined,
          notes: nextDraft.notes || undefined,
        });

        if (!result.success || !result.contact) {
          setSaveState('error');
          setSaveError(result.error ?? 'Failed to save contact');
          return;
        }

        const synced = draftFromContact(result.contact);
        setContact(result.contact);
        setDraft(synced);
        setSavedBaseline(synced);
        setSaveState('saved');
        router.refresh();
      } catch (err) {
        setSaveState('error');
        setSaveError(err instanceof Error ? err.message : 'Failed to save contact');
      } finally {
        saveInFlightRef.current = false;
      }
    },
    [contact.id, router],
  );

  useEffect(() => {
    if (draftsEqual(draft, savedBaseline)) return;

    setSaveState('pending');
    const timer = setTimeout(() => {
      void persistDraft(draft);
    }, AUTOSAVE_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [draft, savedBaseline, persistDraft]);

  useEffect(() => {
    if (saveState !== 'saved') return;
    const timer = setTimeout(() => setSaveState('idle'), 2000);
    return () => clearTimeout(timer);
  }, [saveState]);

  const updateField = <K extends keyof ContactDraft>(field: K, value: ContactDraft[K]) => {
    setDraft((prev) => ({ ...prev, [field]: value }));
  };

  const toggleContactType = (typeId: string, checked: boolean) => {
    setDraft((prev) => {
      const next = checked
        ? [...new Set([...prev.typeLookupIds, typeId])]
        : prev.typeLookupIds.filter((id) => id !== typeId);
      return { ...prev, typeLookupIds: next };
    });
  };

  return (
    <>
      <SetPageHeader>
        <ContactPageHeader
          contact={contact}
          draft={draft}
          relatedJobCount={relatedJobs.length}
          backHref={backHref}
          backLabel={backLabel}
          typeLookups={typeLookups}
          saveState={saveState}
          saveError={saveError}
        />
      </SetPageHeader>

      <div className="mx-auto w-full max-w-6xl space-y-4 px-4 py-6 sm:px-6">
        <div className="grid gap-4 lg:grid-cols-2">
          <SectionCard title="Role & identity" icon={<User className="h-4 w-4" />}>
            <div className="space-y-0">
              <div className="grid grid-cols-[minmax(0,180px)_1fr] gap-2 border-b border-border/40 py-1.5 text-sm">
                <dt className="pt-2 text-muted-foreground">Types</dt>
                <dd>
                  <div className="flex flex-wrap gap-x-5 gap-y-2 rounded-lg border border-slate-200 bg-slate-50/60 p-3">
                    {typeLookups.map((t) => {
                      const label = t.name ?? t.externalReference ?? t.id;
                      const checked = draft.typeLookupIds.includes(t.id);
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
                </dd>
              </div>
              <EditableFieldRow
                label="First name"
                value={draft.firstName}
                onChange={(value) => updateField('firstName', value)}
                placeholder="First name"
              />
              <EditableFieldRow
                label="Last name"
                value={draft.lastName}
                onChange={(value) => updateField('lastName', value)}
                placeholder="Last name"
              />
              <ReadOnlyFieldRow label="External ref" value={contact.externalReference} />
            </div>
          </SectionCard>

          <SectionCard title="Contact" icon={<Mail className="h-4 w-4" />}>
            <div className="space-y-0">
              <EditableFieldRow
                label="Email"
                type="email"
                value={draft.email}
                onChange={(value) => updateField('email', value)}
                placeholder="email@example.com"
              />
              <EditableFieldRow
                label="Mobile"
                type="tel"
                value={draft.mobilePhone}
                onChange={(value) => updateField('mobilePhone', value)}
                placeholder="04xx xxx xxx"
              />
              <EditableFieldRow
                label="Home"
                type="tel"
                value={draft.homePhone}
                onChange={(value) => updateField('homePhone', value)}
                placeholder="Home phone"
              />
              <EditableFieldRow
                label="Work"
                type="tel"
                value={draft.workPhone}
                onChange={(value) => updateField('workPhone', value)}
                placeholder="Work phone"
              />
            </div>
          </SectionCard>
        </div>

        <ContactRelatedJobsSection relatedJobs={relatedJobs} currentJobId={currentJobId} />

        <SectionCard title="Notes">
          <div className="grid grid-cols-[minmax(0,180px)_1fr] gap-2 py-1.5 text-sm">
            <dt className="pt-2 text-muted-foreground">Notes</dt>
            <dd>
              <Textarea
                value={draft.notes}
                onChange={(e) => updateField('notes', e.target.value)}
                placeholder="Any additional notes…"
                rows={4}
                className="border-slate-200 bg-white"
              />
            </dd>
          </div>
        </SectionCard>

        {(contact.createdAt || contact.updatedAt) && (
          <SectionCard title="Record">
            <ReadOnlyFieldRow
              label="Created"
              value={contact.createdAt ? formatDateTime(contact.createdAt) : null}
            />
            <ReadOnlyFieldRow
              label="Updated"
              value={contact.updatedAt ? formatDateTime(contact.updatedAt) : null}
            />
          </SectionCard>
        )}

        {currentJobId && (
          <p className="text-sm text-muted-foreground">
            Opened from{' '}
            <Link href={`/jobs/${currentJobId}?tab=parties`} className="text-primary hover:underline">
              job parties
            </Link>
            .
          </p>
        )}
      </div>
    </>
  );
}
