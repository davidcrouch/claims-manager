/**
 * Admin routes for managing the RBAC permission + role catalogue.
 * All routes require authentication via requireAuth().
 * Permission checks via local checkPermission helper.
 */

import { Application, Request, Response } from 'express';
import { createLogger, LoggerType } from '../lib/logger.js';
import { createTelemetryLogger } from '@morezero/telemetry';
import { requireAuth, permissionsFromClaims, claimHasPermission } from '../middleware/jwt-auth.js';
import { getDb } from '../db/client.js';
import {
  getRoles,
  createRole,
  updateRole,
  deleteRole,
  getPermissions,
  createPermission,
  updatePermission,
  deletePermission,
  getPermissionsForRole,
  setRolePermissions,
  type RoleScope,
  type PermissionCategory,
  type PermissionScope,
} from '../db/services/role-definitions.service.js';

const baseLogger = createLogger('auth-server:admin-permission-routes', LoggerType.NODEJS);
const log = createTelemetryLogger(baseLogger, 'admin-permission-routes', 'AdminPermissionRoutes', 'auth-server');

const SCOPE_HIERARCHY: RoleScope[] = ['org', 'network', 'account', 'platform'];

function checkPermission(req: Request, res: Response, ...required: string[]): boolean {
  const perms = permissionsFromClaims(req.authClaims);
  const hasAny = required.some((p) => claimHasPermission(perms, p));
  if (!hasAny) {
    log.warn(
      { functionName: 'checkPermission', path: req.path, required },
      'auth-server:admin-permission-routes:checkPermission - Insufficient permissions',
    );
    res.status(403).json({ error: 'forbidden', error_description: 'Insufficient permissions' });
  }
  return hasAny;
}

/**
 * Returns true when the caller's highest scope is at least as high as `target`.
 * E.g. a platform admin can create org roles, but an org admin cannot create platform roles.
 */
function callerHasScopeCeiling(req: Request, targetScope: string): boolean {
  const perms = permissionsFromClaims(req.authClaims);
  const targetIdx = SCOPE_HIERARCHY.indexOf(targetScope as RoleScope);
  if (targetIdx === -1) return false;

  for (let i = targetIdx; i < SCOPE_HIERARCHY.length; i++) {
    const scope = SCOPE_HIERARCHY[i];
    if (claimHasPermission(perms, `${scope}.roles.create`) ||
        claimHasPermission(perms, `${scope}.roles.update`) ||
        claimHasPermission(perms, `${scope}.*`) ||
        claimHasPermission(perms, '*')) {
      return true;
    }
  }
  return false;
}

export default function createAdminPermissionRoutes(app: Application): void {
  // ==========================================================================
  // Permission catalogue
  // ==========================================================================

  app.get('/admin/permissions', requireAuth(), async (req: Request, res: Response) => {
    try {
      if (!checkPermission(req, res, 'org.roles.read', 'platform.roles.read')) return;
      const db = getDb();
      const { category, scope } = req.query as { category?: PermissionCategory; scope?: PermissionScope };
      const rows = await getPermissions(db, { category, scope });
      log.info({ functionName: 'GET /admin/permissions', count: rows.length }, 'auth-server:admin-permission-routes:listPermissions - Listed permissions');
      res.json({ data: rows });
    } catch (err: any) {
      log.error({ functionName: 'GET /admin/permissions', error: err.message }, 'auth-server:admin-permission-routes:listPermissions - Error');
      res.status(500).json({ error: 'server_error', error_description: err.message });
    }
  });

  app.post('/admin/permissions', requireAuth(), async (req: Request, res: Response) => {
    try {
      if (!checkPermission(req, res, 'platform.permissions.manage')) return;
      const db = getDb();
      const row = await createPermission(db, req.body);
      log.info({ functionName: 'POST /admin/permissions', id: row.id }, 'auth-server:admin-permission-routes:createPermission - Created permission');
      res.status(201).json({ data: row });
    } catch (err: any) {
      log.error({ functionName: 'POST /admin/permissions', error: err.message }, 'auth-server:admin-permission-routes:createPermission - Error');
      res.status(500).json({ error: 'server_error', error_description: err.message });
    }
  });

  app.patch('/admin/permissions/:permissionId', requireAuth(), async (req: Request, res: Response) => {
    try {
      if (!checkPermission(req, res, 'platform.permissions.manage')) return;
      const db = getDb();
      const row = await updatePermission(db, req.params.permissionId, req.body);
      if (!row) {
        res.status(404).json({ error: 'not_found', error_description: 'Permission not found' });
        return;
      }
      log.info({ functionName: 'PATCH /admin/permissions/:id', id: row.id }, 'auth-server:admin-permission-routes:updatePermission - Updated permission');
      res.json({ data: row });
    } catch (err: any) {
      log.error({ functionName: 'PATCH /admin/permissions/:id', error: err.message }, 'auth-server:admin-permission-routes:updatePermission - Error');
      res.status(500).json({ error: 'server_error', error_description: err.message });
    }
  });

  app.delete('/admin/permissions/:permissionId', requireAuth(), async (req: Request, res: Response) => {
    try {
      if (!checkPermission(req, res, 'platform.permissions.manage')) return;
      const db = getDb();
      const deleted = await deletePermission(db, req.params.permissionId);
      if (!deleted) {
        res.status(404).json({ error: 'not_found', error_description: 'Permission not found' });
        return;
      }
      log.info({ functionName: 'DELETE /admin/permissions/:id', id: req.params.permissionId }, 'auth-server:admin-permission-routes:deletePermission - Deleted permission');
      res.status(204).end();
    } catch (err: any) {
      log.error({ functionName: 'DELETE /admin/permissions/:id', error: err.message }, 'auth-server:admin-permission-routes:deletePermission - Error');
      res.status(500).json({ error: 'server_error', error_description: err.message });
    }
  });

  // ==========================================================================
  // Role catalogue
  // ==========================================================================

  app.post('/admin/roles', requireAuth(), async (req: Request, res: Response) => {
    try {
      const scope = (req.body.scope || 'org') as RoleScope;
      if (!checkPermission(req, res, `${scope}.roles.create`)) return;
      if (!callerHasScopeCeiling(req, scope)) {
        res.status(403).json({ error: 'forbidden', error_description: `Cannot create roles at scope "${scope}"` });
        return;
      }
      const db = getDb();
      const row = await createRole(db, req.body);
      log.info({ functionName: 'POST /admin/roles', id: row.id }, 'auth-server:admin-permission-routes:createRole - Created role');
      res.status(201).json({ data: row });
    } catch (err: any) {
      log.error({ functionName: 'POST /admin/roles', error: err.message }, 'auth-server:admin-permission-routes:createRole - Error');
      res.status(500).json({ error: 'server_error', error_description: err.message });
    }
  });

  app.patch('/admin/roles/:roleId', requireAuth(), async (req: Request, res: Response) => {
    try {
      const db = getDb();
      const existing = (await getRoles(db)).find((r) => r.id === req.params.roleId);
      if (!existing) {
        res.status(404).json({ error: 'not_found', error_description: 'Role not found' });
        return;
      }
      const scope = existing.scope as RoleScope;
      if (!checkPermission(req, res, `${scope}.roles.update`)) return;
      const row = await updateRole(db, req.params.roleId, req.body);
      log.info({ functionName: 'PATCH /admin/roles/:id', id: row?.id }, 'auth-server:admin-permission-routes:updateRole - Updated role');
      res.json({ data: row });
    } catch (err: any) {
      log.error({ functionName: 'PATCH /admin/roles/:id', error: err.message }, 'auth-server:admin-permission-routes:updateRole - Error');
      res.status(500).json({ error: 'server_error', error_description: err.message });
    }
  });

  app.delete('/admin/roles/:roleId', requireAuth(), async (req: Request, res: Response) => {
    try {
      const db = getDb();
      const existing = (await getRoles(db)).find((r) => r.id === req.params.roleId);
      if (!existing) {
        res.status(404).json({ error: 'not_found', error_description: 'Role not found' });
        return;
      }
      if (existing.isSystem) {
        res.status(403).json({ error: 'forbidden', error_description: 'System roles cannot be deleted' });
        return;
      }
      const scope = existing.scope as RoleScope;
      if (!checkPermission(req, res, `${scope}.roles.delete`)) return;
      await deleteRole(db, req.params.roleId);
      log.info({ functionName: 'DELETE /admin/roles/:id', id: req.params.roleId }, 'auth-server:admin-permission-routes:deleteRole - Deleted role');
      res.status(204).end();
    } catch (err: any) {
      log.error({ functionName: 'DELETE /admin/roles/:id', error: err.message }, 'auth-server:admin-permission-routes:deleteRole - Error');
      res.status(500).json({ error: 'server_error', error_description: err.message });
    }
  });

  // ==========================================================================
  // Role ↔ Permission matrix
  // ==========================================================================

  app.get('/admin/roles/:roleId/permissions', requireAuth(), async (req: Request, res: Response) => {
    try {
      if (!checkPermission(req, res, 'org.roles.read', 'platform.roles.read')) return;
      const db = getDb();
      const rows = await getPermissionsForRole(db, req.params.roleId);
      log.info({ functionName: 'GET /admin/roles/:id/permissions', count: rows.length }, 'auth-server:admin-permission-routes:getRolePermissions - Listed role permissions');
      res.json({ data: rows });
    } catch (err: any) {
      log.error({ functionName: 'GET /admin/roles/:id/permissions', error: err.message }, 'auth-server:admin-permission-routes:getRolePermissions - Error');
      res.status(500).json({ error: 'server_error', error_description: err.message });
    }
  });

  app.put('/admin/roles/:roleId/permissions', requireAuth(), async (req: Request, res: Response) => {
    try {
      const db = getDb();
      const existing = (await getRoles(db)).find((r) => r.id === req.params.roleId);
      if (!existing) {
        res.status(404).json({ error: 'not_found', error_description: 'Role not found' });
        return;
      }
      const scope = existing.scope as RoleScope;
      if (!checkPermission(req, res, `${scope}.roles.update`)) return;

      // Scope ceiling: all assigned permissions must be at or below the role's scope
      if (!callerHasScopeCeiling(req, scope)) {
        res.status(403).json({ error: 'forbidden', error_description: `Cannot manage permissions for scope "${scope}"` });
        return;
      }

      const permissionIds: string[] = req.body.permissionIds ?? req.body.permission_ids ?? [];
      await setRolePermissions(db, req.params.roleId, permissionIds);
      log.info({ functionName: 'PUT /admin/roles/:id/permissions', roleId: req.params.roleId, count: permissionIds.length }, 'auth-server:admin-permission-routes:setRolePermissions - Updated role permissions');
      res.json({ data: { roleId: req.params.roleId, permissionIds } });
    } catch (err: any) {
      log.error({ functionName: 'PUT /admin/roles/:id/permissions', error: err.message }, 'auth-server:admin-permission-routes:setRolePermissions - Error');
      res.status(500).json({ error: 'server_error', error_description: err.message });
    }
  });
}
