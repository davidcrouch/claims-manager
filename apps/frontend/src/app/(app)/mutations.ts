'use server';

import { getSession, getAccessToken } from '@/lib/auth';
import { createApiClient } from '@/lib/api-client';
import type { Quote, Invoice, Report, Task, Contact } from '@/types/api';

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
    return { success: true, quote };
  } catch (err) {
    console.error('[createQuoteAction]', err);
    return { success: false, error: err instanceof Error ? err.message : 'Failed to create quote' };
  }
}

export async function publishQuoteAction(id: string): Promise<{ success: boolean; quote?: Quote; error?: string }> {
  const api = await getApi();
  if (!api) return { success: false, error: 'Not authenticated' };
  try {
    const quote = await api.publishQuote(id);
    return { success: true, quote };
  } catch (err) {
    console.error('[publishQuoteAction]', err);
    return { success: false, error: err instanceof Error ? err.message : 'Failed to publish quote' };
  }
}

export async function createInvoiceAction(body: Record<string, unknown>): Promise<{ success: boolean; invoice?: Invoice; error?: string }> {
  const api = await getApi();
  if (!api) return { success: false, error: 'Not authenticated' };
  try {
    const invoice = await api.createInvoice(body);
    return { success: true, invoice };
  } catch (err) {
    console.error('[createInvoiceAction]', err);
    return { success: false, error: err instanceof Error ? err.message : 'Failed to create invoice' };
  }
}

export async function createReportAction(body: Record<string, unknown>): Promise<{ success: boolean; report?: Report; error?: string }> {
  const api = await getApi();
  if (!api) return { success: false, error: 'Not authenticated' };
  try {
    const report = await api.createReport(body);
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
    return { success: true };
  } catch (err) {
    console.error('[createTaskAction]', err);
    return { success: false, error: err instanceof Error ? err.message : 'Failed to create task' };
  }
}

export async function createAppointmentAction(body: Record<string, unknown>): Promise<{ success: boolean; error?: string }> {
  const api = await getApi();
  if (!api) return { success: false, error: 'Not authenticated' };
  try {
    await api.createAppointment(body);
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
    return { success: true };
  } catch (err) {
    console.error('[updateAppointmentAction]', err);
    return { success: false, error: err instanceof Error ? err.message : 'Failed to update appointment' };
  }
}

export async function searchContactsAction(
  query: string,
): Promise<{ id: string; type: 'USER' | 'CONTACT'; name: string; email?: string }[]> {
  const api = await getApi();
  if (!api) return [];
  try {
    return await api.searchContacts(query, 'CONTACT');
  } catch (err) {
    console.error('[searchContactsAction]', err);
    return [];
  }
}

export async function createContactAction(body: Record<string, unknown>): Promise<{ success: boolean; contact?: Contact; error?: string }> {
  const api = await getApi();
  if (!api) return { success: false, error: 'Not authenticated' };
  try {
    const contact = await api.createContact(body);
    return { success: true, contact };
  } catch (err) {
    console.error('[createContactAction]', err);
    return { success: false, error: err instanceof Error ? err.message : 'Failed to create contact' };
  }
}
