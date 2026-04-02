import { Application, Request, Response, NextFunction } from 'express';
import { SignJWT, jwtVerify } from 'jose';
import { createLogger, LoggerType } from '../lib/logger.js';
import { createTelemetryLogger } from '@morezero/telemetry';
import { getIatSigningKey, getOidcIssuer } from '../config/env-validation.js';
import { jwtAuthForIAT } from '../middleware/jwt-auth.js';
import '../types/index.js';

const baseLogger = createLogger('auth-server:iat-routes', LoggerType.NODEJS);
const log = createTelemetryLogger(baseLogger, 'iat-routes', 'IatRoutes', 'auth-server');

/** Scopes granted to API key clients created via IAT + DCR */
const API_KEY_IAT_SCOPES = ['mcp:read', 'mcp:write', 'mcp:invoke', 'registry:read', 'registry:import', 'registry:admin'];

export default function createIatRoutes(app: Application): void {
   // Issue Initial Access Token for Dynamic Client Registration (requires Bearer user JWT)
   app.post('/oauth/initial-access-token', jwtAuthForIAT, async (req: Request, res: Response, next: NextFunction) => {
      log.info({
         method: req.method,
         path: req.path,
         clientIP: req.ip,
         userAgent: req.headers['user-agent']
      }, 'IAT issuance request received');

      try {
         // Extract user info from request (assuming you have auth middleware)
         const userId = req.userId || req.user?.userId;
         const organizationId = req.organizationId || req.user?.organizationId;
         
         if (!userId || !organizationId) {
            log.warn({ functionName: 'issueIAT', userId, organizationId }, 'Missing user or organization information for IAT request');
            return res.status(401).json({ 
               error: 'unauthorized',
               error_description: 'Authentication required' 
            });
         }

         // Get IAT signing key from environment
         const iatSigningKey = getIatSigningKey();
         if (!iatSigningKey) {
            log.error({ 
               missingConfig: true,
               configKey: 'DCR_IAT_SIGNING_KEY'
            }, 'DCR_IAT_SIGNING_KEY environment variable not set');
            return res.status(500).json({ 
               error: 'server_error',
               error_description: 'IAT signing key not configured'
            });
         }

         // Get auth server URL
         const authIssuer = getOidcIssuer();
         const baseUrl = `${req.protocol}://${req.get('host')}`;

         // Create IAT payload with policy constraints (includes registry scopes for API keys)
         const iatPayload = {
            typ: 'dcr-iat',
            organization_id: organizationId,
            uid: userId,
            scopes: API_KEY_IAT_SCOPES,
            max_clients: 10, // Limit number of clients per organization
            allowed_grant_types: ['client_credentials'], // Only allow M2M
            allowed_auth_methods: ['client_secret_basic', 'private_key_jwt'],
            iat: Math.floor(Date.now() / 1000),
            exp: Math.floor(Date.now() / 1000) + (10 * 60), // 10 minutes
            iss: baseUrl,
            aud: `${authIssuer}/reg`
         };

         // Sign the IAT
         const iat = await new SignJWT(iatPayload)
            .setProtectedHeader({ 
               alg: 'HS256', 
               kid: 'dcr-issuer',
               typ: 'JWT'
            })
            .setIssuer(baseUrl)
            .setAudience(`${authIssuer}/reg`)
            .setExpirationTime('10m')
            .sign(Buffer.from(iatSigningKey, 'base64'));

         log.info({ 
            userId, 
            organizationId, 
            expiresIn: 600 
         }, 'IAT issued successfully for organization');

         res.json({
            initial_access_token: iat,
            as_reg_endpoint: `${authIssuer}/reg`,
            expires_in: 600,
            token_type: 'Bearer'
         });

      } catch (error) {
         log.error({ functionName: 'issueIAT', error: error.message, stack: error.stack }, 'Failed to issue IAT');
         
         res.status(500).json({ 
            error: 'server_error',
            error_description: 'Failed to issue IAT' 
         });
      }
   });

   // Validate an Initial Access Token
   app.post('/oauth/validate-iat', async (req: Request, res: Response, next: NextFunction) => {
      log.info({
         method: req.method,
         path: req.path,
         clientIP: req.ip
      }, 'IAT validation request received');

      try {
         const authHeader = req.headers.authorization;
         if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ 
               error: 'unauthorized',
               error_description: 'Bearer token required' 
            });
         }

         const token = authHeader.substring(7);
         
         // Verify the IAT token
         const iatSigningKey = getIatSigningKey();
         if (!iatSigningKey) {
            return res.status(500).json({ 
               error: 'server_error',
               error_description: 'IAT signing key not configured' 
            });
         }

         const baseUrl = `${req.protocol}://${req.get('host')}`;
         const authIssuer = getOidcIssuer();

         const { payload } = await jwtVerify(token, Buffer.from(iatSigningKey, 'base64'), {
            issuer: baseUrl,
            audience: `${authIssuer}/reg`
         });

         log.info({ 
            organizationId: payload.organization_id, 
            userId: payload.uid,
            scopes: payload.scopes 
         }, 'IAT validated successfully');

         res.json({
            valid: true,
            claims: payload,
            expires_in: payload.exp - Math.floor(Date.now() / 1000)
         });

      } catch (error) {
         log.error({ functionName: 'validateIAT', error: error.message, stack: error.stack }, 'IAT validation failed');
         
         res.status(401).json({ 
            error: 'invalid_token',
            error_description: 'Invalid IAT token' 
         });
      }
   });

   log.info({ 
      routesCreated: true,
      routeType: 'iat'
   }, 'IAT routes created successfully');
}
