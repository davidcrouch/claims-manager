/**
 * Defensive extraction helpers shared by all transformers.
 * Pure functions — no IO, no side effects.
 */

export function asString(value: unknown): string | undefined {
  if (value == null) return undefined;
  if (typeof value === 'string' && value.length > 0) return value;
  if (typeof value === 'number') return String(value);
  if (typeof value === 'boolean') return String(value);
  return undefined;
}

export function asBool(value: unknown): boolean | undefined {
  if (value == null) return undefined;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const v = value.trim().toLowerCase();
    if (v === 'true' || v === 'yes' || v === '1') return true;
    if (v === 'false' || v === 'no' || v === '0') return false;
  }
  return undefined;
}

export function asTimestamp(value: unknown): Date | undefined {
  if (value == null || value === '') return undefined;
  const s = typeof value === 'string' ? value : String(value);
  const d = new Date(s);
  return isNaN(d.getTime()) ? undefined : d;
}

export function asDateString(value: unknown): string | undefined {
  if (value == null || value === '') return undefined;
  const s = String(value);
  const match = s.match(/^(\d{4}-\d{2}-\d{2})/);
  return match?.[1];
}

export function asNumericString(value: unknown): string | undefined {
  if (value == null) return undefined;
  if (typeof value === 'number' && Number.isFinite(value)) return value.toString();
  if (typeof value === 'string' && value.trim() !== '' && !Number.isNaN(Number(value))) {
    return value;
  }
  return undefined;
}

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function extractObject(
  source: Record<string, unknown>,
  key: string,
): Record<string, unknown> | undefined {
  const val = source[key];
  return isPlainObject(val) ? val : undefined;
}

export function nameFromLookup(value: unknown): string | undefined {
  if (isPlainObject(value)) return asString(value.name);
  return undefined;
}
