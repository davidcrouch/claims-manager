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
  const tenantId =
    session.identity?.organization_id ??
    process.env.NEXT_PUBLIC_DEFAULT_TENANT_ID ??
    undefined;
  return createApiClient({ token, tenantId });
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

export async function fetchJobReportsAction(
  jobId: string,
  params?: {
    search?: string;
    status?: string;
    reportTypeId?: string;
    sort?: string;
    limit?: number;
  },
): Promise<Report[] | null> {
  const api = await getApi();
  if (!api) return null;
  const res = await api.getReports({
    jobId,
    limit: params?.limit ?? 100,
    search: params?.search,
    status: params?.status,
    reportTypeId: params?.reportTypeId,
    sort: params?.sort,
  });
  return res.data;
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
  try {
    const data = await api.getJobWorkOrders(jobId);
    return Array.isArray(data) ? data : [];
  } catch (err) {
    console.error(
      '[jobs/[id]/actions fetchJobWorkOrdersAction]',
      err instanceof Error ? err.message : err,
    );
    throw err;
  }
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
  dates: {
    bookedDate?: string | null;
    attendanceDate?: string | null;
    assignedToUserId?: string | null;
  },
): Promise<{ success: boolean; error?: string }> {
  return updateJobFieldsAction(jobId, dates);
}

export type UpdateJobFieldsInput = {
  bookedDate?: string | null;
  attendanceDate?: string | null;
  assignedToUserId?: string | null;
  statusLookupId?: string | null;
  statusExternalReference?: string | null;
  externalReference?: string | null;
  collectExcess?: boolean | null;
  excess?: string | null;
  makeSafeRequired?: boolean | null;
  jobInstructions?: string | null;
  vendorExternalReference?: string | null;
  /** Flattened CW type-specific fields + local jsonb mirrors */
  typeDetails?: Record<string, unknown> | null;
  temporaryAccommodationDetails?: Record<string, unknown> | null;
  specialistDetails?: Record<string, unknown> | null;
  rectificationDetails?: Record<string, unknown> | null;
  auditDetails?: Record<string, unknown> | null;
  mobilityConsiderations?: Array<{ name?: string; externalReference?: string }> | null;
};

export async function updateJobFieldsAction(
  jobId: string,
  fields: UpdateJobFieldsInput,
): Promise<{ success: boolean; error?: string }> {
  const api = await getApi();
  if (!api) return { success: false, error: 'Not authenticated' };
  try {
    const job = await api.getJob(jobId);
    const existingCustom = (job?.customData as Record<string, unknown>) ?? {};
    const existingVendorSnapshot =
      (job?.vendorSnapshot as Record<string, unknown> | undefined) ?? {};

    const body: Record<string, unknown> = {};

    const datePatch: Record<string, unknown> = {};
    if (fields.bookedDate !== undefined) datePatch.bookedDate = fields.bookedDate;
    if (fields.attendanceDate !== undefined) datePatch.attendanceDate = fields.attendanceDate;
    if (Object.keys(datePatch).length > 0) {
      body.customData = { ...existingCustom, ...datePatch };
    }

    if (fields.assignedToUserId !== undefined) {
      body.assignedToUserId = fields.assignedToUserId;
    }
    if (fields.statusLookupId !== undefined && fields.statusLookupId) {
      body.statusLookupId = fields.statusLookupId;
    }
    if (fields.statusExternalReference) {
      body.status = { externalReference: fields.statusExternalReference };
    }
    if (fields.externalReference !== undefined) {
      body.externalReference = fields.externalReference;
    }
    if (fields.collectExcess !== undefined) {
      body.collectExcess = fields.collectExcess;
    }
    if (fields.excess !== undefined) {
      body.excess = fields.excess === '' || fields.excess == null ? null : fields.excess;
    }
    if (fields.makeSafeRequired !== undefined) {
      body.makeSafeRequired = fields.makeSafeRequired;
    }
    if (fields.jobInstructions !== undefined) {
      body.jobInstructions = fields.jobInstructions;
    }
    if (fields.vendorExternalReference !== undefined) {
      const ext = fields.vendorExternalReference?.trim() || null;
      body.vendor = ext ? { externalReference: ext } : undefined;
      body.vendorSnapshot = {
        ...existingVendorSnapshot,
        externalReference: ext,
      };
    }

    const typeDetails = fields.typeDetails ?? {};
    for (const [key, value] of Object.entries(typeDetails)) {
      if (value !== undefined) body[key] = value;
    }

    if (fields.temporaryAccommodationDetails) {
      body.temporaryAccommodationDetails = fields.temporaryAccommodationDetails;
    }
    if (fields.specialistDetails) {
      body.specialistDetails = fields.specialistDetails;
    }
    if (fields.rectificationDetails) {
      body.rectificationDetails = fields.rectificationDetails;
    }
    if (fields.auditDetails) {
      body.auditDetails = fields.auditDetails;
    }
    if (fields.mobilityConsiderations !== undefined) {
      body.mobilityConsiderations = fields.mobilityConsiderations ?? [];
    }

    await api.updateJob(jobId, body);
    return { success: true };
  } catch (err) {
    console.error('[jobs/[id]/actions updateJobFieldsAction]', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to update job',
    };
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
