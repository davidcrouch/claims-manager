/**
 * Pure helpers for Crunchwork outbound quote / estimate payloads.
 */

export function asNonEmptyString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

/**
 * Human estimate number for CW API body `externalReference` (not the local DB column).
 * Prefer `quoteNumber`, else local `internalNumber`.
 * Never use local `quotes.externalReference` (that stores the CW UUID).
 */
export function resolveCwQuoteExternalReference(quote: {
  quoteNumber?: string | null;
  internalNumber?: string | null;
}): string | undefined {
  return (
    asNonEmptyString(quote.quoteNumber) ?? asNonEmptyString(quote.internalNumber)
  );
}
