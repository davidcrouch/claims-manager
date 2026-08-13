import { Application, Request, Response, NextFunction } from 'express';
import { createLogger, LoggerType } from '../lib/logger.js';
import { createTelemetryLogger } from '@morezero/telemetry';
import { getOidcIssuer } from '../config/env-validation.js';
import { requireAuth } from '../middleware/jwt-auth.js';
import '../types/index.js';

const baseLogger = createLogger('auth-server:iat-routes', LoggerType.NODEJS);
const log = createTelemetryLogger(baseLogger, 'iat-routes', 'IatRoutes', 'auth-server');

/** Lifetime of an issued IAT, in seconds. */
const IAT_EXPIRES_IN_SECONDS = 10 * 60;

/**
 * Mount the `/oauth/initial-access-token` and `/oauth/validate-iat` routes.
 *
 * IATs are minted through the oidc-provider's own `InitialAccessToken` model so
 * they are stored in the configured adapter (Upstash/Redis). Custom-signed
 * HS256 JWTs are not accepted by `/reg`.
 */
export default function createIatRoutes(app: Application, provider: any): void {
   // SECURITY (F-16): minting a DCR initial access token is privileged.
   app.post(
      '/oauth/initial-access-token',
      requireAuth({
         permissions: ['org.integrations.manage', 'platform.integrations.manage'],
         scopes: ['dcr:register'],
      }),
      async (req: Request, res: Response, _next: NextFunction) => {
         log.info(
            {
               method: req.method,
               path: req.path,
               clientIP: req.ip,
               userAgent: req.headers['user-agent'],
            },
            'auth-server:iat-routes:initialAccessToken - IAT issuance request received',
         );

         try {
            const userId = req.userId || req.user?.userId;
            const organizationId = req.organizationId || req.user?.organizationId;

            if (!userId || !organizationId) {
               log.warn(
                  { functionName: 'issueIAT', userId, organizationId },
                  'auth-server:iat-routes:initialAccessToken - Missing user or organization information for IAT request',
               );
               return res.status(401).json({
                  error: 'unauthorized',
                  error_description: 'Authentication required',
               });
            }

            const authIssuer = getOidcIssuer();

            const iatEntity = new provider.InitialAccessToken({
               expiresIn: IAT_EXPIRES_IN_SECONDS,
            });
            (iatEntity as any).organizationId = organizationId;
            (iatEntity as any).createdByUserId = userId;
            const iat: string = await iatEntity.save();

            log.info(
               {
                  functionName: 'issueIAT',
                  userId,
                  organizationId,
                  expiresIn: IAT_EXPIRES_IN_SECONDS,
                  jti: iatEntity.jti,
               },
               'auth-server:iat-routes:initialAccessToken - IAT issued successfully for organization',
            );

            return res.json({
               initial_access_token: iat,
               as_reg_endpoint: `${authIssuer.replace(/\/$/, '')}/reg`,
               expires_in: IAT_EXPIRES_IN_SECONDS,
               token_type: 'Bearer',
            });
         } catch (error) {
            log.error(
               {
                  functionName: 'issueIAT',
                  error: (error as Error).message,
                  stack: (error as Error).stack,
               },
               'auth-server:iat-routes:initialAccessToken - Failed to issue IAT',
            );
            return res.status(500).json({
               error: 'server_error',
               error_description: 'Failed to issue IAT',
            });
         }
      },
   );

   app.post('/oauth/validate-iat', async (req: Request, res: Response, _next: NextFunction) => {
      log.info(
         { method: req.method, path: req.path, clientIP: req.ip },
         'auth-server:iat-routes:validateIat - IAT validation request received',
      );

      try {
         const authHeader = req.headers.authorization;
         if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
               error: 'unauthorized',
               error_description: 'Bearer token required',
            });
         }
         const token = authHeader.substring(7).trim();
         if (!token) {
            return res.status(401).json({
               error: 'unauthorized',
               error_description: 'Bearer token required',
            });
         }

         const iat = await provider.InitialAccessToken.find(token);
         if (!iat) {
            return res.status(401).json({
               error: 'invalid_token',
               error_description: 'Initial access token not found or expired',
            });
         }

         const now = Math.floor(Date.now() / 1000);
         const expiresIn = typeof iat.exp === 'number' ? Math.max(0, iat.exp - now) : null;

         log.info(
            { functionName: 'validateIAT', jti: iat.jti, expiresIn },
            'auth-server:iat-routes:validateIat - IAT validated successfully',
         );

         return res.json({
            valid: true,
            expires_in: expiresIn,
         });
      } catch (error) {
         log.error(
            {
               functionName: 'validateIAT',
               error: (error as Error).message,
               stack: (error as Error).stack,
            },
            'auth-server:iat-routes:validateIat - IAT validation failed',
         );
         return res.status(401).json({
            error: 'invalid_token',
            error_description: 'Invalid IAT token',
         });
      }
   });

   log.info(
      { routesCreated: true, routeType: 'iat' },
      'auth-server:iat-routes:createIatRoutes - IAT routes created successfully',
   );
}
