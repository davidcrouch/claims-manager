/**
 * Commercial rates (tax / percent markup) are stored as decimal fractions:
 *   0.10 = 10%,  0.19 = 19%
 *
 * The line-items UI edits percentage points (10 / 19). Convert at the boundary.
 */

export const DEFAULT_TAX_RATE = 0.1;
export const DEFAULT_MARKUP_RATE = 0.19;

export function isFixedMarkupType(type?: string | null): boolean {
  const t = (type ?? '').toLowerCase();
  return t === 'fixed' || t === 'absolute';
}

export function isPercentMarkupType(type?: string | null): boolean {
  if (!type) return true;
  const t = type.toLowerCase();
  return t === 'percent' || t === 'percentage';
}

/** UI percentage points (10) → stored decimal rate (0.10). */
export function percentPointsToRate(points: number): number {
  if (!Number.isFinite(points) || points === 0) return 0;
  return points / 100;
}

/** Stored decimal rate (0.10) → UI percentage points (10). */
export function rateToPercentPoints(rate: number): number {
  if (!Number.isFinite(rate) || rate === 0) return 0;
  return Math.round(rate * 1e6) / 1e4;
}

/**
 * Coerce an inbound value that may be percentage points (>1) or already a
 * decimal rate (<=1) into a stored decimal rate. Use for tax and percent markup.
 */
export function coerceToRate(value: string | number | null | undefined): number {
  const n = typeof value === 'number' ? value : parseFloat(String(value ?? ''));
  if (!Number.isFinite(n) || n === 0) return 0;
  if (Math.abs(n) > 1) return n / 100;
  return n;
}

export function formatRateAsPercentLabel(rate: number): string {
  const pts = rateToPercentPoints(rate);
  if (!pts) return '—';
  return `${Number(pts.toFixed(4))}%`;
}

export function storedMarkupToUi(
  markupType: string | null | undefined,
  stored: number | null | undefined,
  fallback = DEFAULT_MARKUP_RATE,
): number {
  const v = stored ?? fallback;
  if (isFixedMarkupType(markupType)) return v;
  return rateToPercentPoints(coerceToRate(v));
}

export function storedTaxToUi(stored: number | null | undefined): number {
  return rateToPercentPoints(coerceToRate(stored ?? 0));
}

export function uiMarkupToStored(
  markupType: string | null | undefined,
  uiValue: string,
): string {
  const n = parseFloat(uiValue);
  if (!Number.isFinite(n)) return '0';
  if (isFixedMarkupType(markupType)) return String(n);
  return String(percentPointsToRate(n));
}

export function uiTaxToStored(uiValue: string): string {
  const n = parseFloat(uiValue);
  if (!Number.isFinite(n)) return '0';
  return String(percentPointsToRate(n));
}

/** Resolve stored decimal markup rate (or fixed dollars) from edit UI or item. */
export function resolveMarkupAmount(params: {
  markupType?: string | null;
  storedMarkupValue?: number | null;
  editUiValue?: string | null;
  quantity: number;
  extended: number;
}): number {
  const { markupType, quantity, extended } = params;
  if (params.editUiValue != null) {
    const ui = parseFloat(params.editUiValue) || 0;
    if (isFixedMarkupType(markupType)) return ui * quantity;
    return extended * percentPointsToRate(ui);
  }
  const stored = params.storedMarkupValue ?? DEFAULT_MARKUP_RATE;
  if (isFixedMarkupType(markupType)) return stored * quantity;
  return extended * coerceToRate(stored);
}

/** Resolve stored decimal tax rate from edit UI or item. */
export function resolveTaxRate(params: {
  storedTax?: number | null;
  editUiValue?: string | null;
}): number {
  if (params.editUiValue != null) {
    return percentPointsToRate(parseFloat(params.editUiValue) || 0);
  }
  return coerceToRate(params.storedTax ?? 0);
}
