/**
 * User ↔ role assignment CRUD (org-level).
 * Uses Drizzle ORM via getDb().
 */

import { eq, and, isNull } from 'drizzle-orm';
import type { Db } from '../client.js';
import { userRoleAssignments } from '../schema.js';
import { createLogger, LoggerType } from '../../lib/logger.js';
import { createTelemetryLogger } from '@morezero/telemetry';

const baseLogger = createLogger('auth-server:user-role-assignments', LoggerType.NODEJS);
const log = createTelemetryLogger(baseLogger, 'user-role-assignments', 'UserRoleAssignments', 'auth-server');

/**
 * Assign roles to a user within an organization.
 * Inserts new rows; silently ignores duplicates via ON CONFLICT DO NOTHING.
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
    .onConflictDoNothing({ target: [userRoleAssignments.userId, userRoleAssignments.organizationId, userRoleAssignments.roleName] });
}

/**
 * Atomic replace: revoke all existing roles for (user, org), then assign new set.
 */
export async function setUserRoles(
  db: Db,
  userId: string,
  organizationId: string,
  roleNames: string[],
): Promise<void> {
  log.info(
    { functionName: 'setUserRoles', userId, organizationId, roleNames },
    'auth-server:user-role-assignments:setUserRoles - Atomic role replacement',
  );

  await db.transaction(async (tx) => {
    // Soft-revoke all active assignments
    await tx
      .update(userRoleAssignments)
      .set({ revokedAt: new Date() } as any)
      .where(
        and(
          eq(userRoleAssignments.userId, userId),
          eq(userRoleAssignments.organizationId, organizationId),
          isNull(userRoleAssignments.revokedAt),
        ),
      );

    if (roleNames.length > 0) {
      await tx
        .insert(userRoleAssignments)
        .values(roleNames.map((roleName) => ({ userId, organizationId, roleName })))
        .onConflictDoNothing({ target: [userRoleAssignments.userId, userRoleAssignments.organizationId, userRoleAssignments.roleName] });
    }
  });
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
