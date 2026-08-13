'use server';

import { getSession, getAccessToken } from '@/lib/auth';
import { createApiClient } from '@/lib/api-client';
import type { PermissionDef, RoleDef } from '@/types/api';

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

export async function listRolesAction(scope?: string): Promise<RoleDef[]> {
  const api = await getApi();
  if (!api) return [];
  try {
    return await api.listRoles(scope);
  } catch (err) {
    console.error('[admin/roles/actions.listRolesAction]', err);
    return [];
  }
}

export async function listPermissionsAction(): Promise<PermissionDef[]> {
  const api = await getApi();
  if (!api) return [];
  try {
    return await api.listPermissions();
  } catch (err) {
    console.error('[admin/roles/actions.listPermissionsAction]', err);
    return [];
  }
}

export async function createRoleAction(input: {
  roleName: string;
  scope: string;
  label: string;
  description?: string;
}): Promise<{ success: boolean; role?: RoleDef; error?: string }> {
  const api = await getApi();
  if (!api) return { success: false, error: 'Not authenticated' };
  try {
    const role = await api.createRole(input);
    return { success: true, role };
  } catch (err) {
    console.error('[admin/roles/actions.createRoleAction]', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to create role',
    };
  }
}

export async function deleteRoleAction(
  roleId: string,
): Promise<{ success: boolean; error?: string }> {
  const api = await getApi();
  if (!api) return { success: false, error: 'Not authenticated' };
  try {
    await api.deleteRole(roleId);
    return { success: true };
  } catch (err) {
    console.error('[admin/roles/actions.deleteRoleAction]', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to delete role',
    };
  }
}

export async function getRolePermissionsAction(
  roleId: string,
): Promise<PermissionDef[]> {
  const api = await getApi();
  if (!api) return [];
  try {
    return await api.getRolePermissions(roleId);
  } catch (err) {
    console.error('[admin/roles/actions.getRolePermissionsAction]', err);
    return [];
  }
}

export async function setRolePermissionsAction(
  roleId: string,
  permissionIds: string[],
): Promise<{ success: boolean; error?: string }> {
  const api = await getApi();
  if (!api) return { success: false, error: 'Not authenticated' };
  try {
    await api.setRolePermissions(roleId, permissionIds);
    return { success: true };
  } catch (err) {
    console.error('[admin/roles/actions.setRolePermissionsAction]', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to save permissions',
    };
  }
}
