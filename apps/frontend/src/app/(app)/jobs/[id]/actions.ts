'use server';

import { getSession, getAccessToken } from '@/lib/auth';
import { createApiClient, ApiError } from '@/lib/api-client';
import type {
  Quote,
  PurchaseOrder,
  Message,
  Report,
  Appointment,
  Invoice,
  Task,
  Attachment,
  WorkOrder,
  Rfq,
  Proposal,
  Bill,
} from '@/types/api';
import type { PaginatedResponse } from '@/types/api';

export interface PhaseGatedResult<T> {
  data: T[];
  phaseUnavailable: boolean;
  error?: string;
}

function isNotImplemented(err: unknown): boolean {
  if (err instanceof ApiError) {
    return err.status === 404 || err.status === 501;
  }
  return false;
}

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
    console.error('[jobs/[id]/actions acknowledgeMessageAction]', err);
    return { success: false, error: err instanceof Error ? err.message : 'Failed to acknowledge' };
  }
}

export async function fetchJobWorkOrdersAction(jobId: string): Promise<WorkOrder[] | null> {
  const api = await getApi();
  if (!api) return null;
  return api.getJobWorkOrders(jobId);
}

export async function fetchJobRfqsAction(jobId: string): Promise<Rfq[] | null> {
  const api = await getApi();
  if (!api) return null;
  return api.getJobRfqs(jobId);
}

export async function fetchJobProposalsAction(jobId: string): Promise<Proposal[] | null> {
  const api = await getApi();
  if (!api) return null;
  return api.getJobProposals(jobId);
}

export async function fetchJobBillsAction(jobId: string): Promise<Bill[] | null> {
  const api = await getApi();
  if (!api) return null;
  return api.getJobBills(jobId);
}

export async function fetchJobInvoicesAction(
  jobId: string,
): Promise<PhaseGatedResult<Invoice>> {
  const api = await getApi();
  if (!api) return { data: [], phaseUnavailable: false, error: 'Not authenticated' };
  try {
    const data = await api.getJobInvoices(jobId);
    return { data: data ?? [], phaseUnavailable: false };
  } catch (err) {
    if (isNotImplemented(err)) {
      return { data: [], phaseUnavailable: true };
    }
    console.error('[jobs/[id]/actions fetchJobInvoicesAction]', err);
    return {
      data: [],
      phaseUnavailable: false,
      error: err instanceof Error ? err.message : 'Failed to load invoices',
    };
  }
}

export async function fetchJobTasksAction(
  jobId: string,
): Promise<PhaseGatedResult<Task>> {
  const api = await getApi();
  if (!api) return { data: [], phaseUnavailable: false, error: 'Not authenticated' };
  try {
    const data = await api.getJobTasks(jobId);
    return { data: data ?? [], phaseUnavailable: false };
  } catch (err) {
    if (isNotImplemented(err)) {
      return { data: [], phaseUnavailable: true };
    }
    console.error('[jobs/[id]/actions fetchJobTasksAction]', err);
    return {
      data: [],
      phaseUnavailable: false,
      error: err instanceof Error ? err.message : 'Failed to load tasks',
    };
  }
}

export async function fetchJobContactsAction(
  jobId: string,
): Promise<{ id: string; type: 'CONTACT'; name: string; email?: string }[]> {
  const api = await getApi();
  if (!api) return [];
  try {
    return await api.getJobContacts(jobId);
  } catch (err) {
    console.error('[jobs/[id]/actions fetchJobContactsAction]', err);
    return [];
  }
}

export async function updateJobDatesAction(
  jobId: string,
  dates: { bookedDate?: string | null; attendanceDate?: string | null },
): Promise<{ success: boolean; error?: string }> {
  const api = await getApi();
  if (!api) return { success: false, error: 'Not authenticated' };
  try {
    const job = await api.getJob(jobId);
    const existing = (job?.customData as Record<string, unknown>) ?? {};
    const merged = { ...existing, ...dates };
    await api.updateJob(jobId, { customData: merged });
    return { success: true };
  } catch (err) {
    console.error('[jobs/[id]/actions updateJobDatesAction]', err);
    return { success: false, error: err instanceof Error ? err.message : 'Failed to update dates' };
  }
}

export async function fetchJobAttachmentsAction(
  jobId: string,
): Promise<PhaseGatedResult<Attachment>> {
  const api = await getApi();
  if (!api) return { data: [], phaseUnavailable: false, error: 'Not authenticated' };
  try {
    const data = await api.getJobAttachments(jobId);
    return { data: data ?? [], phaseUnavailable: false };
  } catch (err) {
    if (isNotImplemented(err)) {
      return { data: [], phaseUnavailable: true };
    }
    console.error('[jobs/[id]/actions fetchJobAttachmentsAction]', err);
    return {
      data: [],
      phaseUnavailable: false,
      error: err instanceof Error ? err.message : 'Failed to load attachments',
    };
  }
}
