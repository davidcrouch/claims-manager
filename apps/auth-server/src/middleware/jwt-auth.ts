/**
 * JWT auth middleware for IAT route and general auth.
 * Validates Bearer JWT from auth-server's own issuer, extracts sub -> userId
 * and organization_id -> organizationId for IAT issuance.
 */
import { Request, Response, NextFunction } from 'express';
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';
import { createLogger, LoggerType } from '../lib/logger.js';
import { createTelemetryLogger } from '@morezero/telemetry';
import { getOidcIssuer, getEnvVar, getEnvVarWithDefault, getJwtExpectedAudience } from '../config/env-validation.js';

const baseLogger = createLogger('auth-server:jwt-auth', LoggerType.NODEJS);
const log = createTelemetryLogger(baseLogger, 'jwt-auth', 'JwtAuth', 'auth-server');

/**
 * Returns the URL to fetch this auth-server's own JWKS from.
 * Uses loopback to avoid DNS issues inside containers.
 */
function getSelfJwksUrl(): string {
   const override = getEnvVar('AUTH_INTERNAL_JWKS_URL');
   if (override) return override;
   const port = getEnvVarWithDefault('PORT', '3001');
   return `http://127.0.0.1:${port}/jwks`;
}

declare global {
   namespace Express {
      interface Request {
         userId?: string;
         organizationId?: string;
         authClaims?: JWTPayload;
      }
   }
}

function parseExpectedAudiences(raw: string | undefined): string[] {
   if (!raw) return [];
   return raw
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
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
   const jwks = createRemoteJWKSet(new URL(getSelfJwksUrl()));

   const expectedAudiences = parseExpectedAudiences(getJwtExpectedAudience());
   if (expectedAudiences.length === 0 && process.env.NODE_ENV === 'production') {
      log.error(
         { functionName: 'jwtAuthForIAT' },
         'auth-server:jwt-auth:jwtAuthForIAT - JWT_EXPECTED_AUDIENCE missing in production',
      );
      res.status(401).json({
         error: 'invalid_token',
         error_description: 'Invalid or expired token',
      });
      return;
   }
   const verifyOptions: Parameters<typeof jwtVerify>[2] = {
      issuer,
      algorithms: ['RS256', 'ES256'],
      clockTolerance: 30,
   };
   if (expectedAudiences.length === 1) {
      verifyOptions.audience = expectedAudiences[0];
   } else if (expectedAudiences.length > 1) {
      verifyOptions.audience = expectedAudiences;
   }

   jwtVerify(token, jwks, verifyOptions)
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
         req.authClaims = payload;
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

/**
 * Extracts the space-delimited `scope` claim (OAuth 2.0) into a Set.
 */
function scopesFromClaims(claims: JWTPayload | undefined): Set<string> {
   const raw = (claims?.scope ?? (claims as any)?.scp) as unknown;
   if (typeof raw === 'string') {
      return new Set(raw.split(/\s+/).filter(Boolean));
   }
   if (Array.isArray(raw)) {
      return new Set(raw.filter((s): s is string => typeof s === 'string'));
   }
   return new Set();
}

/**
 * Returns the org-role names carried on a validated service/user token.
 */
export function rolesFromClaims(claims: JWTPayload | undefined): Set<string> {
   const out = new Set<string>();
   const flat = (claims as any)?.roles;
   if (Array.isArray(flat)) {
      for (const r of flat) if (typeof r === 'string') out.add(r);
   }
   const orgRoles = (claims as any)?.org_roles;
   if (Array.isArray(orgRoles)) {
      for (const r of orgRoles) if (typeof r === 'string') out.add(r);
   } else if (orgRoles && typeof orgRoles === 'object') {
      for (const list of Object.values(orgRoles)) {
         if (Array.isArray(list)) for (const r of list) if (typeof r === 'string') out.add(r);
      }
   }
   return out;
}

/**
 * Returns permission names carried on a validated token (`permissions` claim).
 */
export function permissionsFromClaims(claims: JWTPayload | undefined): string[] {
   const raw = (claims as any)?.permissions;
   if (!Array.isArray(raw)) return [];
   return raw.filter((p): p is string => typeof p === 'string');
}

/**
 * Wildcard-aware permission match:
 *   - '*'           matches everything
 *   - 'org.*'       matches 'org.manage', 'org.users.invite', etc.
 *   - 'deals.read'  matches exactly 'deals.read'
 */
export function claimHasPermission(held: string[], required: string): boolean {
   for (const perm of held) {
      if (perm === '*') return true;
      if (perm === required) return true;
      if (perm.endsWith('.*')) {
         const prefix = perm.slice(0, -1);
         if (required.startsWith(prefix)) return true;
      }
   }
   return false;
}

/**
 * Middleware factory that first authenticates the Bearer JWT (via
 * jwtAuthForIAT) and then authorizes the request.
 *
 * Authorization (OR across categories - any one match is enough):
 *   - `scopes`      - OAuth/OIDC scopes on the token
 *   - `permissions` - soft-configured RBAC permissions (preferred)
 *   - `roles`       - legacy role-name gate (deprecated; prefer permissions)
 *
 * When no scopes/permissions/roles are specified, authentication alone is enough.
 */
export function requireAuth(options: {
   scopes?: string[];
   permissions?: string[];
   roles?: string[];
} = {}) {
   const requiredScopes = options.scopes ?? [];
   const requiredPermissions = options.permissions ?? [];
   const allowedRoles = options.roles ?? [];
   return function requireAuthMiddleware(req: Request, res: Response, next: NextFunction): void {
      jwtAuthForIAT(req, res, () => {
         if (
            requiredScopes.length === 0 &&
            requiredPermissions.length === 0 &&
            allowedRoles.length === 0
         ) {
            next();
            return;
         }
         const scopes = scopesFromClaims(req.authClaims);
         const perms = permissionsFromClaims(req.authClaims);
         const roles = rolesFromClaims(req.authClaims);
         const hasScope = requiredScopes.some((s) => scopes.has(s));
         const hasPermission = requiredPermissions.some((p) => claimHasPermission(perms, p));
         const hasRole = allowedRoles.some((r) => roles.has(r));
         if (hasScope || hasPermission || hasRole) {
            next();
            return;
         }
         log.warn({
            functionName: 'requireAuth',
            path: req.path,
            requiredScopes,
            requiredPermissions,
            allowedRoles
         }, 'auth-server:jwt-auth:requireAuth - Token lacks required scope/permission/role');
         res.status(403).json({
            error: 'forbidden',
            error_description: 'Insufficient scope or permission for this operation'
         });
      });
   };
}
