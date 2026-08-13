/**
 * POST /api/auth/switch-org
 *
 * Allows an authenticated user to switch their active organization without
 * re-entering credentials. Updates the stored auth context in Redis so that
 * subsequent token refreshes produce a JWT scoped to the new org's
 * roles/permissions.
 *
 * Body: { organizationId: string } (organisationId also accepted)
 */

import { Application, Request, Response } from 'express';
import { createLogger, LoggerType } from '../lib/logger.js';
import { createTelemetryLogger } from '@morezero/telemetry';
import { jwtAuthForIAT } from '../middleware/jwt-auth.js';
import {
  getOrganizationsForUser,
  createAuthResult,
} from '../services/organization-resolution-service.js';
import { storeAuthResult, getStoredAuthResult } from '../config/oidc-provider.js';

const baseLogger = createLogger('auth-server:switch-org-routes', LoggerType.NODEJS);
const log = createTelemetryLogger(baseLogger, 'switch-org-routes', 'SwitchOrgRoutes', 'auth-server');

const LOG_PREFIX = 'auth-server:switch-org-routes';

export default function createSwitchOrgRoutes(app: Application): void {
  app.post('/api/auth/switch-org', jwtAuthForIAT, async (req: Request, res: Response) => {
    const functionName = 'switchOrg';
    const userId = req.userId;

    if (!userId) {
      return res.status(401).json({
        error: 'unauthorized',
        error_description: 'User identity not resolved from token',
      });
    }

    const body = (req.body ?? {}) as Record<string, unknown>;
    const targetOrgId =
      (typeof body.organizationId === 'string' ? body.organizationId.trim() : '') ||
      (typeof body.organisationId === 'string' ? body.organisationId.trim() : '');

    if (!targetOrgId) {
      return res.status(400).json({
        error: 'invalid_request',
        error_description: 'organizationId is required',
      });
    }

    try {
      const userOrgs = await getOrganizationsForUser(userId);
      const targetOrg = userOrgs.find((o) => o.id === targetOrgId);

      if (!targetOrg) {
        log.warn(
          { functionName, userId, targetOrgId, availableOrgs: userOrgs.map((o) => o.id) },
          `${LOG_PREFIX}.switchOrg - User is not a member of target organisation`,
        );
        return res.status(403).json({
          error: 'forbidden',
          error_description: 'User is not a member of the target organisation',
        });
      }

      const existingAuth = await getStoredAuthResult(userId);
      const email = existingAuth?.user?.email ?? (req.authClaims?.email as string) ?? '';
      const name = existingAuth?.user?.name ?? (req.authClaims?.name as string) ?? '';
      const provider = existingAuth?.user?.provider ?? 'password';

      const authResult = createAuthResult({
        userId,
        email,
        name,
        provider,
        organizationId: targetOrgId,
      });

      await storeAuthResult(userId, authResult);

      log.info(
        { functionName, userId, targetOrgId },
        `${LOG_PREFIX}.switchOrg - Auth context switched successfully`,
      );

      return res.status(200).json({
        success: true,
        organizationId: targetOrgId,
      });
    } catch (err: any) {
      log.error(
        { functionName, userId, targetOrgId, error: err.message, stack: err.stack },
        `${LOG_PREFIX}.switchOrg - Failed to switch organisation`,
      );
      return res.status(500).json({
        error: 'server_error',
        error_description: 'Failed to switch organisation',
      });
    }
  });
}
