'use server';

import { revalidatePath } from 'next/cache';
import { getSession, getAccessToken } from '@/lib/auth';
import { createApiClient } from '@/lib/api-client';
import type { Proposal } from '@/types/api';
import type { RfqSendRequestListItem, RfqSendRequestDetail } from '@/lib/api-client';

async function getApi() {
  const session = await getSession();
  if (!session.authenticated) return null;
  const token = await getAccessToken();
  if (!token) return null;
  return createApiClient({ token });
}

export async function fetchRfqProposalsAction(rfqId: string): Promise<Proposal[]> {
  const api = await getApi();
  if (!api) return [];
  try {
    return await api.getRfqProposals(rfqId);
  } catch (err) {
    console.error(
      'frontend:fetchRfqProposalsAction - getRfqProposals failed:',
      err instanceof Error ? err.message : err,
    );
    return [];
  }
}

export async function fetchRfqLineItemsAction(rfqId: string): Promise<{
  success: boolean;
  groups?: Array<Record<string, unknown>>;
  error?: string;
}> {
  const api = await getApi();
  if (!api) return { success: false, error: 'Not authenticated' };
  try {
    const groups = await api.getRfqLineItems(rfqId);
    return { success: true, groups };
  } catch (err) {
    console.error(
      'frontend:fetchRfqLineItemsAction - getRfqLineItems failed:',
      err instanceof Error ? err.message : err,
    );
    return { success: false, error: err instanceof Error ? err.message : 'Failed to load scope items' };
  }
}

export async function replaceRfqLineItemsAction(
  rfqId: string,
  selectedItemIds: string[],
): Promise<{
  success: boolean;
  groups?: Array<Record<string, unknown>>;
  error?: string;
}> {
  const api = await getApi();
  if (!api) return { success: false, error: 'Not authenticated' };
  try {
    const groups = await api.replaceRfqLineItems(rfqId, { selectedItemIds });
    revalidatePath(`/rfqs/${rfqId}`);
    return { success: true, groups };
  } catch (err) {
    console.error(
      'frontend:replaceRfqLineItemsAction - replaceRfqLineItems failed:',
      err instanceof Error ? err.message : err,
    );
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to update scope items',
    };
  }
}

export async function updateRfqLineNoteAction(
  rfqId: string,
  body: {
    targetType: 'group' | 'combo' | 'item';
    targetId: string;
    note: string | null;
  },
): Promise<{
  success: boolean;
  note?: string | null;
  error?: string;
}> {
  const api = await getApi();
  if (!api) return { success: false, error: 'Not authenticated' };
  try {
    const result = await api.updateRfqLineNote(rfqId, body);
    revalidatePath(`/rfqs/${rfqId}`);
    return { success: true, note: result.note };
  } catch (err) {
    console.error(
      'frontend:updateRfqLineNoteAction - updateRfqLineNote failed:',
      err instanceof Error ? err.message : err,
    );
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to save note',
    };
  }
}

export async function updateRfqFieldsAction(
  rfqId: string,
  body: { includePricing?: boolean; includeQuantities?: boolean },
): Promise<{ success: boolean; error?: string }> {
  const api = await getApi();
  if (!api) return { success: false, error: 'Not authenticated' };
  try {
    await api.updateRfq(rfqId, body);
    revalidatePath(`/rfqs/${rfqId}`);
    revalidatePath('/rfqs');
    return { success: true };
  } catch (err) {
    console.error(
      'frontend:updateRfqFieldsAction - updateRfq failed:',
      err instanceof Error ? err.message : err,
    );
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to update RFQ',
    };
  }
}

// -- RFQ Send Requests --

export async function fetchRfqSendRequestsAction(
  rfqId: string,
): Promise<{ success: boolean; data?: RfqSendRequestListItem[]; error?: string }> {
  const api = await getApi();
  if (!api) return { success: false, error: 'Not authenticated' };
  try {
    const data = await api.listRfqSendRequests(rfqId);
    return { success: true, data };
  } catch (err) {
    console.error(
      'frontend:fetchRfqSendRequestsAction - failed:',
      err instanceof Error ? err.message : err,
    );
    return { success: false, error: err instanceof Error ? err.message : 'Failed to load send requests' };
  }
}

export async function fetchRfqSendRequestDetailAction(
  rfqId: string,
  requestId: string,
): Promise<{ success: boolean; data?: RfqSendRequestDetail; error?: string }> {
  const api = await getApi();
  if (!api) return { success: false, error: 'Not authenticated' };
  try {
    const data = await api.getRfqSendRequest(rfqId, requestId);
    return { success: true, data };
  } catch (err) {
    console.error(
      'frontend:fetchRfqSendRequestDetailAction - failed:',
      err instanceof Error ? err.message : err,
    );
    return { success: false, error: err instanceof Error ? err.message : 'Failed to load request detail' };
  }
}

export async function createRfqSendRequestAction(
  rfqId: string,
  body: {
    recipients: Array<{ contactId?: string; name: string; email: string }>;
    generatedDocumentId: string;
    emailSubject?: string;
    emailBodyHtml?: string;
    emailBodyText?: string;
  },
): Promise<{ success: boolean; data?: RfqSendRequestDetail; error?: string }> {
  const api = await getApi();
  if (!api) return { success: false, error: 'Not authenticated' };
  try {
    const data = await api.createRfqSendRequest(rfqId, body);
    revalidatePath(`/rfqs/${rfqId}`);
    return { success: true, data };
  } catch (err) {
    console.error(
      'frontend:createRfqSendRequestAction - failed:',
      err instanceof Error ? err.message : err,
    );
    return { success: false, error: err instanceof Error ? err.message : 'Failed to send request' };
  }
}

export async function retryRfqSendRequestAction(
  rfqId: string,
  requestId: string,
  body: { recipients: Array<{ recipientId: string; email?: string }> },
): Promise<{ success: boolean; data?: RfqSendRequestDetail; error?: string }> {
  const api = await getApi();
  if (!api) return { success: false, error: 'Not authenticated' };
  try {
    const data = await api.retryRfqSendRequest(rfqId, requestId, body);
    return { success: true, data };
  } catch (err) {
    console.error(
      'frontend:retryRfqSendRequestAction - failed:',
      err instanceof Error ? err.message : err,
    );
    return { success: false, error: err instanceof Error ? err.message : 'Failed to retry' };
  }
}
