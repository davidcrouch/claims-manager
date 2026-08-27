import type { Invoice } from '@/types/api';
import { asString, pick, type Dict } from '@/components/shared/detail';

/**
 * Crunchwork's insurer-facing invoice number (e.g. 781).
 * Stored on the CW payload as numeric `invoiceNumber`, distinct from the
 * display title on `invoices.invoice_number` ("… Vendor Tax Invoice #781").
 */
export function invoiceInsurerRef(
  invoice: Pick<Invoice, 'invoicePayload' | 'apiPayload'>,
): string | undefined {
  const payload = (invoice.invoicePayload ?? invoice.apiPayload ?? {}) as Dict;
  return asString(pick(payload, 'invoiceNumber'));
}
