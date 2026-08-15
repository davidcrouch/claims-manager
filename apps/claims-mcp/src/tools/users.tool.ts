import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ClaimsApiClient } from '../server.js';
import { proxyTool, dataBody } from './_proxy.js';

const CAT = 'organisation' as const;

export function registerUsersTools(server: McpServer, api: ClaimsApiClient): void {
  proxyTool(server, api, {
    category: CAT,
    name: 'list_org_users',
    description: 'List organization members.',
    path: '/admin/users',
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'list_org_user_roles',
    description: 'List available organization roles for user assignment.',
    path: '/admin/users/roles',
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'invite_user',
    description: 'Invite a user to the organization. Pass API body fields as data.',
    method: 'POST',
    path: '/admin/users/invite',
    input: { data: dataBody },
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'update_user_roles',
    description: 'Update roles for an organization member. Pass roles in data.',
    method: 'PATCH',
    path: '/admin/users/{userId}/roles',
    input: {
      userId: z.string().describe('User UUID'),
      data: dataBody,
    },
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'update_user_status',
    description: 'Enable or disable an organization member. Pass API body fields as data.',
    method: 'PATCH',
    path: '/admin/users/{userId}/status',
    input: {
      userId: z.string().describe('User UUID'),
      data: dataBody,
    },
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'delete_user',
    description: 'Remove a user from the organization.',
    method: 'DELETE',
    path: '/admin/users/{userId}',
    input: { userId: z.string().describe('User UUID') },
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'list_permissions',
    description: 'List permission catalogue from RBAC.',
    path: '/admin/permissions',
    input: {
      category: z.string().optional().describe('Filter by permission category'),
      scope: z.string().optional().describe('Filter by scope'),
    },
    query: (args) => ({
      category: args.category as string | undefined,
      scope: args.scope as string | undefined,
    }),
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'create_permission',
    description: 'Create a permission definition. Pass API body fields as data.',
    method: 'POST',
    path: '/admin/permissions',
    input: { data: dataBody },
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'update_permission',
    description: 'Update a permission definition. Pass API body fields as data.',
    method: 'PATCH',
    path: '/admin/permissions/{permissionId}',
    input: {
      permissionId: z.string().describe('Permission UUID'),
      data: dataBody,
    },
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'delete_permission',
    description: 'Delete a permission definition.',
    method: 'DELETE',
    path: '/admin/permissions/{permissionId}',
    input: { permissionId: z.string().describe('Permission UUID') },
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'list_roles',
    description: 'List role catalogue from RBAC.',
    path: '/admin/roles',
    input: {
      scope: z.string().optional().describe('Filter by scope'),
    },
    query: (args) => ({ scope: args.scope as string | undefined }),
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'create_role',
    description: 'Create a role definition. Pass API body fields as data.',
    method: 'POST',
    path: '/admin/roles',
    input: { data: dataBody },
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'update_role',
    description: 'Update a role definition. Pass API body fields as data.',
    method: 'PATCH',
    path: '/admin/roles/{roleId}',
    input: {
      roleId: z.string().describe('Role UUID'),
      data: dataBody,
    },
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'delete_role',
    description: 'Delete a role definition.',
    method: 'DELETE',
    path: '/admin/roles/{roleId}',
    input: { roleId: z.string().describe('Role UUID') },
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'get_role_permissions',
    description: 'List permissions assigned to a role.',
    path: '/admin/roles/{roleId}/permissions',
    input: { roleId: z.string().describe('Role UUID') },
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'set_role_permissions',
    description: 'Replace permissions for a role. Pass permissionIds in data.',
    method: 'PUT',
    path: '/admin/roles/{roleId}/permissions',
    input: {
      roleId: z.string().describe('Role UUID'),
      data: dataBody,
    },
  });
}
