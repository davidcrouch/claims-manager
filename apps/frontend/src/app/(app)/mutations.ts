'use server';

import { revalidatePath } from 'next/cache';
import { getSession, getAccessToken } from '@/lib/auth';
import { createApiClient, ApiError, type PublishQuoteResult } from '@/lib/api-client';
import type { Quote, Invoice, Report, Task, Contact, WorkOrder, Rfq, Proposal, Bill, PurchaseOrder } from '@/types/api';

async function getApi() {
  const session = await getSession();
  if (!session.authenticated) return null;
  const token = await getAccessToken();
  if (!token) return null;
  return createApiClient({ token });
}

export async function createQuoteAction(body: Record<string, unknown>): Promise<{ success: boolean; quote?: Quote; error?: string }> {
  const api = await getApi();
  if (!api) return { success: false, error: 'Not authenticated' };
  try {
    const quote = await api.createQuote(body);
    revalidatePath('/quotes');
    return { success: true, quote };
  } catch (err) {
    console.error('[createQuoteAction]', err);
    return { success: false, error: err instanceof Error ? err.message : 'Failed to create quote' };
  }
}

export async function publishQuoteAction(id: string): Promise<{
  success: boolean;
  quote?: Quote;
  publishResult?: PublishQuoteResult;
  error?: string;
}> {
  const api = await getApi();
  if (!api) return { success: false, error: 'Not authenticated' };
  try {
    const result = await api.publishQuote(id);
    revalidatePath('/quotes');
    revalidatePath(`/quotes/${id}`);
    return { success: true, quote: result.quote ?? undefined, publishResult: result };
  } catch (err) {
    console.error('[publishQuoteAction]', err);
    if (err instanceof ApiError) {
      const body = err.body as
        | { message?: string | string[]; details?: unknown }
        | string
        | undefined;
      if (typeof body === 'string' && body.trim()) {
        return { success: false, error: body };
      }
      if (body && typeof body === 'object') {
        const msg = body.message;
        if (typeof msg === 'string' && msg.trim()) {
          return { success: false, error: msg };
        }
        if (Array.isArray(msg)) {
          const joined = msg.filter((m) => typeof m === 'string' && m.trim()).join(', ');
          if (joined) return { success: false, error: joined };
        }
        if (typeof body.details === 'string' && body.details.trim()) {
          return { success: false, error: body.details };
        }
      }
      return { success: false, error: err.message || 'Failed to publish quote' };
    }
    return { success: false, error: err instanceof Error ? err.message : 'Failed to publish quote' };
  }
}

export async function approveQuoteAction(id: string): Promise<{ success: boolean; quote?: Quote; workOrderId?: string; error?: string }> {
  const api = await getApi();
  if (!api) return { success: false, error: 'Not authenticated' };
  try {
    const result = await api.approveQuote(id);
    revalidatePath('/quotes');
    revalidatePath(`/quotes/${id}`);
    revalidatePath('/work-orders');
    return { success: true, quote: result.quote, workOrderId: result.workOrderId };
  } catch (err) {
    console.error('[approveQuoteAction]', err);
    if (err instanceof ApiError) {
      const body = err.body as { message?: string; details?: string } | undefined;
      const detail = body?.details ?? body?.message ?? err.message;
      return { success: false, error: detail };
    }
    return { success: false, error: err instanceof Error ? err.message : 'Failed to approve estimate' };
  }
}

export async function createInvoiceAction(body: Record<string, unknown>): Promise<{ success: boolean; invoice?: Invoice; error?: string }> {
  const api = await getApi();
  if (!api) return { success: false, error: 'Not authenticated' };
  try {
    const invoice = await api.createInvoice(body);
    revalidatePath('/invoices');
    return { success: true, invoice };
  } catch (err) {
    console.error('[createInvoiceAction]', err);
    return { success: false, error: err instanceof Error ? err.message : 'Failed to create invoice' };
  }
}

export async function updateInvoiceAction(
  id: string,
  body: Record<string, unknown>,
): Promise<{ success: boolean; invoice?: Invoice; error?: string }> {
  const api = await getApi();
  if (!api) return { success: false, error: 'Not authenticated' };
  try {
    const invoice = await api.updateInvoice(id, body);
    revalidatePath('/invoices');
    revalidatePath(`/invoices/${id}`);
    return { success: true, invoice };
  } catch (err) {
    console.error('[updateInvoiceAction]', err);
    if (err instanceof ApiError) {
      const body = err.body as { message?: string; details?: string } | undefined;
      const detail = body?.details ?? body?.message ?? err.message;
      return { success: false, error: detail };
    }
    return { success: false, error: err instanceof Error ? err.message : 'Failed to update invoice' };
  }
}

export async function approveInvoiceAction(id: string): Promise<{
  success: boolean;
  invoice?: Invoice;
  error?: string;
}> {
  const api = await getApi();
  if (!api) return { success: false, error: 'Not authenticated' };
  try {
    const invoice = await api.approveInvoice(id);
    revalidatePath('/invoices');
    revalidatePath(`/invoices/${id}`);
    return { success: true, invoice };
  } catch (err) {
    console.error('[approveInvoiceAction]', err);
    if (err instanceof ApiError) {
      const body = err.body as { message?: string; details?: string } | undefined;
      const detail = body?.details ?? body?.message ?? err.message;
      return { success: false, error: detail };
    }
    return { success: false, error: err instanceof Error ? err.message : 'Failed to approve invoice' };
  }
}

export async function returnInvoiceToDraftAction(id: string): Promise<{
  success: boolean;
  invoice?: Invoice;
  error?: string;
}> {
  const api = await getApi();
  if (!api) return { success: false, error: 'Not authenticated' };
  try {
    const invoice = await api.returnInvoiceToDraft(id);
    revalidatePath('/invoices');
    revalidatePath(`/invoices/${id}`);
    return { success: true, invoice };
  } catch (err) {
    console.error('[returnInvoiceToDraftAction]', err);
    if (err instanceof ApiError) {
      const body = err.body as { message?: string; details?: string } | undefined;
      const detail = body?.details ?? body?.message ?? err.message;
      return { success: false, error: detail };
    }
    return { success: false, error: err instanceof Error ? err.message : 'Failed to return invoice to draft' };
  }
}

export async function receiveInvoicePaymentAction(
  id: string,
  amount: number,
): Promise<{
  success: boolean;
  invoice?: Invoice;
  error?: string;
}> {
  const api = await getApi();
  if (!api) return { success: false, error: 'Not authenticated' };
  try {
    const invoice = await api.receiveInvoicePayment(id, amount);
    revalidatePath('/invoices');
    revalidatePath(`/invoices/${id}`);
    return { success: true, invoice };
  } catch (err) {
    console.error('[receiveInvoicePaymentAction]', err);
    if (err instanceof ApiError) {
      const body = err.body as { message?: string; details?: string } | undefined;
      const detail = body?.details ?? body?.message ?? err.message;
      return { success: false, error: detail };
    }
    return { success: false, error: err instanceof Error ? err.message : 'Failed to record payment' };
  }
}

export async function updateInvoicePaymentAction(params: {
  invoiceId: string;
  paymentId: string;
  amount: number;
}): Promise<{
  success: boolean;
  invoice?: Invoice;
  error?: string;
}> {
  const api = await getApi();
  if (!api) return { success: false, error: 'Not authenticated' };
  try {
    const invoice = await api.updateInvoicePayment(
      params.invoiceId,
      params.paymentId,
      params.amount,
    );
    revalidatePath('/invoices');
    revalidatePath(`/invoices/${params.invoiceId}`);
    return { success: true, invoice };
  } catch (err) {
    console.error('[updateInvoicePaymentAction]', err);
    if (err instanceof ApiError) {
      const body = err.body as { message?: string; details?: string } | undefined;
      const detail = body?.details ?? body?.message ?? err.message;
      return { success: false, error: detail };
    }
    return { success: false, error: err instanceof Error ? err.message : 'Failed to update payment' };
  }
}

export async function deleteInvoicePaymentAction(params: {
  invoiceId: string;
  paymentId: string;
}): Promise<{
  success: boolean;
  invoice?: Invoice;
  error?: string;
}> {
  const api = await getApi();
  if (!api) return { success: false, error: 'Not authenticated' };
  try {
    const invoice = await api.deleteInvoicePayment(params.invoiceId, params.paymentId);
    revalidatePath('/invoices');
    revalidatePath(`/invoices/${params.invoiceId}`);
    return { success: true, invoice };
  } catch (err) {
    console.error('[deleteInvoicePaymentAction]', err);
    if (err instanceof ApiError) {
      const body = err.body as { message?: string; details?: string } | undefined;
      const detail = body?.details ?? body?.message ?? err.message;
      return { success: false, error: detail };
    }
    return { success: false, error: err instanceof Error ? err.message : 'Failed to delete payment' };
  }
}

export async function publishInvoiceAction(id: string): Promise<{ success: boolean; invoice?: Invoice; error?: string }> {
  const api = await getApi();
  if (!api) return { success: false, error: 'Not authenticated' };
  try {
    const invoice = await api.publishInvoice(id);
    revalidatePath('/invoices');
    revalidatePath(`/invoices/${id}`);
    return { success: true, invoice };
  } catch (err) {
    console.error('[publishInvoiceAction]', err);
    if (err instanceof ApiError) {
      const body = err.body as { message?: string; details?: string } | undefined;
      const detail = body?.details ?? body?.message ?? err.message;
      return { success: false, error: detail };
    }
    return { success: false, error: err instanceof Error ? err.message : 'Failed to publish invoice' };
  }
}

export async function createReportAction(body: Record<string, unknown>): Promise<{ success: boolean; report?: Report; error?: string }> {
  const api = await getApi();
  if (!api) return { success: false, error: 'Not authenticated' };
  try {
    const report = await api.createReport(body);
    revalidatePath('/reports');
    return { success: true, report };
  } catch (err) {
    console.error('[createReportAction]', err);
    return { success: false, error: err instanceof Error ? err.message : 'Failed to create report' };
  }
}

export async function createTaskAction(body: Record<string, unknown>): Promise<{ success: boolean; error?: string }> {
  const api = await getApi();
  if (!api) return { success: false, error: 'Not authenticated' };
  try {
    await api.createTask(body);
    revalidatePath('/tasks');
    return { success: true };
  } catch (err) {
    console.error('[createTaskAction]', err);
    return { success: false, error: err instanceof Error ? err.message : 'Failed to create task' };
  }
}

export async function updateTaskAction(
  id: string,
  body: Record<string, unknown>,
): Promise<{ success: boolean; error?: string }> {
  const api = await getApi();
  if (!api) return { success: false, error: 'Not authenticated' };
  try {
    await api.updateTask(id, body);
    revalidatePath('/tasks');
    return { success: true };
  } catch (err) {
    console.error('[updateTaskAction]', err);
    return { success: false, error: err instanceof Error ? err.message : 'Failed to update task' };
  }
}

export async function createAppointmentAction(body: Record<string, unknown>): Promise<{ success: boolean; error?: string }> {
  const api = await getApi();
  if (!api) return { success: false, error: 'Not authenticated' };
  try {
    await api.createAppointment(body);
    revalidatePath('/appointments');
    return { success: true };
  } catch (err) {
    console.error('[createAppointmentAction]', err);
    return { success: false, error: err instanceof Error ? err.message : 'Failed to create appointment' };
  }
}

export async function updateAppointmentAction(
  id: string,
  body: Record<string, unknown>,
): Promise<{ success: boolean; error?: string }> {
  const api = await getApi();
  if (!api) return { success: false, error: 'Not authenticated' };
  try {
    await api.updateAppointment(id, body);
    revalidatePath('/appointments');
    return { success: true };
  } catch (err) {
    console.error('[updateAppointmentAction]', err);
    return { success: false, error: err instanceof Error ? err.message : 'Failed to update appointment' };
  }
}

export async function searchContactsAction(
  query: string,
  options?: { typeLookupIds?: string[] },
): Promise<{ id: string; type: 'USER' | 'CONTACT'; name: string; email?: string; mobilePhone?: string }[]> {
  const api = await getApi();
  if (!api) return [];
  try {
    return await api.searchContacts(query, 'CONTACT', options);
  } catch (err) {
    console.error('[searchContactsAction]', err);
    return [];
  }
}

export async function listOrgUsersForSelectAction(): Promise<
  { id: string; name: string; email?: string }[]
> {
  const api = await getApi();
  if (!api) return [];
  try {
    const users = await api.listOrgUsersForSelect();
    return users.map((u) => ({
      id: u.id,
      name: u.name?.trim() || u.email || 'Unknown',
      email: u.email,
    }));
  } catch (err) {
    console.error('[listOrgUsersForSelectAction]', err);
    return [];
  }
}

export async function createContactAction(body: Record<string, unknown>): Promise<{ success: boolean; contact?: Contact; error?: string }> {
  const api = await getApi();
  if (!api) return { success: false, error: 'Not authenticated' };
  try {
    const contact = await api.createContact(body);
    revalidatePath('/contacts');
    return { success: true, contact };
  } catch (err) {
    console.error('[createContactAction]', err);
    return { success: false, error: err instanceof Error ? err.message : 'Failed to create contact' };
  }
}

export async function updateContactAction(
  id: string,
  body: Record<string, unknown>,
): Promise<{ success: boolean; contact?: Contact; error?: string }> {
  const api = await getApi();
  if (!api) return { success: false, error: 'Not authenticated' };
  try {
    const contact = await api.updateContact(id, body);
    revalidatePath('/contacts');
    revalidatePath(`/contacts/${id}`);
    return { success: true, contact };
  } catch (err) {
    console.error('[updateContactAction]', err);
    return { success: false, error: err instanceof Error ? err.message : 'Failed to update contact' };
  }
}

export async function ensureMeContactAction(): Promise<{
  id: string;
  type: 'CONTACT';
  name: string;
  email?: string;
} | null> {
  const api = await getApi();
  if (!api) return null;
  try {
    return await api.ensureMeContact();
  } catch (err) {
    console.error('[ensureMeContactAction]', err);
    return null;
  }
}

/** Find the signed-in user's contact (no create). Used for appointment Assigned To. */
export async function getMeContactAction(): Promise<{
  id: string;
  type: 'CONTACT';
  name: string;
  email?: string;
} | null> {
  const api = await getApi();
  if (!api) return null;
  try {
    return await api.getMeContact();
  } catch (err) {
    console.error('[getMeContactAction]', err);
    return null;
  }
}

export async function fetchContactTypeLookupsAction(): Promise<
  { id: string; name?: string; externalReference?: string }[]
> {
  const api = await getApi();
  if (!api) return [];
  try {
    const rows = await api.getLookupsByDomain('contact_type');
    return (Array.isArray(rows) ? rows : []).map((row) => ({
      id: row.id,
      name: row.name,
      externalReference: row.externalReference,
    }));
  } catch (err) {
    console.error('[fetchContactTypeLookupsAction]', err);
    return [];
  }
}

export async function createPurchaseOrderAction(body: Record<string, unknown>): Promise<{ success: boolean; purchaseOrder?: PurchaseOrder; error?: string }> {
  const api = await getApi();
  if (!api) return { success: false, error: 'Not authenticated' };
  try {
    const purchaseOrder = await api.createPurchaseOrder(body);
    revalidatePath('/purchase-orders');
    return { success: true, purchaseOrder };
  } catch (err) {
    console.error('[createPurchaseOrderAction]', err);
    return { success: false, error: err instanceof Error ? err.message : 'Failed to create purchase order' };
  }
}

export async function createWorkOrderAction(body: Record<string, unknown>): Promise<{ success: boolean; workOrder?: WorkOrder; error?: string }> {
  const api = await getApi();
  if (!api) return { success: false, error: 'Not authenticated' };
  try {
    const workOrder = await api.createWorkOrder(body);
    revalidatePath('/work-orders');
    return { success: true, workOrder };
  } catch (err) {
    console.error('[createWorkOrderAction]', err);
    return { success: false, error: err instanceof Error ? err.message : 'Failed to create work order' };
  }
}

export async function createRfqAction(body: Record<string, unknown>): Promise<{ success: boolean; rfq?: Rfq; error?: string }> {
  const api = await getApi();
  if (!api) return { success: false, error: 'Not authenticated' };
  try {
    const rfq = await api.createRfq(body);
    revalidatePath('/rfqs');
    return { success: true, rfq };
  } catch (err) {
    console.error('[createRfqAction]', err);
    return { success: false, error: err instanceof Error ? err.message : 'Failed to create RFQ' };
  }
}

export async function createProposalAction(body: Record<string, unknown>): Promise<{ success: boolean; proposal?: Proposal; error?: string }> {
  const api = await getApi();
  if (!api) return { success: false, error: 'Not authenticated' };
  try {
    const proposal = await api.createProposal(body);
    revalidatePath('/proposals');
    return { success: true, proposal };
  } catch (err) {
    console.error('[createProposalAction]', err);
    return { success: false, error: err instanceof Error ? err.message : 'Failed to create proposal' };
  }
}

export async function createBillAction(body: Record<string, unknown>): Promise<{ success: boolean; bill?: Bill; error?: string }> {
  const api = await getApi();
  if (!api) return { success: false, error: 'Not authenticated' };
  try {
    const bill = await api.createBill(body);
    revalidatePath('/bills');
    return { success: true, bill };
  } catch (err) {
    console.error('[createBillAction]', err);
    return { success: false, error: err instanceof Error ? err.message : 'Failed to create bill' };
  }
}

export async function approveBillAction(id: string): Promise<{
  success: boolean;
  bill?: Bill;
  error?: string;
}> {
  const api = await getApi();
  if (!api) return { success: false, error: 'Not authenticated' };
  try {
    const bill = await api.approveBill(id);
    revalidatePath('/bills');
    revalidatePath(`/bills/${id}`);
    return { success: true, bill };
  } catch (err) {
    console.error('[approveBillAction]', err);
    if (err instanceof ApiError) {
      const body = err.body as { message?: string; details?: string } | undefined;
      const detail = body?.details ?? body?.message ?? err.message;
      return { success: false, error: detail };
    }
    return { success: false, error: err instanceof Error ? err.message : 'Failed to approve bill' };
  }
}

export async function rejectBillAction(id: string): Promise<{
  success: boolean;
  bill?: Bill;
  error?: string;
}> {
  const api = await getApi();
  if (!api) return { success: false, error: 'Not authenticated' };
  try {
    const bill = await api.rejectBill(id);
    revalidatePath('/bills');
    revalidatePath(`/bills/${id}`);
    return { success: true, bill };
  } catch (err) {
    console.error('[rejectBillAction]', err);
    if (err instanceof ApiError) {
      const body = err.body as { message?: string; details?: string } | undefined;
      const detail = body?.details ?? body?.message ?? err.message;
      return { success: false, error: detail };
    }
    return { success: false, error: err instanceof Error ? err.message : 'Failed to reject bill' };
  }
}

export async function returnBillToReceivedAction(id: string): Promise<{
  success: boolean;
  bill?: Bill;
  error?: string;
}> {
  const api = await getApi();
  if (!api) return { success: false, error: 'Not authenticated' };
  try {
    const bill = await api.returnBillToReceived(id);
    revalidatePath('/bills');
    revalidatePath(`/bills/${id}`);
    return { success: true, bill };
  } catch (err) {
    console.error('[returnBillToReceivedAction]', err);
    if (err instanceof ApiError) {
      const body = err.body as { message?: string; details?: string } | undefined;
      const detail = body?.details ?? body?.message ?? err.message;
      return { success: false, error: detail };
    }
    return { success: false, error: err instanceof Error ? err.message : 'Failed to return bill to received' };
  }
}

export async function updateBillAction(
  id: string,
  body: Record<string, unknown>,
): Promise<{ success: boolean; bill?: Bill; error?: string }> {
  const api = await getApi();
  if (!api) return { success: false, error: 'Not authenticated' };
  try {
    const bill = await api.updateBill(id, body);
    revalidatePath('/bills');
    revalidatePath(`/bills/${id}`);
    return { success: true, bill };
  } catch (err) {
    console.error('[updateBillAction]', err);
    return { success: false, error: err instanceof Error ? err.message : 'Failed to update bill' };
  }
}
