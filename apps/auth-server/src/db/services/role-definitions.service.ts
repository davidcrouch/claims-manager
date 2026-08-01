/**
 * RBAC role + permission catalogue CRUD.
 * Uses Drizzle ORM via getDb().
 */

import { eq, and } from 'drizzle-orm';
import { getDb, type Db } from '../client.js';
import { roles, permissions, rolePermissions } from '../schema.js';
import { createLogger, LoggerType } from '../../lib/logger.js';
import { createTelemetryLogger } from '@morezero/telemetry';

const baseLogger = createLogger('auth-server:role-definitions', LoggerType.NODEJS);
const log = createTelemetryLogger(baseLogger, 'role-definitions', 'RoleDefinitions', 'auth-server');

// ---------------------------------------------------------------------------
// Type exports
// ---------------------------------------------------------------------------

export type RoleScope = 'platform' | 'org' | 'account' | 'network';
export type PermissionCategory = 'meta' | 'admin' | 'domain';
export type PermissionScope = 'platform' | 'network' | 'org' | 'all';

export type Role = typeof roles.$inferSelect;
export type Permission = typeof permissions.$inferSelect;

// ---------------------------------------------------------------------------
// Roles
// ---------------------------------------------------------------------------

export async function getRoles(
  db: Db,
  options?: { scope?: RoleScope },
): Promise<Role[]> {
  log.debug({ functionName: 'getRoles', options }, 'auth-server:role-definitions:getRoles - Listing roles');
  const conditions = options?.scope ? eq(roles.scope, options.scope) : undefined;
  return db.select().from(roles).where(conditions).orderBy(roles.sortOrder);
}

export async function createRole(
  db: Db,
  params: {
    roleName: string;
    scope?: string;
    label: string;
    description?: string;
    isSystem?: boolean;
    isDefault?: boolean;
    defaultForEvent?: string;
    sortOrder?: number;
  },
): Promise<Role> {
  log.info({ functionName: 'createRole', roleName: params.roleName }, 'auth-server:role-definitions:createRole - Creating role');
  const [row] = await db.insert(roles).values(params).returning();
  return row;
}

export async function updateRole(
  db: Db,
  roleId: string,
  params: Partial<{
    roleName: string;
    scope: string;
    label: string;
    description: string | null;
    isSystem: boolean;
    isDefault: boolean;
    defaultForEvent: string | null;
    sortOrder: number;
  }>,
): Promise<Role | null> {
  log.info({ functionName: 'updateRole', roleId }, 'auth-server:role-definitions:updateRole - Updating role');
  const setValues: Record<string, unknown> = { ...params, updatedAt: new Date() };
  const [row] = await db
    .update(roles)
    .set(setValues as any)
    .where(eq(roles.id, roleId))
    .returning();
  return row ?? null;
}

export async function deleteRole(db: Db, roleId: string): Promise<boolean> {
  log.info({ functionName: 'deleteRole', roleId }, 'auth-server:role-definitions:deleteRole - Deleting role');
  const result = await db.delete(roles).where(eq(roles.id, roleId)).returning({ id: roles.id });
  return result.length > 0;
}

// ---------------------------------------------------------------------------
// Permissions
// ---------------------------------------------------------------------------

export async function getPermissions(
  db: Db,
  options?: { category?: PermissionCategory; scope?: PermissionScope },
): Promise<Permission[]> {
  log.debug({ functionName: 'getPermissions', options }, 'auth-server:role-definitions:getPermissions - Listing permissions');
  const conditions: ReturnType<typeof eq>[] = [];
  if (options?.category) conditions.push(eq(permissions.category, options.category));
  if (options?.scope) conditions.push(eq(permissions.scope, options.scope));

  const where = conditions.length === 0 ? undefined : conditions.length === 1 ? conditions[0] : and(...conditions);
  return db.select().from(permissions).where(where).orderBy(permissions.permissionName);
}

export async function createPermission(
  db: Db,
  params: {
    permissionName: string;
    label: string;
    description?: string;
    category?: string;
    resourceGroup?: string;
    scope?: string;
  },
): Promise<Permission> {
  log.info({ functionName: 'createPermission', permissionName: params.permissionName }, 'auth-server:role-definitions:createPermission - Creating permission');
  const [row] = await db.insert(permissions).values(params).returning();
  return row;
}

export async function updatePermission(
  db: Db,
  permissionId: string,
  params: Partial<{
    permissionName: string;
    label: string;
    description: string | null;
    category: string;
    resourceGroup: string | null;
    scope: string;
  }>,
): Promise<Permission | null> {
  log.info({ functionName: 'updatePermission', permissionId }, 'auth-server:role-definitions:updatePermission - Updating permission');
  const setValues: Record<string, unknown> = { ...params, updatedAt: new Date() };
  const [row] = await db
    .update(permissions)
    .set(setValues as any)
    .where(eq(permissions.id, permissionId))
    .returning();
  return row ?? null;
}

export async function deletePermission(db: Db, permissionId: string): Promise<boolean> {
  log.info({ functionName: 'deletePermission', permissionId }, 'auth-server:role-definitions:deletePermission - Deleting permission');
  const result = await db.delete(permissions).where(eq(permissions.id, permissionId)).returning({ id: permissions.id });
  return result.length > 0;
}

// ---------------------------------------------------------------------------
// Role ↔ Permission matrix
// ---------------------------------------------------------------------------

export async function getPermissionsForRole(db: Db, roleId: string): Promise<Permission[]> {
  log.debug({ functionName: 'getPermissionsForRole', roleId }, 'auth-server:role-definitions:getPermissionsForRole - Listing permissions for role');
  const rows = await db
    .select({ permission: permissions })
    .from(rolePermissions)
    .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
    .where(eq(rolePermissions.roleId, roleId));
  return rows.map((r) => r.permission);
}

export async function setRolePermissions(
  db: Db,
  roleId: string,
  permissionIds: string[],
): Promise<void> {
  log.info({ functionName: 'setRolePermissions', roleId, count: permissionIds.length }, 'auth-server:role-definitions:setRolePermissions - Atomic replace of role permissions');

  await db.transaction(async (tx) => {
    await tx.delete(rolePermissions).where(eq(rolePermissions.roleId, roleId));

    if (permissionIds.length > 0) {
      await tx.insert(rolePermissions).values(
        permissionIds.map((permissionId) => ({ roleId, permissionId })),
      );
    }
  });
}
