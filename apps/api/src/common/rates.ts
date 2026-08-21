/**
 * Commercial rates (tax / percent markup) are stored as decimal fractions:
 *   0.10 = 10%,  0.19 = 19%
 *
 * UI and Crunchwork use percentage points (10 = 10%). Convert at those boundaries.
 */

export const DEFAULT_TAX_RATE = 0.1;
export const DEFAULT_MARKUP_RATE = 0.19;

export function parseRateNumber(value: string | number | null | undefined): number {
  if (value == null || value === '') return 0;
  const n = typeof value === 'number' ? value : parseFloat(value);
  return Number.isFinite(n) ? n : 0;
}

export function isFixedMarkupType(type?: string | null): boolean {
  const t = (type ?? '').toLowerCase();
  return t === 'fixed' || t === 'absolute';
}

export function isPercentMarkupType(type?: string | null): boolean {
  if (!type) return true;
  const t = type.toLowerCase();
  return t === 'percent' || t === 'percentage';
}

/** UI / CW percentage points (10) → stored decimal rate (0.10). */
export function percentPointsToRate(points: number): number {
  if (!Number.isFinite(points) || points === 0) return 0;
  return points / 100;
}

/** Stored decimal rate (0.10) → UI / CW percentage points (10). */
export function rateToPercentPoints(rate: number): number {
  if (!Number.isFinite(rate) || rate === 0) return 0;
  return Math.round(rate * 1e6) / 1e4;
}

/**
 * Coerce an inbound value that may be percentage points (>1) or already a
 * decimal rate (<=1) into a stored decimal rate. Use for tax and percent markup only.
 */
export function coerceToRate(value: string | number | null | undefined): number {
  const n = parseRateNumber(value);
  if (n === 0) return 0;
  if (Math.abs(n) > 1) return n / 100;
  return n;
}

export function formatRate(value: number, scale = 4): string {
  return value.toFixed(scale);
}

export function coerceToRateString(
  value: string | number | null | undefined,
  fallback?: number,
): string {
  const n = value == null || value === '' ? (fallback ?? 0) : coerceToRate(value);
  return formatRate(n);
}
