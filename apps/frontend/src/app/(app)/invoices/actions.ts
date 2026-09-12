'use server';

import { revalidatePath } from 'next/cache';
import { getSession, getAccessToken } from '@/lib/auth';
import {
  createApiClient,
  type InvoiceSendRequestDetail,
} from '@/lib/api-client';
import type { PaginatedResponse } from '@/types/api';
import type { Invoice } from '@/types/api';

export async function fetchInvoicesAction(params: {
  page?: number;
  limit?: number;
  purchaseOrderId?: string;
  workOrderId?: string;
  status?: string;
  sort?: string;
  search?: string;
  jobId?: string;
  jobIds?: string[];
}): Promise<PaginatedResponse<Invoice> | null> {
  const session = await getSession();
  if (!session.authenticated) return null;

  const token = await getAccessToken();
  if (!token) return null;

  const api = createApiClient({ token });
  return api.getInvoices({
    page: params.page ?? 1,
    limit: params.limit ?? 20,
    purchaseOrderId: params.purchaseOrderId,
    workOrderId: params.workOrderId,
    status: params.status,
    sort: params.sort,
    search: params.search,
    jobId: params.jobId,
    jobIds: params.jobIds,
  });
}

async function getApi() {
  const session = await getSession();
  if (!session.authenticated) return null;
  const token = await getAccessToken();
  if (!token) return null;
  return createApiClient({ token });
}

export async function createInvoiceSendRequestAction(
  invoiceId: string,
  body: {
    recipients: Array<{ contactId?: string; name: string; email: string }>;
    generatedDocumentId: string;
    emailSubject?: string;
    emailBodyHtml?: string;
    emailBodyText?: string;
  },
): Promise<{ success: boolean; data?: InvoiceSendRequestDetail; error?: string }> {
  const api = await getApi();
  if (!api) return { success: false, error: 'Not authenticated' };
  try {
    const data = await api.createInvoiceSendRequest(invoiceId, body);
    revalidatePath('/invoices');
    revalidatePath(`/invoices/${invoiceId}`);
    return { success: true, data };
  } catch (err) {
    console.error(
      'frontend:createInvoiceSendRequestAction - failed:',
      err instanceof Error ? err.message : err,
    );
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to email invoice',
    };
  }
}
