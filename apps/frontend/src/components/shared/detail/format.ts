/**
 * Shared formatting helpers for detail pages (Claims, Jobs, etc.).
 * Keep these pure and framework-agnostic.
 */

export type Dict = Record<string, unknown>;

export function pick(obj: Dict | undefined, ...keys: string[]): unknown {
  if (!obj) return undefined;
  for (const k of keys) {
    const v = obj[k];
    if (v !== undefined && v !== null && v !== '') return v;
  }
  return undefined;
}

export function asString(v: unknown): string | undefined {
  if (v == null) return undefined;
  if (typeof v === 'string') return v || undefined;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  return undefined;
}

export function asBool(v: unknown): boolean | undefined {
  if (v == null) return undefined;
  if (typeof v === 'boolean') return v;
  if (v === 'true') return true;
  if (v === 'false') return false;
  return undefined;
}

export function formatDate(value?: string | null): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-AU', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function formatDateTime(value?: string | null): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-AU', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });
}

export function formatCurrency(value: unknown): string {
  if (value == null || value === '') return '—';
  const n = typeof value === 'number' ? value : Number(value);
  if (Number.isNaN(n)) return String(value);
  try {
    const formatted = new Intl.NumberFormat(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(n);
    return n < 0 ? `-$${formatted.replace('-', '')}` : `$${formatted}`;
  } catch {
    return `$${n.toFixed(2)}`;
  }
}

export function formatBytes(bytes?: number | string | null): string {
  if (bytes == null || bytes === '') return '—';
  const n = typeof bytes === 'number' ? bytes : Number(bytes);
  if (!Number.isFinite(n) || n < 0) return '—';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let value = n;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  return `${value.toFixed(value >= 10 || unit === 0 ? 0 : 1)} ${units[unit]}`;
}

export type AddressLike = {
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

export type FormatAddressOptions = {
  /** Include state / postcode / country. Default false (short AU display). */
  full?: boolean;
  /** Fallback suburb/state/postcode/country when address object is empty. */
  fallback?: {
    suburb?: string | null;
    state?: string | null;
    postcode?: string | null;
    country?: string | null;
  };
};

function addrStr(v: unknown): string | undefined {
  if (typeof v !== 'string') return undefined;
  const t = v.trim();
  return t || undefined;
}

/**
 * Australian-style street line: `12/124 Walker St`
 * - unit + street number joined with `/`
 * - street name appended with a space
 * - avoids duplicating street name when streetNumber already includes it
 */
export function formatStreetLine(address: AddressLike): string {
  if (!address) return '';
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

  if (premise && streetName) return `${premise} ${streetName}`;
  return premise || streetName || '';
}

/**
 * Format an address for display.
 * Short (default): `12/124 Walker St, North Sydney`
 * Full: `12/124 Walker St, North Sydney, NSW, 2060, Australia`
 */
export function formatAddress(
  address: AddressLike,
  options: FormatAddressOptions = {},
): string {
  const { full = false, fallback } = options;
  const street = formatStreetLine(address);
  const suburb =
    addrStr(address?.suburb) ?? addrStr(fallback?.suburb ?? undefined);
  const state =
    addrStr(address?.state) ?? addrStr(fallback?.state ?? undefined);
  const postcode =
    addrStr(address?.postcode ?? address?.postCode) ??
    addrStr(fallback?.postcode ?? undefined);
  const country =
    addrStr(address?.country) ?? addrStr(fallback?.country ?? undefined);

  const parts: string[] = [];
  if (street) parts.push(street);
  if (suburb) parts.push(suburb);
  if (full) {
    if (state) parts.push(state);
    if (postcode) parts.push(postcode);
    if (country) parts.push(country);
  }

  if (parts.length) return parts.join(', ');

  // No structured street — fall back to whatever locality we have.
  return [
    suburb,
    full ? state : undefined,
    full ? postcode : undefined,
    full ? country : undefined,
  ]
    .filter(Boolean)
    .join(', ');
}
