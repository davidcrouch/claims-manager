/**
 * Quote party-bucket helpers — CW flat to/for/from keys mapped into JSONB buckets.
 * Shared by QuoteTransformer, outbound patch, and quotes service.
 */
import { asString } from './transform-utils';

export const QUOTE_TO_FIELDS: [string, string][] = [
  ['toName', 'name'],
  ['toCompanyRegistrationNumber', 'companyRegistrationNumber'],
  ['toContactName', 'contactName'],
  ['toClientReference', 'clientReference'],
  ['toPhoneNumber', 'phoneNumber'],
  ['toEmail', 'email'],
  ['toUnitNumber', 'unitNumber'],
  ['toStreetNumber', 'streetNumber'],
  ['toStreetName', 'streetName'],
  ['toSuburb', 'suburb'],
  ['toPostCode', 'postCode'],
  ['toState', 'state'],
  ['toCountry', 'country'],
];

export const QUOTE_FOR_FIELDS: [string, string][] = [
  ['forName', 'name'],
  ['forCompanyRegistrationNumber', 'companyRegistrationNumber'],
  ['forContactName', 'contactName'],
  ['forClientReference', 'clientReference'],
  ['forPhoneNumber', 'phoneNumber'],
  ['forEmail', 'email'],
  ['forUnitNumber', 'unitNumber'],
  ['forStreetNumber', 'streetNumber'],
  ['forStreetName', 'streetName'],
  ['forSuburb', 'suburb'],
  ['forPostCode', 'postCode'],
  ['forState', 'state'],
  ['forCountry', 'country'],
];

export const QUOTE_FROM_FIELDS: [string, string][] = [
  ['fromName', 'name'],
  ['fromCompanyRegistrationNumber', 'companyRegistrationNumber'],
  ['fromContactName', 'contactName'],
  ['fromPhoneNumber', 'phoneNumber'],
  ['fromEmail', 'email'],
  ['fromUnitNumber', 'unitNumber'],
  ['fromStreetNumber', 'streetNumber'],
  ['fromStreetName', 'streetName'],
  ['fromSuburb', 'suburb'],
  ['fromPostCode', 'postCode'],
  ['fromState', 'state'],
  ['fromCountry', 'country'],
];

export function collectPartyBucket(
  payload: Record<string, unknown>,
  mapping: [string, string][],
): Record<string, string> {
  const bucket: Record<string, string> = {};
  for (const [cwKey, jsonbKey] of mapping) {
    const v = asString(payload[cwKey]);
    if (v) bucket[jsonbKey] = v;
  }
  return bucket;
}

export type QuotePartyBuckets = {
  quoteTo: Record<string, string>;
  quoteFor: Record<string, string>;
  quoteFrom: Record<string, string>;
  quoteToEmail?: string;
  quoteToName?: string;
  quoteForName?: string;
};

/** Collect structured party buckets (+ promoted scalars) from a flat CW quote payload. */
export function partyBucketsFromCwPayload(
  payload: Record<string, unknown>,
): QuotePartyBuckets {
  const quoteTo = collectPartyBucket(payload, QUOTE_TO_FIELDS);
  const quoteFor = collectPartyBucket(payload, QUOTE_FOR_FIELDS);
  const quoteFrom = collectPartyBucket(payload, QUOTE_FROM_FIELDS);
  return {
    quoteTo,
    quoteFor,
    quoteFrom,
    quoteToEmail: quoteTo.email,
    quoteToName: quoteTo.name,
    quoteForName: quoteFor.name,
  };
}

/** True when at least one party bucket has a field. */
export function hasAnyPartyData(buckets: QuotePartyBuckets): boolean {
  return (
    Object.keys(buckets.quoteTo).length > 0 ||
    Object.keys(buckets.quoteFor).length > 0 ||
    Object.keys(buckets.quoteFrom).length > 0
  );
}
