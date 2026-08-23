import { formatAddress } from '../data-mappers/base.mapper';

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function str(value: unknown): string {
  if (value == null) return '';
  const text = String(value).trim();
  return text;
}

export function contactName(value: unknown): string {
  const contact = asRecord(value);
  if (!contact) return '';
  return [str(contact.firstName), str(contact.lastName)].filter(Boolean).join(' ');
}

export function contactPhone(value: unknown): string {
  const contact = asRecord(value);
  if (!contact) return '';
  return str(contact.homePhone) || str(contact.workPhone);
}

export function contactMobile(value: unknown): string {
  const contact = asRecord(value);
  if (!contact) return '';
  return str(contact.mobilePhone);
}

export function contactEmail(value: unknown): string {
  const contact = asRecord(value);
  if (!contact) return '';
  return str(contact.email);
}

export function jobAddressLine1(job: unknown): string {
  const row = asRecord(job);
  if (!row) return '';
  const address = row.address;
  if (typeof address === 'string') return address;
  return formatAddress(address as Parameters<typeof formatAddress>[0], { full: false });
}

export function jobAddressLine2(job: unknown): string {
  const row = asRecord(job);
  if (!row) return '';
  return [str(row.addressSuburb), str(row.addressState), str(row.addressPostcode)]
    .filter(Boolean)
    .join(', ');
}
