'use server';

import { getServerApiClient } from '@/lib/server-api';
import type { OrganisationProfile } from '@/types/api';

export async function getOrganisationAction(): Promise<OrganisationProfile | null> {
  const api = await getServerApiClient();
  if (!api) return null;
  try {
    return await api.getOrganisation();
  } catch (err) {
    console.error('[frontend:admin/settings/actions.getOrganisationAction]', err);
    return null;
  }
}

export async function updateOrganisationAction(payload: {
  name: string;
  abn: string;
  primaryEmail: string;
  phone: string;
  address: string;
}): Promise<{ success: boolean; organisation?: OrganisationProfile; error?: string }> {
  const api = await getServerApiClient();
  if (!api) return { success: false, error: 'Not authenticated' };
  try {
    const organisation = await api.updateOrganisation(payload);
    return { success: true, organisation };
  } catch (err) {
    console.error('[frontend:admin/settings/actions.updateOrganisationAction]', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to save company details',
    };
  }
}
