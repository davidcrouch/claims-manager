'use server';

import { getSession, getAccessToken } from '@/lib/auth';
import { createApiClient } from '@/lib/api-client';
import type { AvailableRole, InviteUserPayload, OrgMember } from '@/types/api';

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

export async function listOrgUsersAction(): Promise<OrgMember[]> {
  const api = await getApi();
  if (!api) return [];
  try {
    return await api.listOrgUsers();
  } catch (err) {
    console.error('[admin/users/actions.listOrgUsersAction]', err);
    return [];
  }
}

export async function listOrgRolesAction(): Promise<AvailableRole[]> {
  const api = await getApi();
  if (!api) return [];
  try {
    return await api.listOrgRoles();
  } catch (err) {
    console.error('[admin/users/actions.listOrgRolesAction]', err);
    return [];
  }
}

export async function inviteOrgUserAction(
  payload: InviteUserPayload,
): Promise<{ success: boolean; member?: OrgMember; error?: string }> {
  const api = await getApi();
  if (!api) return { success: false, error: 'Not authenticated' };
  try {
    const member = await api.inviteOrgUser(payload);
    return { success: true, member };
  } catch (err) {
    console.error('[admin/users/actions.inviteOrgUserAction]', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to invite user',
    };
  }
}

export async function updateOrgUserRolesAction(
  userId: string,
  roles: string[],
): Promise<{ success: boolean; member?: OrgMember; error?: string }> {
  const api = await getApi();
  if (!api) return { success: false, error: 'Not authenticated' };
  try {
    const member = await api.updateOrgUserRoles(userId, roles);
    return { success: true, member };
  } catch (err) {
    console.error('[admin/users/actions.updateOrgUserRolesAction]', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to update roles',
    };
  }
}

export async function updateOrgUserStatusAction(
  userId: string,
  status: 'Active' | 'Disabled',
): Promise<{ success: boolean; member?: OrgMember; error?: string }> {
  const api = await getApi();
  if (!api) return { success: false, error: 'Not authenticated' };
  try {
    const member = await api.updateOrgUserStatus(userId, status);
    return { success: true, member };
  } catch (err) {
    console.error('[admin/users/actions.updateOrgUserStatusAction]', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to update status',
    };
  }
}

export async function removeOrgUserAction(
  userId: string,
): Promise<{ success: boolean; error?: string }> {
  const api = await getApi();
  if (!api) return { success: false, error: 'Not authenticated' };
  try {
    await api.removeOrgUser(userId);
    return { success: true };
  } catch (err) {
    console.error('[admin/users/actions.removeOrgUserAction]', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to remove user',
    };
  }
}

export async function resendInviteAction(
  member: OrgMember,
): Promise<{ success: boolean; member?: OrgMember; error?: string }> {
  if (!member.email) {
    return { success: false, error: 'User has no email address' };
  }
  return inviteOrgUserAction({
    email: member.email,
    givenName: member.givenName ?? undefined,
    familyName: member.familyName ?? undefined,
    roles: member.roles.length > 0 ? member.roles : ['member'],
  });
}
