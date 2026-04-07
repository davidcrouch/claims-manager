'use server';

import { getSession, getAccessToken } from '@/lib/auth';
import { createApiClient } from '@/lib/api-client';
import type { Quote, PurchaseOrder, Message, Report, Appointment } from '@/types/api';
import type { PaginatedResponse } from '@/types/api';

async function getApi() {
  const session = await getSession();
  if (!session.authenticated) return null;
  const token = await getAccessToken();
  if (!token) return null;
  return createApiClient({ token });
}

export async function fetchJobQuotesAction(jobId: string): Promise<Quote[] | null> {
  const api = await getApi();
  if (!api) return null;
  return api.getJobQuotes(jobId);
}

export async function fetchJobPurchaseOrdersAction(jobId: string): Promise<PurchaseOrder[] | null> {
  const api = await getApi();
  if (!api) return null;
  return api.getJobPurchaseOrders(jobId);
}

export async function fetchJobReportsAction(jobId: string): Promise<Report[] | null> {
  const api = await getApi();
  if (!api) return null;
  return api.getJobReports(jobId);
}

export async function fetchJobAppointmentsAction(jobId: string): Promise<Appointment[] | null> {
  const api = await getApi();
  if (!api) return null;
  return api.getJobAppointments(jobId);
}

export async function fetchJobMessagesAction(jobId: string): Promise<Message[] | null> {
  const api = await getApi();
  if (!api) return null;
  const res = await api.getJobMessages(jobId);
  return (res as PaginatedResponse<Message>)?.data ?? null;
}

export async function createMessageAction(body: Record<string, unknown>): Promise<{ success: boolean; message?: Message; error?: string }> {
  const api = await getApi();
  if (!api) return { success: false, error: 'Not authenticated' };
  try {
    const message = await api.createMessage(body);
    return { success: true, message };
  } catch (err) {
    console.error('[createMessageAction]', err);
    return { success: false, error: err instanceof Error ? err.message : 'Failed to send message' };
  }
}

export async function acknowledgeMessageAction(id: string): Promise<{ success: boolean; error?: string }> {
  const api = await getApi();
  if (!api) return { success: false, error: 'Not authenticated' };
  try {
    await api.acknowledgeMessage(id);
    return { success: true };
  } catch (err) {
    console.error('[acknowledgeMessageAction]', err);
    return { success: false, error: err instanceof Error ? err.message : 'Failed to acknowledge' };
  }
}
