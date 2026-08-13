/**
 * Admin routes for managing user ↔ role assignments.
 *
 * Privileged roles are guarded by soft-config permissions: if a
 * `roles.grant.<role_name>` permission exists in the catalogue, the caller
 * must hold it to grant or revoke that role. Roles without a matching
 * `roles.grant.*` entry only require `org.users.manage`.
 */

import { Application, Request, Response } from 'express';
import { eq } from 'drizzle-orm';
import { createLogger, LoggerType } from '../lib/logger.js';
import { createTelemetryLogger } from '@morezero/telemetry';
import { requireAuth, permissionsFromClaims, claimHasPermission } from '../middleware/jwt-auth.js';
import { getDb } from '../db/client.js';
import { permissions } from '../db/schema.js';
import { getRoles, type RoleScope } from '../db/services/role-definitions.service.js';
import { setUserRoles, listUserRoles } from '../db/services/user-role-assignments.js';

const baseLogger = createLogger('auth-server:admin-role-routes', LoggerType.NODEJS);
const log = createTelemetryLogger(baseLogger, 'admin-role-routes', 'AdminRoleRoutes', 'auth-server');

function checkPermission(req: Request, res: Response, ...required: string[]): boolean {
  const perms = permissionsFromClaims(req.authClaims);
  const hasAny = required.some((p) => claimHasPermission(perms, p));
  if (!hasAny) {
    log.warn(
      { functionName: 'checkPermission', path: req.path, required },
      'auth-server:admin-role-routes:checkPermission - Insufficient permissions',
    );
    res.status(403).json({ error: 'forbidden', error_description: 'Insufficient permissions' });
  }
  return hasAny;
}

async function getGuardedGrantPermissions(
  roleNames: string[],
): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  if (roleNames.length === 0) return result;

  const db = getDb();
  for (const roleName of roleNames) {
    const grantPerm = `roles.grant.${roleName}`;
    const rows = await db
      .select({ permissionName: permissions.permissionName })
      .from(permissions)
      .where(eq(permissions.permissionName, grantPerm))
      .limit(1);
    if (rows.length > 0) {
      result.set(roleName, grantPerm);
    }
  }
  return result;
}

function assertCanGrantRoles(
  req: Request,
  res: Response,
  currentRoles: string[],
  desiredRoles: string[],
  guarded: Map<string, string>,
): boolean {
  const perms = permissionsFromClaims(req.authClaims);
  const added = desiredRoles.filter((r) => !currentRoles.includes(r));
  const removed = currentRoles.filter((r) => !desiredRoles.includes(r));
  const touched = [...new Set([...added, ...removed])];

  for (const roleName of touched) {
    const grantPerm = guarded.get(roleName);
    if (!grantPerm) continue;
    if (!claimHasPermission(perms, grantPerm)) {
      log.warn(
        { functionName: 'assertCanGrantRoles', roleName, grantPerm, path: req.path },
        'auth-server:admin-role-routes:assertCanGrantRoles - Missing roles.grant permission',
      );
      res.status(403).json({
        error: 'forbidden',
        error_description: `Permission ${grantPerm} is required to grant or revoke ${roleName}`,
      });
      return false;
    }
  }
  return true;
}

export default function createAdminRoleRoutes(app: Application): void {
  app.put('/admin/users/:userId/roles', requireAuth(), async (req: Request, res: Response) => {
    try {
      if (!checkPermission(req, res, 'org.users.manage')) return;

      const { userId } = req.params;
      const organizationId = req.body.organizationId ?? req.body.organization_id ?? req.organizationId;
      const roleNames: string[] = req.body.roles ?? req.body.roleNames ?? [];

      if (!organizationId) {
        res.status(400).json({ error: 'bad_request', error_description: 'organizationId is required' });
        return;
      }

      const db = getDb();
      const currentRoles = await listUserRoles(db, userId, organizationId);
      const guarded = await getGuardedGrantPermissions([...new Set([...currentRoles, ...roleNames])]);
      if (!assertCanGrantRoles(req, res, currentRoles, roleNames, guarded)) return;

      await setUserRoles(db, userId, organizationId, roleNames);

      log.info(
        { functionName: 'PUT /admin/users/:userId/roles', userId, organizationId, roleNames },
        'auth-server:admin-role-routes:setUserRoles - Roles updated',
      );
      res.json({ data: { userId, organizationId, roles: roleNames } });
    } catch (err: any) {
      log.error({ functionName: 'PUT /admin/users/:userId/roles', error: err.message }, 'auth-server:admin-role-routes:setUserRoles - Error');
      res.status(500).json({ error: 'server_error', error_description: err.message });
    }
  });

  app.get('/admin/users/:userId/roles', requireAuth(), async (req: Request, res: Response) => {
    try {
      if (!checkPermission(req, res, 'org.roles.read', 'org.users.manage')) return;

      const { userId } = req.params;
      const organizationId = (req.query.organizationId ?? req.query.organization_id ?? req.organizationId) as string | undefined;

      if (!organizationId) {
        res.status(400).json({ error: 'bad_request', error_description: 'organizationId query parameter is required' });
        return;
      }

      const db = getDb();
      const roleNames = await listUserRoles(db, userId, organizationId);

      log.info(
        { functionName: 'GET /admin/users/:userId/roles', userId, organizationId, count: roleNames.length },
        'auth-server:admin-role-routes:listUserRoles - Listed user roles',
      );
      res.json({ data: { userId, organizationId, roles: roleNames } });
    } catch (err: any) {
      log.error({ functionName: 'GET /admin/users/:userId/roles', error: err.message }, 'auth-server:admin-role-routes:listUserRoles - Error');
      res.status(500).json({ error: 'server_error', error_description: err.message });
    }
  });

  app.get('/admin/roles', requireAuth(), async (req: Request, res: Response) => {
    try {
      if (!checkPermission(req, res, 'org.roles.read', 'org.users.manage', 'org.users.invite')) return;

      const db = getDb();
      const scope = req.query.scope as RoleScope | undefined;
      const rows = await getRoles(db, scope ? { scope } : undefined);

      log.info(
        { functionName: 'GET /admin/roles', count: rows.length, scope },
        'auth-server:admin-role-routes:listRoles - Listed roles',
      );
      res.json({ data: rows });
    } catch (err: any) {
      log.error({ functionName: 'GET /admin/roles', error: err.message }, 'auth-server:admin-role-routes:listRoles - Error');
      res.status(500).json({ error: 'server_error', error_description: err.message });
    }
  });
}
