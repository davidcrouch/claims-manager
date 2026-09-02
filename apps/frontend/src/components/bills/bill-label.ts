import type { Bill } from '@/types/api';
import { asString, formatDate, pick, type Dict } from '@/components/shared/detail';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function nonUuidLabel(value?: string | null): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed || UUID_RE.test(trimmed)) return undefined;
  return trimmed;
}

function getPayload(bill: Bill): Dict {
  return (bill.billPayload as Dict | undefined) ?? {};
}

export function billVendorName(bill: Bill): string | undefined {
  const payload = getPayload(bill);
  return (
    asString((payload.vendor as Dict | undefined)?.name) ??
    asString(pick(payload, 'vendorName'))
  );
}

/** Friendly header / list / archive label — never a raw UUID. */
export function billDisplayTitle(bill: Bill): string {
  const number = nonUuidLabel(bill.billNumber);
  if (number) return number;

  const external = nonUuidLabel(bill.externalReference);
  if (external) return external;

  const vendor = billVendorName(bill)?.trim();
  const dateValue = bill.receivedDate ?? bill.issueDate;
  const dateLabel = dateValue ? formatDate(dateValue) : '';
  const hasDate = Boolean(dateLabel && dateLabel !== '—');

  if (vendor && hasDate) return `${vendor} — ${dateLabel}`;
  if (vendor) return vendor;
  if (hasDate) return `Bill · ${dateLabel}`;
  return 'Bill';
}
