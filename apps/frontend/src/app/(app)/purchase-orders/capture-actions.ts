'use server';

import { getSession, getAccessToken } from '@/lib/auth';
import { createApiClient, type CapturePoRequest, type CapturePoResponse, type GhostOrganisation, type OrganisationClaim } from '@/lib/api-client';

async function getApi() {
  const session = await getSession();
  if (!session.authenticated) return null;
  const token = await getAccessToken();
  if (!token) return null;
  return createApiClient({ token });
}

export async function capturePurchaseOrderAction(
  body: CapturePoRequest,
): Promise<{ success: boolean; data?: CapturePoResponse; error?: string }> {
  const api = await getApi();
  if (!api) return { success: false, error: 'Not authenticated' };

  try {
    const data = await api.capturePurchaseOrder(body);
    return { success: true, data };
  } catch (err) {
    console.error('[capturePurchaseOrderAction]', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to capture purchase order',
    };
  }
}

export async function fetchGhostOrganisationsAction(): Promise<GhostOrganisation[]> {
  const api = await getApi();
  if (!api) return [];
  try {
    return await api.getGhostOrganisations();
  } catch (err) {
    console.error('[fetchGhostOrganisationsAction]', err);
    return [];
  }
}

export async function fetchOrganisationClaimsAction(): Promise<OrganisationClaim[]> {
  const api = await getApi();
  if (!api) return [];
  try {
    return await api.getOrganisationClaims();
  } catch (err) {
    console.error('[fetchOrganisationClaimsAction]', err);
    return [];
  }
}

export async function claimGhostOrganisationAction(
  ghostOrgId: string,
): Promise<{ success: boolean; error?: string }> {
  const api = await getApi();
  if (!api) return { success: false, error: 'Not authenticated' };
  try {
    await api.claimGhostOrganisation(ghostOrgId);
    return { success: true };
  } catch (err) {
    console.error('[claimGhostOrganisationAction]', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to claim organisation',
    };
  }
}

export async function approveClaimAction(
  claimId: string,
): Promise<{ success: boolean; error?: string }> {
  const api = await getApi();
  if (!api) return { success: false, error: 'Not authenticated' };
  try {
    await api.approveOrganisationClaim(claimId);
    return { success: true };
  } catch (err) {
    console.error('[approveClaimAction]', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to approve claim',
    };
  }
}

export async function rejectClaimAction(
  claimId: string,
  notes?: string,
): Promise<{ success: boolean; error?: string }> {
  const api = await getApi();
  if (!api) return { success: false, error: 'Not authenticated' };
  try {
    await api.rejectOrganisationClaim(claimId, notes);
    return { success: true };
  } catch (err) {
    console.error('[rejectClaimAction]', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to reject claim',
    };
  }
}
