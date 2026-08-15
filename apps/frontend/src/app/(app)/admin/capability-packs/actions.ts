'use server';

import { getSession, getAccessToken } from '@/lib/auth';
import { createApiClient } from '@/lib/api-client';
import type {
  CapabilityPackCatalogEntry,
  CapabilityPackDriftItem,
  CapabilityPackInstall,
  CapabilityPackPreview,
} from '@/lib/api-client';

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

export async function listCapabilityPacksAction(): Promise<CapabilityPackCatalogEntry[]> {
  const api = await getApi();
  if (!api) return [];
  try {
    return await api.listCapabilityPacks();
  } catch (err) {
    console.error('[admin/capability-packs/actions.listCapabilityPacksAction]', err);
    return [];
  }
}

export async function listInstalledCapabilityPacksAction(): Promise<CapabilityPackInstall[]> {
  const api = await getApi();
  if (!api) return [];
  try {
    return await api.listInstalledCapabilityPacks();
  } catch (err) {
    console.error('[admin/capability-packs/actions.listInstalledCapabilityPacksAction]', err);
    return [];
  }
}

export async function installCapabilityPackAction(input: {
  packId?: string;
  version?: string;
  uploadId?: string;
}): Promise<{ success: boolean; installId?: string; error?: string }> {
  const api = await getApi();
  if (!api) return { success: false, error: 'Not authenticated' };
  try {
    const result = await api.installCapabilityPack(input);
    return { success: true, installId: result.installId };
  } catch (err) {
    console.error('[admin/capability-packs/actions.installCapabilityPackAction]', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Install failed',
    };
  }
}

export async function upgradeCapabilityPackAction(
  installId: string,
): Promise<{ success: boolean; error?: string }> {
  const api = await getApi();
  if (!api) return { success: false, error: 'Not authenticated' };
  try {
    await api.upgradeCapabilityPack(installId);
    return { success: true };
  } catch (err) {
    console.error('[admin/capability-packs/actions.upgradeCapabilityPackAction]', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Upgrade failed',
    };
  }
}

export async function uninstallCapabilityPackAction(
  installId: string,
  force = false,
): Promise<{ success: boolean; error?: string }> {
  const api = await getApi();
  if (!api) return { success: false, error: 'Not authenticated' };
  try {
    await api.uninstallCapabilityPack(installId, { force });
    return { success: true };
  } catch (err) {
    console.error('[admin/capability-packs/actions.uninstallCapabilityPackAction]', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Uninstall failed',
    };
  }
}

export async function getCapabilityPackDriftAction(
  installId: string,
): Promise<{ success: boolean; drift?: CapabilityPackDriftItem[]; error?: string }> {
  const api = await getApi();
  if (!api) return { success: false, error: 'Not authenticated' };
  try {
    const drift = await api.getCapabilityPackDrift(installId);
    return { success: true, drift };
  } catch (err) {
    console.error('[admin/capability-packs/actions.getCapabilityPackDriftAction]', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Drift check failed',
    };
  }
}

export async function uploadCapabilityPackAction(
  formData: FormData,
): Promise<{ success: boolean; uploadId?: string; packId?: string; error?: string }> {
  const api = await getApi();
  if (!api) return { success: false, error: 'Not authenticated' };
  const file = formData.get('file');
  if (!(file instanceof File)) {
    return { success: false, error: 'file is required' };
  }
  try {
    const result = await api.uploadCapabilityPack(file);
    return {
      success: true,
      uploadId: result.uploadId,
      packId: result.packId,
    };
  } catch (err) {
    console.error('[admin/capability-packs/actions.uploadCapabilityPackAction]', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Upload failed',
    };
  }
}

export async function previewCapabilityPackAction(input: {
  packId?: string;
  version?: string;
  uploadId?: string;
}): Promise<{ success: boolean; preview?: CapabilityPackPreview; error?: string }> {
  const api = await getApi();
  if (!api) return { success: false, error: 'Not authenticated' };
  try {
    const preview = await api.previewCapabilityPack(input);
    return { success: true, preview };
  } catch (err) {
    console.error('[admin/capability-packs/actions.previewCapabilityPackAction]', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Preview failed',
    };
  }
}
