'use client';

import {
  useEffect,
  useState,
  useImperativeHandle,
  forwardRef,
  type Ref,
} from 'react';
import { Building2, Users } from 'lucide-react';
import {
  DefRow,
  SectionCard,
  formatAddress,
  asString,
  type Dict,
} from '@/components/shared/detail';
import { EditText } from '@/components/jobs/JobEditControls';
import type { Quote, QuotePartyPayload } from '@/types/api';
import {
  draftToParty,
  partyToDraft,
  partiesEqual,
  type PartyDraft,
  type QuoteEditPending,
  type QuotePartiesSnapshot,
} from '@/components/quotes/quote-edit.types';

export interface QuotePartiesTabHandle {
  getPendingUpdate: () => QuoteEditPending | null;
  getBaseline: () => QuotePartiesSnapshot;
  applyDraft: (snapshot: QuotePartiesSnapshot) => void;
  reset: () => void;
  markClean: (saved?: QuoteEditPending | null) => void;
  isDirty: () => boolean;
}

function getApi(quote: Quote): Dict {
  return (quote.apiPayload as Dict | undefined) ?? {};
}

function getParty(
  quote: Quote,
  bucket: 'quoteTo' | 'quoteFor' | 'quoteFrom',
): QuotePartyPayload {
  const base = (quote[bucket] as Dict | undefined) ?? {};
  const api = getApi(quote);
  const prefix =
    bucket === 'quoteTo' ? 'to' : bucket === 'quoteFor' ? 'for' : 'from';
  const prefixed = (key: string): unknown =>
    api[`${prefix}${key[0].toUpperCase()}${key.slice(1)}`];
  const fromApi = (k: string): string | undefined => asString(prefixed(k));
  const fromBucket = (k: string): string | undefined => asString(base[k]);
  return {
    name: fromBucket('name') ?? fromApi('name'),
    companyRegistrationNumber:
      fromBucket('companyRegistrationNumber') ??
      fromApi('companyRegistrationNumber'),
    contactName: fromBucket('contactName') ?? fromApi('contactName'),
    clientReference:
      fromBucket('clientReference') ?? fromApi('clientReference'),
    phoneNumber: fromBucket('phoneNumber') ?? fromApi('phoneNumber'),
    email: fromBucket('email') ?? fromApi('email'),
    unitNumber: fromBucket('unitNumber') ?? fromApi('unitNumber'),
    streetNumber: fromBucket('streetNumber') ?? fromApi('streetNumber'),
    streetName: fromBucket('streetName') ?? fromApi('streetName'),
    suburb: fromBucket('suburb') ?? fromApi('suburb'),
    postCode: fromBucket('postCode') ?? fromApi('postCode'),
    state: fromBucket('state') ?? fromApi('state'),
    country: fromBucket('country') ?? fromApi('country'),
  };
}

function formatPartyAddress(p: QuotePartyPayload): string {
  return formatAddress({
    unitNumber: p.unitNumber,
    streetNumber: p.streetNumber,
    streetName: p.streetName,
    suburb: p.suburb,
    state: p.state,
    postCode: p.postCode,
    country: p.country,
  });
}

type PartyFieldKey = keyof PartyDraft;

const PARTY_FIELDS: Array<{ key: PartyFieldKey; label: string }> = [
  { key: 'name', label: 'Name' },
  { key: 'contactName', label: 'Contact' },
  { key: 'email', label: 'Email' },
  { key: 'phoneNumber', label: 'Phone' },
  { key: 'companyRegistrationNumber', label: 'Company reg. #' },
  { key: 'clientReference', label: 'Client reference' },
  { key: 'unitNumber', label: 'Unit number' },
  { key: 'streetNumber', label: 'Street number' },
  { key: 'streetName', label: 'Street name' },
  { key: 'suburb', label: 'Suburb' },
  { key: 'postCode', label: 'Post code' },
  { key: 'state', label: 'State' },
  { key: 'country', label: 'Country' },
];

function PartyCard({
  title,
  party,
  draft,
  editing,
  saving,
  showClientReference,
  icon,
  onChange,
}: {
  title: string;
  party: QuotePartyPayload;
  draft: PartyDraft;
  editing: boolean;
  saving: boolean;
  showClientReference: boolean;
  icon: React.ReactNode;
  onChange: (key: PartyFieldKey, value: string) => void;
}) {
  const address = formatPartyAddress(party);

  if (!editing) {
    return (
      <SectionCard title={title} icon={icon}>
        <DefRow label="Name" value={party.name ?? '—'} />
        <DefRow label="Contact" value={party.contactName ?? '—'} />
        <DefRow label="Email" value={party.email ?? '—'} />
        <DefRow label="Phone" value={party.phoneNumber ?? '—'} />
        <DefRow
          label="Company reg. #"
          value={party.companyRegistrationNumber ?? '—'}
        />
        {showClientReference && (
          <DefRow label="Client reference" value={party.clientReference ?? '—'} />
        )}
        <DefRow label="Address" value={address || '—'} />
      </SectionCard>
    );
  }

  return (
    <SectionCard title={title} icon={icon}>
      {PARTY_FIELDS.filter(
        (f) => showClientReference || f.key !== 'clientReference',
      ).map((f) => (
        <DefRow
          key={f.key}
          label={f.label}
          value={
            <EditText
              value={draft[f.key]}
              onChange={(v) => onChange(f.key, v)}
              disabled={saving}
              type={f.key === 'email' ? 'email' : 'text'}
              className="h-8 w-full max-w-sm text-sm"
            />
          }
        />
      ))}
    </SectionCard>
  );
}

export const QuotePartiesTab = forwardRef(function QuotePartiesTab(
  {
    quote,
    editing = false,
    saving = false,
    onDirtyChange,
  }: {
    quote: Quote;
    editing?: boolean;
    saving?: boolean;
    onDirtyChange?: (dirty: boolean) => void;
  },
  ref: Ref<QuotePartiesTabHandle>,
) {
  const toParty = getParty(quote, 'quoteTo');
  const forParty = getParty(quote, 'quoteFor');
  const fromParty = getParty(quote, 'quoteFrom');

  const [toDraft, setToDraft] = useState(() => partyToDraft(toParty));
  const [forDraft, setForDraft] = useState(() => partyToDraft(forParty));
  const [fromDraft, setFromDraft] = useState(() => partyToDraft(fromParty));
  const [toBase, setToBase] = useState(() => partyToDraft(toParty));
  const [forBase, setForBase] = useState(() => partyToDraft(forParty));
  const [fromBase, setFromBase] = useState(() => partyToDraft(fromParty));

  useEffect(() => {
    const to = partyToDraft(getParty(quote, 'quoteTo'));
    const forP = partyToDraft(getParty(quote, 'quoteFor'));
    const from = partyToDraft(getParty(quote, 'quoteFrom'));
    setToDraft(to);
    setForDraft(forP);
    setFromDraft(from);
    setToBase(to);
    setForBase(forP);
    setFromBase(from);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keep drafts across same-quote refreshes
  }, [quote.id]);

  const isDirty =
    !partiesEqual(toDraft, toBase) ||
    !partiesEqual(forDraft, forBase) ||
    !partiesEqual(fromDraft, fromBase);

  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange, toDraft, forDraft, fromDraft]);

  const buildPending = (): QuoteEditPending | null => {
    if (!isDirty) return null;
    const pending: QuoteEditPending = {};
    if (!partiesEqual(toDraft, toBase)) pending.quoteTo = draftToParty(toDraft);
    if (!partiesEqual(forDraft, forBase)) {
      pending.quoteFor = draftToParty(forDraft);
    }
    if (!partiesEqual(fromDraft, fromBase)) {
      pending.quoteFrom = draftToParty(fromDraft, { omitClientReference: true });
    }
    return pending;
  };

  const reset = () => {
    setToDraft(toBase);
    setForDraft(forBase);
    setFromDraft(fromBase);
  };

  const applyDraft = (snapshot: QuotePartiesSnapshot) => {
    setToDraft(snapshot.quoteTo);
    setForDraft(snapshot.quoteFor);
    setFromDraft(snapshot.quoteFrom);
  };

  const markClean = (saved?: QuoteEditPending | null) => {
    if (saved) {
      if (saved.quoteTo) setToBase(partyToDraft(saved.quoteTo));
      if (saved.quoteFor) setForBase(partyToDraft(saved.quoteFor));
      if (saved.quoteFrom) setFromBase(partyToDraft(saved.quoteFrom));
      return;
    }
    setToBase(toDraft);
    setForBase(forDraft);
    setFromBase(fromDraft);
  };

  useImperativeHandle(
    ref,
    () => ({
      getPendingUpdate: buildPending,
      getBaseline: () => ({
        quoteTo: toBase,
        quoteFor: forBase,
        quoteFrom: fromBase,
      }),
      applyDraft,
      reset,
      markClean,
      isDirty: () => isDirty,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isDirty, toDraft, forDraft, fromDraft, toBase, forBase, fromBase],
  );

  return (
    <div className="grid gap-4 md:grid-cols-3">
      <PartyCard
        title="Estimate From (vendor)"
        party={fromParty}
        draft={fromDraft}
        editing={editing}
        saving={saving}
        showClientReference={false}
        icon={<Building2 className="h-4 w-4 text-muted-foreground" />}
        onChange={(key, value) =>
          setFromDraft((prev) => ({ ...prev, [key]: value }))
        }
      />
      <PartyCard
        title="Estimate For (customer)"
        party={forParty}
        draft={forDraft}
        editing={editing}
        saving={saving}
        showClientReference
        icon={<Users className="h-4 w-4 text-muted-foreground" />}
        onChange={(key, value) =>
          setForDraft((prev) => ({ ...prev, [key]: value }))
        }
      />
      <PartyCard
        title="Estimate To (recipient)"
        party={toParty}
        draft={toDraft}
        editing={editing}
        saving={saving}
        showClientReference
        icon={<Users className="h-4 w-4 text-muted-foreground" />}
        onChange={(key, value) =>
          setToDraft((prev) => ({ ...prev, [key]: value }))
        }
      />
    </div>
  );
});
