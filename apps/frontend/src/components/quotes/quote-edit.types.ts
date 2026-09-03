import type { QuotePartyPayload } from '@/types/api';
import {
  CW_ESTIMATE_QUOTE_TYPES,
  INTERNAL_ESTIMATE_QUOTE_TYPES,
} from '@/lib/job-kind-registry';

/** Crunchwork estimate quote types (fallback when caps unavailable). */
export const QUOTE_TYPES = CW_ESTIMATE_QUOTE_TYPES;

/** Internal estimate types: Quote | Variation. */
export const INTERNAL_QUOTE_TYPES = INTERNAL_ESTIMATE_QUOTE_TYPES;

export type QuoteTypeOption = (typeof QUOTE_TYPES)[number];

export type PartyDraft = Required<{
  [K in keyof QuotePartyPayload]-?: string;
}>;

export type QuoteOverviewDraft = {
  name: string;
  reference: string;
  note: string;
  quoteType: string;
  estimateDate: string;
  expiresInDays: string;
  estimatedStartDate: string;
  estimatedCompletionDate: string;
  reasonForVariation: string;
};

export type QuoteEditPending = {
  name?: string | null;
  reference?: string | null;
  note?: string | null;
  quoteType?: string | null;
  estimateDate?: string | null;
  expiresInDays?: number | null;
  estimatedStartDate?: string | null;
  estimatedCompletionDate?: string | null;
  reasonForVariation?: string | null;
  quoteTo?: QuotePartyPayload;
  quoteFor?: QuotePartyPayload;
  quoteFrom?: QuotePartyPayload;
};

export type QuotePartiesSnapshot = {
  quoteTo: PartyDraft;
  quoteFor: PartyDraft;
  quoteFrom: PartyDraft;
};

export type QuoteFieldsSnapshot = {
  assignedToUserId: string;
  overview: QuoteOverviewDraft;
  parties: QuotePartiesSnapshot;
};

export function applyPendingToOverviewDraft(
  draft: QuoteOverviewDraft,
  saved: QuoteEditPending,
): QuoteOverviewDraft {
  const next = { ...draft };
  if (saved.name !== undefined) next.name = saved.name ?? '';
  if (saved.reference !== undefined) next.reference = saved.reference ?? '';
  if (saved.note !== undefined) next.note = saved.note ?? '';
  if (saved.quoteType !== undefined) next.quoteType = saved.quoteType ?? '';
  if (saved.estimateDate !== undefined) next.estimateDate = saved.estimateDate ?? '';
  if (saved.expiresInDays !== undefined) {
    next.expiresInDays =
      saved.expiresInDays === null ? '' : String(saved.expiresInDays);
  }
  if (saved.estimatedStartDate !== undefined) {
    next.estimatedStartDate = saved.estimatedStartDate ?? '';
  }
  if (saved.estimatedCompletionDate !== undefined) {
    next.estimatedCompletionDate = saved.estimatedCompletionDate ?? '';
  }
  if (saved.reasonForVariation !== undefined) {
    next.reasonForVariation = saved.reasonForVariation ?? '';
  }
  return next;
}

export const EMPTY_PARTY: PartyDraft = {
  name: '',
  companyRegistrationNumber: '',
  contactName: '',
  clientReference: '',
  phoneNumber: '',
  email: '',
  unitNumber: '',
  streetNumber: '',
  streetName: '',
  suburb: '',
  postCode: '',
  state: '',
  country: '',
};

export function partyToDraft(p: QuotePartyPayload): PartyDraft {
  return {
    name: p.name ?? '',
    companyRegistrationNumber: p.companyRegistrationNumber ?? '',
    contactName: p.contactName ?? '',
    clientReference: p.clientReference ?? '',
    phoneNumber: p.phoneNumber ?? '',
    email: p.email ?? '',
    unitNumber: p.unitNumber ?? '',
    streetNumber: p.streetNumber ?? '',
    streetName: p.streetName ?? '',
    suburb: p.suburb ?? '',
    postCode: p.postCode ?? '',
    state: p.state ?? '',
    country: p.country ?? '',
  };
}

export function draftToParty(d: PartyDraft, opts?: { omitClientReference?: boolean }): QuotePartyPayload {
  const out: QuotePartyPayload = {
    name: d.name || undefined,
    companyRegistrationNumber: d.companyRegistrationNumber || undefined,
    contactName: d.contactName || undefined,
    phoneNumber: d.phoneNumber || undefined,
    email: d.email || undefined,
    unitNumber: d.unitNumber || undefined,
    streetNumber: d.streetNumber || undefined,
    streetName: d.streetName || undefined,
    suburb: d.suburb || undefined,
    postCode: d.postCode || undefined,
    state: d.state || undefined,
    country: d.country || undefined,
  };
  if (!opts?.omitClientReference) {
    out.clientReference = d.clientReference || undefined;
  }
  return out;
}

export function toInputDate(val: string | undefined | null): string {
  if (!val) return '';
  const d = new Date(val);
  if (Number.isNaN(d.getTime())) return val.slice(0, 10);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function partiesEqual(a: PartyDraft, b: PartyDraft): boolean {
  return (Object.keys(EMPTY_PARTY) as Array<keyof PartyDraft>).every((k) => a[k] === b[k]);
}
