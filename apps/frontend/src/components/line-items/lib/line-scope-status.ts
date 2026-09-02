import type { ApiLookup } from './types';

export const LINE_SCOPE_STATUS_OPTIONS = [
  { value: 'Draft', label: 'Draft' },
  { value: 'Cash Settled', label: 'Cash Settled' },
] as const;

export const DEFAULT_LINE_SCOPE_STATUS = 'Draft';

const INSURER_LINE_SCOPE_STATUSES = new Set([
  'pending',
  'accepted',
  'rejected',
  'amended',
  'referred',
]);

export function resolveLineScopeStatusValue(status?: ApiLookup): string {
  const ref = (status?.externalReference ?? status?.name ?? '').trim();
  if (ref === 'Cash Settled') return 'Cash Settled';
  if (ref === 'Draft' || !ref) return DEFAULT_LINE_SCOPE_STATUS;
  return ref;
}

export function isVendorEditableLineScopeStatus(status?: ApiLookup): boolean {
  if (!status) return true;
  const ref = (status.externalReference ?? status.name ?? '').trim();
  if (ref === 'Draft' || ref === 'Cash Settled') return true;
  const raw = ref.toLowerCase();
  return !INSURER_LINE_SCOPE_STATUSES.has(raw);
}

export function isInsurerLineScopeStatus(status?: ApiLookup): boolean {
  if (!status) return false;
  const raw = (status.externalReference ?? status.name ?? '').trim().toLowerCase();
  return INSURER_LINE_SCOPE_STATUSES.has(raw);
}
