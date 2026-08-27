import type { Quote } from '@/types/api';
import { asString, pick, type Dict } from '@/components/shared/detail';

/**
 * Crunchwork quote number assigned on publish (e.g. 131064).
 * Stored on `quotes.quote_number` from CW `quoteNumber`.
 */
export function quoteInsurerRef(
  quote: Pick<Quote, 'quoteNumber' | 'internalNumber' | 'apiPayload'>,
): string | undefined {
  const payload = (quote.apiPayload ?? {}) as Dict;
  const fromPayload = asString(pick(payload, 'quoteNumber'));
  const fromColumn = quote.quoteNumber?.trim() || undefined;
  const value = fromPayload ?? fromColumn;
  if (!value) return undefined;
  const internal = quote.internalNumber?.trim();
  if (internal && value === internal) return undefined;
  if (/^est-/i.test(value)) return undefined;
  return value;
}
