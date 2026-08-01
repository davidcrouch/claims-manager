'use server';

import { getServerApiClient } from '@/lib/server-api';

export async function fetchClaimsAction() {
  const api = await getServerApiClient();
  if (!api) return null;
  return api.getOrganisationClaims();
}

export async function fetchGhostOrganisationsAction() {
  const api = await getServerApiClient();
  if (!api) return null;
  return api.getGhostOrganisations();
}

export async function approveClaimAction(claimId: string) {
  const api = await getServerApiClient();
  if (!api) throw new Error('Not authenticated');
  return api.approveOrganisationClaim(claimId);
}

export async function rejectClaimAction(claimId: string, notes?: string) {
  const api = await getServerApiClient();
  if (!api) throw new Error('Not authenticated');
  return api.rejectOrganisationClaim(claimId, notes);
}
