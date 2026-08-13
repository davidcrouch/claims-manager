/**
 * Resolves active roles and permissions for a user from the database.
 * Uses raw postgres client (independent lifecycle from Drizzle/OIDC provider).
 * Fail-closed: returns empty arrays on error.
 */

import postgres from 'postgres';
import { createLogger, LoggerType } from '../lib/logger.js';
import { createTelemetryLogger } from '@morezero/telemetry';
import { getDatabaseUrl } from '../db/client.js';

const baseLogger = createLogger('auth-server:role-assignment-service', LoggerType.NODEJS);
const log = createTelemetryLogger(baseLogger, 'role-assignment-service', 'RoleAssignmentService', 'auth-server');

const isProduction = process.env.NODE_ENV === 'production';

const PLATFORM_ADMIN_EMAILS: Set<string> = new Set(
  (process.env.PLATFORM_ADMIN_EMAILS ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean),
);

export interface RoleAssignmentService {
  getActiveRolesForUser(userId: string, organizationId: string): Promise<string[]>;
  resolvePermissionsForRoles(roleNames: string[]): Promise<string[]>;
  autoPromotePlatformAdmin(userId: string, email: string): Promise<boolean>;
}

let _sql: ReturnType<typeof postgres> | null = null;

function getSql(): ReturnType<typeof postgres> {
  if (!_sql) {
    _sql = postgres(getDatabaseUrl(), {
      max: 5,
      idle_timeout: 30,
      connect_timeout: 10,
      transform: { undefined: null },
    });
  }
  return _sql;
}

const LEGACY_ROLE_ALIASES: Record<string, string> = {
  owner: 'admin',
  organisation_admin: 'admin',
  organization_admin: 'admin',
  org_admin: 'admin',
};

/**
 * Members created before RBAC often have organization_users.role but no
 * user_role_assignments row. Those users previously had unrestricted API
 * access (empty permissions claim was allowed). Persist admin unless the
 * membership role already maps to a catalogue role other than the signup
 * placeholder "member".
 */
async function ensureLegacyMembershipRole(
  sql: ReturnType<typeof postgres>,
  userId: string,
  organizationId: string,
): Promise<string[]> {
  const membership = await sql<{ role: string }[]>`
    SELECT role
    FROM organization_users
    WHERE user_id = ${userId}::uuid
      AND organization_id = ${organizationId}::uuid
    LIMIT 1
  `;
  if (membership.length === 0) return [];

  const raw = (membership[0].role ?? '').trim().toLowerCase();
  const aliased = LEGACY_ROLE_ALIASES[raw];
  let roleName = aliased ?? 'admin';
  if (!aliased && raw && raw !== 'member') {
    const catalog = await sql<{ role_name: string }[]>`
      SELECT role_name FROM roles WHERE role_name = ${raw} LIMIT 1
    `;
    if (catalog[0]?.role_name) roleName = catalog[0].role_name;
  }

  await sql`
    INSERT INTO user_role_assignments (user_id, organization_id, role_name)
    VALUES (${userId}::uuid, ${organizationId}::uuid, ${roleName})
    ON CONFLICT (user_id, organization_id, role_name) DO UPDATE SET revoked_at = NULL
  `;
  log.info(
    { functionName: 'ensureLegacyMembershipRole', userId, organizationId, roleName, legacyRole: raw },
    'auth-server:role-assignment-service:ensureLegacyMembershipRole - Backfilled missing RBAC assignment',
  );
  return [roleName];
}

export function createRoleAssignmentService(): RoleAssignmentService {
  return {
    async getActiveRolesForUser(userId: string, organizationId: string): Promise<string[]> {
      try {
        const sql = getSql();
        const rows = await sql`
          SELECT role_name
          FROM user_role_assignments
          WHERE user_id = ${userId}
            AND organization_id = ${organizationId}
            AND revoked_at IS NULL
          ORDER BY role_name
        `;
        let roleNames = rows.map((r: any) => r.role_name as string);
        if (roleNames.length === 0) {
          roleNames = await ensureLegacyMembershipRole(sql, userId, organizationId);
        }
        log.debug(
          { functionName: 'getActiveRolesForUser', userId, organizationId, count: roleNames.length },
          'auth-server:role-assignment-service:getActiveRolesForUser - Resolved active roles',
        );
        return roleNames;
      } catch (err: any) {
        if (isProduction) {
          log.error(
            { functionName: 'getActiveRolesForUser', error: err.message, userId, organizationId },
            'auth-server:role-assignment-service:getActiveRolesForUser - Failed, returning empty (fail-closed)',
          );
        } else {
          log.warn(
            { functionName: 'getActiveRolesForUser', error: err.message, userId, organizationId },
            'auth-server:role-assignment-service:getActiveRolesForUser - Failed, returning empty',
          );
        }
        return [];
      }
    },

    async resolvePermissionsForRoles(roleNames: string[]): Promise<string[]> {
      if (roleNames.length === 0) return [];
      try {
        const sql = getSql();
        const rows = await sql`
          SELECT DISTINCT p.permission_name
          FROM role_permissions rp
          INNER JOIN roles r ON r.id = rp.role_id
          INNER JOIN permissions p ON p.id = rp.permission_id
          WHERE r.role_name = ANY(${roleNames})
          ORDER BY p.permission_name
        `;
        const perms = rows.map((r: any) => r.permission_name as string);
        if (perms.includes('*')) {
          log.info(
            { functionName: 'resolvePermissionsForRoles', roleNames, permissionCount: 1 },
            'auth-server:role-assignment-service:resolvePermissionsForRoles - Wildcard permission resolved',
          );
          return ['*'];
        }
        log.debug(
          { functionName: 'resolvePermissionsForRoles', roleNames, count: perms.length },
          'auth-server:role-assignment-service:resolvePermissionsForRoles - Resolved permissions',
        );
        return perms;
      } catch (err: any) {
        log.error(
          { functionName: 'resolvePermissionsForRoles', error: err.message, roleNames },
          'auth-server:role-assignment-service:resolvePermissionsForRoles - Failed, returning empty (fail-closed)',
        );
        return [];
      }
    },

    async autoPromotePlatformAdmin(userId: string, email: string): Promise<boolean> {
      const fn = 'auth-server:role-assignment-service:autoPromotePlatformAdmin';
      if (PLATFORM_ADMIN_EMAILS.size === 0) return false;
      if (!PLATFORM_ADMIN_EMAILS.has(email.toLowerCase())) return false;

      try {
        const sql = getSql();
        const orgRows = await sql<{ organization_id: string }[]>`
          SELECT organization_id
          FROM organization_users
          WHERE user_id = ${userId}::uuid
          ORDER BY created ASC
          LIMIT 1
        `;
        const organizationId = orgRows[0]?.organization_id;
        if (!organizationId) {
          log.warn({ userId, email }, `${fn} - No organisation membership; skipping auto-promote`);
          return false;
        }

        await sql`
          INSERT INTO user_role_assignments (user_id, organization_id, role_name)
          VALUES (${userId}::uuid, ${organizationId}::uuid, 'platform_admin')
          ON CONFLICT (user_id, organization_id, role_name) DO UPDATE SET revoked_at = NULL
        `;
        log.info({ userId, email, organizationId }, `${fn} - Auto-promoted user to platform_admin from PLATFORM_ADMIN_EMAILS`);
        return true;
      } catch (err: any) {
        log.warn({ userId, email, error: err.message }, `${fn} - Auto-promote failed (non-fatal)`);
        return false;
      }
    },
  };
}
