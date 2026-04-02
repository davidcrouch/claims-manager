/**
 * =============================================================================
 * SIGNUP ROUTES MODULE
 * =============================================================================
 * 
 * Handles application signup requests using the unified IdentityRegistrationService.
 * All identity providers (password, OAuth, etc.) use the same service.
 * 
 * Flow:
 * 1. Frontend (app.more0.dev) calls bffapi
 * 2. bffapi calls auth-server (auth.more0.dev) with Origin header
 * 3. auth-server uses IdentityRegistrationService to:
 *    a. Create user and user_identity records
 *    b. Delegate business/account provisioning to api-server
 * 4. Returns registration result to frontend
 */

import { Application, Request, Response, NextFunction } from 'express';
import { createLogger, LoggerType } from '../lib/logger.js';
import { createTelemetryLogger } from '@morezero/telemetry';
import { 
   registerIdentity,
   type IdentityRegistrationInput,
   type IdentityProvider
} from '../services/identity-registration-service.js';

const baseLogger = createLogger('auth-server:signup-routes', LoggerType.NODEJS);
const log = createTelemetryLogger(baseLogger, 'signup-routes', 'SignupRoutes', 'auth-server');

/**
 * Extract subdomain from a URL or host string
 * @param urlOrHost - Full URL (https://app.more0.dev) or host (app.more0.dev)
 * @returns The subdomain (e.g., "app") or null if not found
 */
function extractSubdomain(urlOrHost: string | undefined): string | null {
   if (!urlOrHost) return null;

   try {
      let host: string;
      if (urlOrHost.startsWith('http://') || urlOrHost.startsWith('https://')) {
         const url = new URL(urlOrHost);
         host = url.hostname;
      } else {
         host = urlOrHost;
      }

      const parts = host.split('.');
      if (parts.length >= 3) {
         return parts[0];
      }
      return null;
   } catch (error) {
      log.warn({ urlOrHost, error: error instanceof Error ? error.message : String(error) }, 
         'auth-server:signup-routes:extractSubdomain - Failed to extract subdomain');
      return null;
   }
}

/**
 * Creates and configures signup routes for the auth server.
 * 
 * @param app - Express Application instance
 */
export default function createSignupRoutes(app: Application): void {

   /**
    * POST /api/auth/signup - Unified signup endpoint
    * 
    * Handles registration for all identity providers using the unified
    * IdentityRegistrationService.
    * 
    * Request Headers:
    * - Origin: The originating frontend URL (e.g., https://app.more0.dev)
    * - Referer: Fallback for Origin header
    * - x-more0-app-slug: Application slug for app identification (preferred)
    * - x-application-id: Direct application ID (optional)
    * - x-client-id: Client ID for application lookup (optional)
    * 
    * Request Body:
    * - email: User's email address (required)
    * - password: User's password (required for password provider)
    * - firstName: User's first name (optional)
    * - lastName: User's last name (optional)
    * - name: User's full name (optional)
    * - company/organizationName: Organization/company name (optional)
    * - organizationId: Existing organization ID (optional)
    * - provider: Identity provider (optional, defaults to 'password')
    * - providerUserId: Provider user ID (optional, for OAuth)
    * - acceptTerms: Terms acceptance flag (required for password)
    */
   app.post('/api/auth/signup', async (req: Request, res: Response, next: NextFunction) => {
      const functionName = 'signup';
      
      try {
         const origin = req.headers.origin as string | undefined;
         const referer = req.headers.referer as string | undefined;
         const appSlug = req.headers['x-more0-app-slug'] as string | undefined;
         const applicationId = req.headers['x-application-id'] as string | undefined;
         const clientId = req.headers['x-client-id'] as string | undefined;
         
         const {
            email,
            password,
            firstName,
            lastName,
            name,
            company,
            organizationName,
            organizationId,
            provider = 'password' as IdentityProvider,
            providerUserId,
            acceptTerms
         } = req.body;
         
         log.info({
            functionName,
            email,
            provider,
            hasPassword: !!password,
            hasOrganizationName: !!organizationName || !!company,
            origin,
            applicationId: applicationId ? 'present' : 'missing'
         }, 'auth-server:signup-routes:signup - Signup request received');

         // Validate terms acceptance for password registration
         if (provider === 'password' && !acceptTerms) {
            return res.status(400).json({
               error: 'TERMS_NOT_ACCEPTED',
               message: 'You must accept the terms of service to register'
            });
         }

         // Determine subdomain/application context
         // Priority: x-more0-app-slug header > subdomain from origin > fallback headers
         const subdomain = appSlug || extractSubdomain(origin) || extractSubdomain(referer);
         
         if (!subdomain && !applicationId && !clientId) {
            log.error({ functionName, origin, referer, appSlug }, 
               'auth-server:signup-routes:signup - Could not determine application context');
            return res.status(400).json({
               error: 'INVALID_REQUEST',
               message: 'Could not determine application context. x-more0-app-slug, Origin header, or x-application-id/x-client-id header is required.'
            });
         }

         // Build registration input
         const registrationInput: IdentityRegistrationInput = {
            provider: provider as IdentityProvider,
            providerUserId: provider === 'password' ? email : (providerUserId || email),
            credentials: provider === 'password' ? { password } : undefined,
            profile: {
               email,
               name: name || `${firstName || ''} ${lastName || ''}`.trim() || undefined,
               firstName,
               lastName
            },
            organizationContext: {
               organizationName: organizationName || company,
               organizationId,
               applicationId: applicationId || undefined
            },
            origin
         };

         // Call unified registration service
         const result = await registerIdentity(registrationInput);

         if (!result.success) {
            log.warn({
               functionName,
               email,
               error: result.error,
               errorCode: result.errorCode
            }, 'auth-server:signup-routes:signup - Registration failed');

            const statusCode = result.errorCode === 'EMAIL_ALREADY_EXISTS' || 
                              result.errorCode === 'IDENTITY_ALREADY_EXISTS' 
                              ? 409 : 400;

            return res.status(statusCode).json({
               error: result.errorCode || 'REGISTRATION_FAILED',
               message: result.error || 'Registration failed'
            });
         }

         log.info({
            functionName,
            userId: result.userId,
            organizationId: result.organizationId
         }, 'auth-server:signup-routes:signup - Registration completed successfully');

         return res.status(201).json({
            success: true,
            userId: result.userId,
            organizationId: result.organizationId
         });

      } catch (error: any) {
         log.error({
            functionName,
            error: error.message,
            stack: error.stack
         }, 'auth-server:signup-routes:signup - Signup request failed');

         return res.status(500).json({
            error: 'INTERNAL_ERROR',
            message: error.message || 'An unexpected error occurred during signup'
         });
      }
   });

   log.info({ functionName: 'createSignupRoutes' }, 'auth-server:signup-routes - Signup routes registered');
}
