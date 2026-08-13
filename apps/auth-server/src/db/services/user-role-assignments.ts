/**
 * User ↔ role assignment CRUD (org-level).
 * Uses Drizzle ORM via getDb().
 */

import { eq, and, isNull, sql } from 'drizzle-orm';
import type { Db } from '../client.js';
import { userRoleAssignments } from '../schema.js';
import { createLogger, LoggerType } from '../../lib/logger.js';
import { createTelemetryLogger } from '@morezero/telemetry';

const baseLogger = createLogger('auth-server:user-role-assignments', LoggerType.NODEJS);
const log = createTelemetryLogger(baseLogger, 'user-role-assignments', 'UserRoleAssignments', 'auth-server');

/**
 * Grant roles to a user in an organisation. Idempotent — clears revoked_at on conflict.
 */
export async function assignUserRoles(
  db: Db,
  userId: string,
  organizationId: string,
  roleNames: string[],
): Promise<void> {
  if (roleNames.length === 0) return;

  log.info(
    { functionName: 'assignUserRoles', userId, organizationId, roleNames },
    'auth-server:user-role-assignments:assignUserRoles - Assigning roles',
  );

  await db
    .insert(userRoleAssignments)
    .values(roleNames.map((roleName) => ({ userId, organizationId, roleName })))
    .onConflictDoUpdate({
      target: [userRoleAssignments.userId, userRoleAssignments.organizationId, userRoleAssignments.roleName],
      // Drizzle's update-set types omit nullable columns when strictNullChecks is off.
      set: { revokedAt: sql`NULL` } as any,
    });
}

/**
 * Revoke org-level roles from a user. Sets revoked_at rather than deleting.
 */
export async function revokeUserRoles(
  db: Db,
  userId: string,
  organizationId: string,
  roleNames: string[],
): Promise<void> {
  if (roleNames.length === 0) return;

  log.info(
    { functionName: 'revokeUserRoles', userId, organizationId, roleNames },
    'auth-server:user-role-assignments:revokeUserRoles - Revoking roles',
  );

  for (const roleName of roleNames) {
    await db
      .update(userRoleAssignments)
      .set({ revokedAt: new Date() } as any)
      .where(
        and(
          eq(userRoleAssignments.userId, userId),
          eq(userRoleAssignments.organizationId, organizationId),
          eq(userRoleAssignments.roleName, roleName),
          isNull(userRoleAssignments.revokedAt),
        ),
      );
  }
}

/**
 * List active (non-revoked) role names for a user in an organization.
 */
export async function listUserRoles(
  db: Db,
  userId: string,
  organizationId: string,
): Promise<string[]> {
  log.debug(
    { functionName: 'listUserRoles', userId, organizationId },
    'auth-server:user-role-assignments:listUserRoles - Listing active roles',
  );

  const rows = await db
    .select({ roleName: userRoleAssignments.roleName })
    .from(userRoleAssignments)
    .where(
      and(
        eq(userRoleAssignments.userId, userId),
        eq(userRoleAssignments.organizationId, organizationId),
        isNull(userRoleAssignments.revokedAt),
      ),
    );

  return rows.map((r) => r.roleName);
}

/**
 * Atomically set a user's org roles to exactly the given list.
 * Grants new roles (un-revoking if needed), revokes removed roles.
 */
export async function setUserRoles(
  db: Db,
  userId: string,
  organizationId: string,
  desiredRoles: string[],
): Promise<void> {
  log.info(
    { functionName: 'setUserRoles', userId, organizationId, desiredRoles },
    'auth-server:user-role-assignments:setUserRoles - Reconciling roles',
  );

  const currentRoles = await listUserRoles(db, userId, organizationId);
  const toGrant = desiredRoles.filter((r) => !currentRoles.includes(r));
  const toRevoke = currentRoles.filter((r) => !desiredRoles.includes(r));

  if (toRevoke.length > 0) {
    await revokeUserRoles(db, userId, organizationId, toRevoke);
  }
  if (toGrant.length > 0) {
    await assignUserRoles(db, userId, organizationId, toGrant);
  }
}
