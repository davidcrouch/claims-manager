import type { TemplateData } from '../types/document-types';

export interface DataMapper {
  aggregate(params: { tenantId: string; entityId: string }): Promise<TemplateData>;
}

export function formatCurrency(value: string | number | null | undefined): string {
  const num = typeof value === 'string' ? parseFloat(value) : (value ?? 0);
  if (isNaN(num)) return '$0.00';
  return `$${num.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatDate(
  value: Date | string | null | undefined,
  locale = 'en-AU',
): string {
  if (!value) return '';
  const d = typeof value === 'string' ? new Date(value) : value;
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString(locale, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export function formatQuantity(value: string | number | null | undefined): string {
  const num = typeof value === 'string' ? parseFloat(value) : (value ?? 0);
  if (isNaN(num)) return '0';
  return num % 1 === 0 ? num.toString() : num.toFixed(2);
}

/** Tenant-issued internal record number (e.g. RFQ-200015), blank when unset. */
export function internalNumberField(value: string | null | undefined): string {
  return typeof value === 'string' ? value.trim() : '';
}

/** Prefer internal number for display fields; fall back to external/provider number. */
export function displayRecordNumber(
  internalNumber: string | null | undefined,
  externalNumber: string | null | undefined,
): string {
  return internalNumberField(internalNumber) || internalNumberField(externalNumber);
}

type AddressLike = {
  unitNumber?: unknown;
  unit_number?: unknown;
  streetNumber?: unknown;
  street_number?: unknown;
  streetName?: unknown;
  street_name?: unknown;
  suburb?: unknown;
  state?: unknown;
  postcode?: unknown;
  postCode?: unknown;
  country?: unknown;
} | null | undefined;

function addrStr(v: unknown): string | undefined {
  if (typeof v !== 'string') return undefined;
  const t = v.trim();
  return t || undefined;
}

/**
 * Australian-style display: `12/124 Walker St, North Sydney`
 * Pass `full: true` to include state / postcode / country.
 */
export function formatAddress(
  address: AddressLike,
  options: { full?: boolean } = {},
): string {
  if (!address) return '';
  const { full = false } = options;
  const unit = addrStr(address.unitNumber ?? address.unit_number);
  let streetNumber = addrStr(address.streetNumber ?? address.street_number);
  let streetName = addrStr(address.streetName ?? address.street_name);

  if (streetNumber && streetName) {
    const numLower = streetNumber.toLowerCase();
    const nameLower = streetName.toLowerCase();
    if (
      numLower === nameLower ||
      numLower.endsWith(` ${nameLower}`) ||
      numLower.endsWith(nameLower)
    ) {
      streetName = undefined;
    }
  }

  const premise =
    unit && streetNumber ? `${unit}/${streetNumber}` : unit || streetNumber || '';
  const street =
    premise && streetName
      ? `${premise} ${streetName}`
      : premise || streetName || '';

  const suburb = addrStr(address.suburb);
  const state = addrStr(address.state);
  const postcode = addrStr(address.postcode ?? address.postCode);
  const country = addrStr(address.country);

  const parts: string[] = [];
  if (street) parts.push(street);
  if (suburb) parts.push(suburb);
  if (full) {
    if (state) parts.push(state);
    if (postcode) parts.push(postcode);
    if (country) parts.push(country);
  }
  return parts.join(', ');
}
