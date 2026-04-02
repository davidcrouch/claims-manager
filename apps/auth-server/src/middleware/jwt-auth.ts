/**
 * JWT auth middleware for IAT route.
 * Validates Bearer JWT from auth-server's own issuer, extracts sub → userId
 * and organization_id → organizationId for IAT issuance.
 */
import { Request, Response, NextFunction } from 'express';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { createLogger, LoggerType } from '../lib/logger.js';
import { createTelemetryLogger } from '@morezero/telemetry';
import { getOidcIssuer } from '../config/env-validation.js';

const baseLogger = createLogger('auth-server:jwt-auth', LoggerType.NODEJS);
const log = createTelemetryLogger(baseLogger, 'jwt-auth', 'JwtAuth', 'auth-server');

declare global {
   namespace Express {
      interface Request {
         userId?: string;
         organizationId?: string;
      }
   }
}

/**
 * Middleware that validates Bearer JWT and sets req.userId, req.organizationId.
 * Uses auth-server's JWKS endpoint for verification (same keys as OIDC provider).
 */
export function jwtAuthForIAT(req: Request, res: Response, next: NextFunction): void {
   const authHeader = req.headers.authorization;
   if (!authHeader || !authHeader.startsWith('Bearer ')) {
      log.warn({ functionName: 'jwtAuthForIAT', path: req.path }, 'auth-server:jwt-auth:jwtAuthForIAT - Missing Bearer token');
      res.status(401).json({
         error: 'unauthorized',
         error_description: 'Bearer token required'
      });
      return;
   }

   const token = authHeader.substring(7);
   if (!token.trim()) {
      log.warn({ functionName: 'jwtAuthForIAT', path: req.path }, 'auth-server:jwt-auth:jwtAuthForIAT - Empty Bearer token');
      res.status(401).json({
         error: 'unauthorized',
         error_description: 'Bearer token required'
      });
      return;
   }

   const issuer = getOidcIssuer().replace(/\/$/, '');
   const jwks = createRemoteJWKSet(new URL(`${issuer}/jwks`));

   jwtVerify(token, jwks, {
      issuer,
      algorithms: ['RS256', 'ES256'],
      clockTolerance: 30
   })
      .then(({ payload }) => {
         const sub = payload.sub as string | undefined;
         const organizationId = payload.organization_id as string | undefined;

         if (!sub) {
            log.warn({ functionName: 'jwtAuthForIAT' }, 'auth-server:jwt-auth:jwtAuthForIAT - Token missing sub claim');
            res.status(401).json({
               error: 'unauthorized',
               error_description: 'Token missing subject claim'
            });
            return;
         }
         req.userId = sub;
         req.organizationId = organizationId;
         log.debug({ functionName: 'jwtAuthForIAT', userId: sub, organizationId }, 'auth-server:jwt-auth:jwtAuthForIAT - JWT validated');
         next();
      })
      .catch((err: any) => {
         log.warn({
            functionName: 'jwtAuthForIAT',
            error: err?.message,
            code: err?.code,
            claim: err?.claim,
            reason: err?.reason
         }, 'auth-server:jwt-auth:jwtAuthForIAT - JWT verification failed');
         res.status(401).json({
            error: 'invalid_token',
            error_description: 'Invalid or expired token'
         });
      });
}
