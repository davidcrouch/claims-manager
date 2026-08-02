import { Application, Request, Response } from 'express';
import { createLogger, LoggerType } from '../lib/logger.js';
import { createTelemetryLogger } from '@morezero/telemetry';
import { requireAuth, permissionsFromClaims, claimHasPermission } from '../middleware/jwt-auth.js';
import { inviteUser } from '../services/invitation-service.js';

const baseLogger = createLogger('auth-server:admin-user-routes', LoggerType.NODEJS);
const log = createTelemetryLogger(baseLogger, 'admin-user-routes', 'AdminUserRoutes', 'auth-server');

function checkPermission(req: Request, res: Response, ...required: string[]): boolean {
  const perms = permissionsFromClaims(req.authClaims);
  const hasAny = required.some((p) => claimHasPermission(perms, p));
  if (!hasAny) {
    log.warn(
      { functionName: 'checkPermission', path: req.path, required },
      'auth-server:admin-user-routes:checkPermission - Insufficient permissions',
    );
    res.status(403).json({ error: 'forbidden', error_description: 'Insufficient permissions' });
  }
  return hasAny;
}

export default function createAdminUserRoutes(app: Application): void {
  app.post('/admin/users/invite', requireAuth(), async (req, res) => {
    if (!checkPermission(req, res, 'org.users.manage')) return;

    const userId = req.userId;
    const organizationId = req.organizationId;

    if (!userId || !organizationId) {
      log.warn(
        {},
        'auth-server:admin-user-routes:invite - Missing userId or organizationId from JWT',
      );
      res.status(401).json({ error: 'Authentication required with organization context' });
      return;
    }

    const { email, givenName, familyName, roles } = req.body;

    if (!email) {
      res.status(400).json({ error: 'email is required' });
      return;
    }
    if (!roles || !Array.isArray(roles) || roles.length === 0) {
      res.status(400).json({ error: 'roles must be a non-empty array' });
      return;
    }

    try {
      const result = await inviteUser({
        email,
        givenName,
        familyName,
        roles,
        organizationId,
        invitedByUserId: userId,
      });

      log.info(
        { email, userId: result.userId, organizationId },
        'auth-server:admin-user-routes:invite - User invited successfully',
      );

      res.status(201).json(result);
    } catch (error: any) {
      log.error(
        { email, error: error.message },
        'auth-server:admin-user-routes:invite - Failed to invite user',
      );
      res.status(500).json({ error: error.message || 'Failed to invite user' });
    }
  });
}
