'use server';

import { getAccessToken } from '@/lib/auth';
import { authConfig } from '@/lib/auth-config';

export interface FeatureDef {
  id: string;
  featureKey: string;
  label: string | null;
  description: string | null;
  defaultEnabled: boolean;
}

function mapFeature(row: Record<string, unknown>): FeatureDef {
  return {
    id: String(row.id),
    featureKey: String(row.featureKey ?? row.feature_key),
    label: (row.label as string | null) ?? null,
    description: (row.description as string | null) ?? null,
    defaultEnabled: Boolean(row.defaultEnabled ?? row.default_enabled),
  };
}

async function featureFetch<T = unknown>(path: string, opts?: RequestInit): Promise<T> {
  const token = await getAccessToken();
  if (!token) {
    throw new Error('Not authenticated');
  }
  const res = await fetch(`${authConfig.authServerUrl}${path}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...opts?.headers,
    },
    cache: 'no-store',
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`[features-actions] ${res.status} ${body}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export async function listFeaturesAction(): Promise<{
  features: FeatureDef[];
  error?: string;
}> {
  try {
    const result = await featureFetch<{ data: Record<string, unknown>[] }>('/admin/features');
    return { features: (result.data ?? []).map(mapFeature) };
  } catch (err) {
    console.error('[features-actions.listFeaturesAction]', err);
    return {
      features: [],
      error: err instanceof Error ? err.message : 'Failed to load features',
    };
  }
}

export async function createFeatureAction(input: {
  featureKey: string;
  label: string;
  description?: string;
  defaultEnabled?: boolean;
}): Promise<{ feature?: FeatureDef; error?: string }> {
  try {
    const result = await featureFetch<{ data: Record<string, unknown> }>('/admin/features', {
      method: 'POST',
      body: JSON.stringify({
        featureKey: input.featureKey,
        label: input.label,
        description: input.description,
        defaultEnabled: input.defaultEnabled ?? true,
      }),
    });
    return { feature: mapFeature(result.data) };
  } catch (err) {
    console.error('[features-actions.createFeatureAction]', err);
    return { error: err instanceof Error ? err.message : 'Failed to create feature' };
  }
}

export async function updateFeatureAction(
  featureId: string,
  input: {
    label?: string;
    description?: string;
    defaultEnabled?: boolean;
  },
): Promise<{ feature?: FeatureDef; error?: string }> {
  try {
    const result = await featureFetch<{ data: Record<string, unknown> }>(
      `/admin/features/${featureId}`,
      {
        method: 'PATCH',
        body: JSON.stringify(input),
      },
    );
    return { feature: mapFeature(result.data) };
  } catch (err) {
    console.error('[features-actions.updateFeatureAction]', err);
    return { error: err instanceof Error ? err.message : 'Failed to update feature' };
  }
}

export async function deleteFeatureAction(
  featureId: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    await featureFetch(`/admin/features/${featureId}`, { method: 'DELETE' });
    return { success: true };
  } catch (err) {
    console.error('[features-actions.deleteFeatureAction]', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to delete feature',
    };
  }
}
