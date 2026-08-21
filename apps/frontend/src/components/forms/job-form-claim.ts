import type { AddressPayload } from '@/types/api';

export type JobFormClaimOption = {
  id: string;
  label: string;
  address?: {
    unitNumber?: string;
    streetNumber?: string;
    streetName?: string;
    suburb?: string;
    state?: string;
    postcode?: string;
    country?: string;
  };
};

function asAddressPart(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value == null) return '';
  return String(value);
}

/** Map a Claim entity into a Create Job claim dropdown option. */
export function toJobFormClaimOption(claim: {
  id: string;
  claimNumber?: string | null;
  externalReference?: string | null;
  address?: AddressPayload | Record<string, unknown> | null;
  addressSuburb?: string | null;
  addressState?: string | null;
  addressPostcode?: string | null;
  addressCountry?: string | null;
}): JobFormClaimOption {
  const addr = (claim.address ?? {}) as Record<string, unknown>;
  return {
    id: claim.id,
    label: claim.claimNumber ?? claim.externalReference ?? claim.id,
    address: {
      unitNumber: asAddressPart(addr.unitNumber),
      streetNumber: asAddressPart(addr.streetNumber),
      streetName: asAddressPart(addr.streetName),
      suburb: asAddressPart(addr.suburb) || claim.addressSuburb || '',
      state: asAddressPart(addr.state) || claim.addressState || '',
      postcode: asAddressPart(addr.postcode) || claim.addressPostcode || '',
      country:
        asAddressPart(addr.country) || claim.addressCountry || 'Australia',
    },
  };
}
