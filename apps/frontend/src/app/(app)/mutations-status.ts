'use server';

import { getSession, getAccessToken } from '@/lib/auth';
import { createApiClient } from '@/lib/api-client';

async function getApi() {
  const session = await getSession();
  if (!session.authenticated) return null;
  const token = await getAccessToken();
  if (!token) return null;
  return createApiClient({ token });
}

export async function updateWorkOrderStatusAction(id: string, statusName: string) {
  const api = await getApi();
  if (!api) return { success: false, error: 'Not authenticated' };
  try {
    await api.updateWorkOrder(id, { status: { name: statusName } });
    return { success: true };
  } catch (err) {
    console.error('[frontend:mutations-status.updateWorkOrderStatusAction]', err);
    return { success: false, error: err instanceof Error ? err.message : 'Failed to update status' };
  }
}

export async function updateProposalStatusAction(id: string, statusName: string) {
  const api = await getApi();
  if (!api) return { success: false, error: 'Not authenticated' };
  try {
    await api.updateProposal(id, { status: { name: statusName } });
    return { success: true };
  } catch (err) {
    console.error('[frontend:mutations-status.updateProposalStatusAction]', err);
    return { success: false, error: err instanceof Error ? err.message : 'Failed to update status' };
  }
}

export async function updateBillStatusAction(id: string, statusName: string) {
  const api = await getApi();
  if (!api) return { success: false, error: 'Not authenticated' };
  try {
    await api.updateBill(id, { status: { name: statusName } });
    return { success: true };
  } catch (err) {
    console.error('[frontend:mutations-status.updateBillStatusAction]', err);
    return { success: false, error: err instanceof Error ? err.message : 'Failed to update status' };
  }
}
