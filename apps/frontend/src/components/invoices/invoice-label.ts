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

export function invoiceStatusName(
  invoice: Pick<Invoice, 'status' | 'sourceExternalReference'>,
): string {
  const name = invoice.status?.name?.trim();
  if (name) return name;
  return invoice.sourceExternalReference ? 'Unknown' : 'Draft';
}

export function invoiceHasPositiveAmount(
  invoice: Pick<Invoice, 'totalAmount'>,
): boolean {
  const amount = Number(invoice.totalAmount ?? 0);
  return Number.isFinite(amount) && amount > 0;
}

export function invoiceAmountReceived(
  invoice: Pick<Invoice, 'amountReceived'>,
): number {
  const amount = Number(invoice.amountReceived ?? 0);
  return Number.isFinite(amount) ? Math.round(amount * 100) / 100 : 0;
}

export function invoiceRemainingAmount(
  invoice: Pick<Invoice, 'totalAmount' | 'amountReceived'>,
): number {
  const total = Number(invoice.totalAmount ?? 0);
  const remaining =
    (Number.isFinite(total) ? total : 0) - invoiceAmountReceived(invoice);
  return Math.max(0, Math.round(remaining * 100) / 100);
}

export function invoiceIsPaid(
  invoice: Pick<Invoice, 'status' | 'sourceExternalReference'>,
): boolean {
  return invoiceStatusName(invoice) === 'Paid';
}

export function invoiceIsPartiallyPaid(
  invoice: Pick<Invoice, 'status' | 'sourceExternalReference'>,
): boolean {
  return invoiceStatusName(invoice) === 'Partially Paid';
}

export function invoiceIsInvoiced(
  invoice: Pick<Invoice, 'status' | 'sourceExternalReference'>,
): boolean {
  const name = invoiceStatusName(invoice);
  return name === 'Invoiced' || name === 'Submitted';
}
