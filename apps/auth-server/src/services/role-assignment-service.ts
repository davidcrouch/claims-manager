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

export interface RoleAssignmentService {
  getActiveRolesForUser(userId: string, organizationId: string): Promise<string[]>;
  resolvePermissionsForRoles(roleNames: string[]): Promise<string[]>;
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
        `;
        const roleNames = rows.map((r: any) => r.role_name as string);
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
        `;
        const perms = rows.map((r: any) => r.permission_name as string);
        log.debug(
          { functionName: 'resolvePermissionsForRoles', roleNames, count: perms.length },
          'auth-server:role-assignment-service:resolvePermissionsForRoles - Resolved permissions',
        );
        return perms;
      } catch (err: any) {
        if (isProduction) {
          log.error(
            { functionName: 'resolvePermissionsForRoles', error: err.message, roleNames },
            'auth-server:role-assignment-service:resolvePermissionsForRoles - Failed, returning empty (fail-closed)',
          );
        } else {
          log.warn(
            { functionName: 'resolvePermissionsForRoles', error: err.message, roleNames },
            'auth-server:role-assignment-service:resolvePermissionsForRoles - Failed, returning empty',
          );
        }
        return [];
      }
    },
  };
}
