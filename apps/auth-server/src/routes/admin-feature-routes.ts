/**
 * Admin routes for managing the feature catalogue and grants.
 * All routes require authentication + features.manage permission.
 */

import { Application, Request, Response } from 'express';
import { createLogger, LoggerType } from '../lib/logger.js';
import { createTelemetryLogger } from '@morezero/telemetry';
import { requireAuth, permissionsFromClaims, claimHasPermission } from '../middleware/jwt-auth.js';
import { getDb } from '../db/client.js';
import {
  listFeatures,
  getFeatureById,
  createFeature,
  updateFeature,
  deleteFeature,
  listGrants,
  setGrant,
  removeGrant,
} from '../db/services/feature-definitions.service.js';
import { clearFeatureCatalogueCache, resolveFeatures } from '../services/feature-resolution-service.js';

function normalizeFeatureBody(body: Record<string, unknown>) {
  return {
    featureKey: (body.featureKey ?? body.feature_key) as string | undefined,
    defaultEnabled: (body.defaultEnabled ?? body.default_enabled) as boolean | undefined,
    label: (body.label as string | undefined) ?? undefined,
    description: (body.description as string | undefined) ?? undefined,
  };
}

const baseLogger = createLogger('auth-server:admin-feature-routes', LoggerType.NODEJS);
const log = createTelemetryLogger(baseLogger, 'admin-feature-routes', 'AdminFeatureRoutes', 'auth-server');

function checkPermission(req: Request, res: Response, ...required: string[]): boolean {
  const perms = permissionsFromClaims(req.authClaims);
  const hasAny = required.some((p) => claimHasPermission(perms, p));
  if (!hasAny) {
    log.warn(
      { functionName: 'checkPermission', path: req.path, required },
      'auth-server:admin-feature-routes:checkPermission - Insufficient permissions',
    );
    res.status(403).json({ error: 'forbidden', error_description: 'Insufficient permissions' });
  }
  return hasAny;
}

export default function createAdminFeatureRoutes(app: Application): void {
  // ==========================================================================
  // Feature catalogue
  // ==========================================================================

  app.get('/admin/features', requireAuth(), async (req: Request, res: Response) => {
    try {
      if (!checkPermission(req, res, 'features.manage')) return;
      const db = getDb();
      const rows = await listFeatures(db);
      log.info({ functionName: 'GET /admin/features', count: rows.length }, 'auth-server:admin-feature-routes:listFeatures - Listed features');
      res.json({ data: rows });
    } catch (err: any) {
      log.error({ functionName: 'GET /admin/features', error: err.message }, 'auth-server:admin-feature-routes:listFeatures - Error');
      res.status(500).json({ error: 'server_error', error_description: err.message });
    }
  });

  app.post('/admin/features', requireAuth(), async (req: Request, res: Response) => {
    try {
      if (!checkPermission(req, res, 'features.manage')) return;
      const db = getDb();
      const normalized = normalizeFeatureBody(req.body ?? {});
      if (!normalized.featureKey) {
        res.status(400).json({ error: 'bad_request', error_description: 'featureKey is required' });
        return;
      }
      const row = await createFeature(db, {
        featureKey: normalized.featureKey,
        defaultEnabled: normalized.defaultEnabled,
        label: normalized.label,
        description: normalized.description,
      });
      clearFeatureCatalogueCache();
      log.info({ functionName: 'POST /admin/features', id: row.id }, 'auth-server:admin-feature-routes:createFeature - Created feature');
      res.status(201).json({ data: row });
    } catch (err: any) {
      log.error({ functionName: 'POST /admin/features', error: err.message }, 'auth-server:admin-feature-routes:createFeature - Error');
      res.status(500).json({ error: 'server_error', error_description: err.message });
    }
  });

  app.patch('/admin/features/:featureId', requireAuth(), async (req: Request, res: Response) => {
    try {
      if (!checkPermission(req, res, 'features.manage')) return;
      const db = getDb();
      const normalized = normalizeFeatureBody(req.body ?? {});
      const row = await updateFeature(db, req.params.featureId, {
        ...(normalized.featureKey !== undefined ? { featureKey: normalized.featureKey } : {}),
        ...(normalized.defaultEnabled !== undefined ? { defaultEnabled: normalized.defaultEnabled } : {}),
        ...(normalized.label !== undefined ? { label: normalized.label } : {}),
        ...(normalized.description !== undefined ? { description: normalized.description } : {}),
      });
      if (!row) {
        res.status(404).json({ error: 'not_found', error_description: 'Feature not found' });
        return;
      }
      clearFeatureCatalogueCache();
      log.info({ functionName: 'PATCH /admin/features/:id', id: row.id }, 'auth-server:admin-feature-routes:updateFeature - Updated feature');
      res.json({ data: row });
    } catch (err: any) {
      log.error({ functionName: 'PATCH /admin/features/:id', error: err.message }, 'auth-server:admin-feature-routes:updateFeature - Error');
      res.status(500).json({ error: 'server_error', error_description: err.message });
    }
  });

  app.delete('/admin/features/:featureId', requireAuth(), async (req: Request, res: Response) => {
    try {
      if (!checkPermission(req, res, 'features.manage')) return;
      const db = getDb();
      const deleted = await deleteFeature(db, req.params.featureId);
      if (!deleted) {
        res.status(404).json({ error: 'not_found', error_description: 'Feature not found' });
        return;
      }
      clearFeatureCatalogueCache();
      log.info({ functionName: 'DELETE /admin/features/:id', id: req.params.featureId }, 'auth-server:admin-feature-routes:deleteFeature - Deleted feature');
      res.status(204).end();
    } catch (err: any) {
      log.error({ functionName: 'DELETE /admin/features/:id', error: err.message }, 'auth-server:admin-feature-routes:deleteFeature - Error');
      res.status(500).json({ error: 'server_error', error_description: err.message });
    }
  });

  // ==========================================================================
  // Feature grants
  // ==========================================================================

  app.get('/admin/features/grants', requireAuth(), async (req: Request, res: Response) => {
    try {
      if (!checkPermission(req, res, 'features.manage')) return;
      const db = getDb();
      const { scope, scopeId, scope_id } = req.query as Record<string, string | undefined>;
      const rows = await listGrants(db, { scope, scopeId: scopeId ?? scope_id });
      log.info({ functionName: 'GET /admin/features/grants', count: rows.length }, 'auth-server:admin-feature-routes:listGrants - Listed grants');
      res.json({ data: rows });
    } catch (err: any) {
      log.error({ functionName: 'GET /admin/features/grants', error: err.message }, 'auth-server:admin-feature-routes:listGrants - Error');
      res.status(500).json({ error: 'server_error', error_description: err.message });
    }
  });

  app.put('/admin/features/:featureId/grants', requireAuth(), async (req: Request, res: Response) => {
    try {
      if (!checkPermission(req, res, 'features.manage')) return;
      const db = getDb();
      const { featureId } = req.params;
      const { scope, scopeId, scope_id, enabled } = req.body;
      const row = await setGrant(db, {
        featureId,
        scope,
        scopeId: scopeId ?? scope_id,
        enabled: enabled !== false,
      });
      log.info({ functionName: 'PUT /admin/features/:id/grants', id: row.id }, 'auth-server:admin-feature-routes:setGrant - Upserted grant');
      res.json({ data: row });
    } catch (err: any) {
      log.error({ functionName: 'PUT /admin/features/:id/grants', error: err.message }, 'auth-server:admin-feature-routes:setGrant - Error');
      res.status(500).json({ error: 'server_error', error_description: err.message });
    }
  });

  app.delete('/admin/features/:featureId/grants/:grantId', requireAuth(), async (req: Request, res: Response) => {
    try {
      if (!checkPermission(req, res, 'features.manage')) return;
      const db = getDb();
      const deleted = await removeGrant(db, req.params.grantId);
      if (!deleted) {
        res.status(404).json({ error: 'not_found', error_description: 'Grant not found' });
        return;
      }
      log.info({ functionName: 'DELETE /admin/features/:id/grants/:grantId', grantId: req.params.grantId }, 'auth-server:admin-feature-routes:removeGrant - Removed grant');
      res.status(204).end();
    } catch (err: any) {
      log.error({ functionName: 'DELETE /admin/features/:id/grants/:grantId', error: err.message }, 'auth-server:admin-feature-routes:removeGrant - Error');
      res.status(500).json({ error: 'server_error', error_description: err.message });
    }
  });

  // ==========================================================================
  // Feature resolution (admin preview)
  // ==========================================================================

  app.get('/admin/features/resolve', requireAuth(), async (req: Request, res: Response) => {
    try {
      if (!checkPermission(req, res, 'features.manage')) return;
      const organizationId = (req.query.organizationId ?? req.query.organization_id ?? req.organizationId) as string | undefined;
      const userId = (req.query.userId ?? req.query.user_id ?? req.userId) as string | undefined;

      if (!organizationId || !userId) {
        res.status(400).json({ error: 'bad_request', error_description: 'organizationId and userId are required' });
        return;
      }

      const resolved = await resolveFeatures({ organizationId, userId });
      log.info(
        { functionName: 'GET /admin/features/resolve', count: resolved.features.length },
        'auth-server:admin-feature-routes:resolveFeatures - Resolved features',
      );
      res.json({ data: resolved });
    } catch (err: any) {
      log.error({ functionName: 'GET /admin/features/resolve', error: err.message }, 'auth-server:admin-feature-routes:resolveFeatures - Error');
      res.status(500).json({ error: 'server_error', error_description: err.message });
    }
  });
}
