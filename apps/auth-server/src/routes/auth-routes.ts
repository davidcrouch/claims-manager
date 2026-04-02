/**
 * =============================================================================
 * AUTHENTICATION ROUTES MODULE
 * =============================================================================
 * 
 * This module handles all OAuth2/OIDC authentication routes for the auth server.
 * It provides endpoints for login, consent, logout, and interaction handling
 * following OIDC specification standards.
 * 
 * Key Features:
 * - OIDC-compliant authentication flow
 * - Automatic consent approval
 * - Secure session management
 * - Comprehensive error handling
 * - Redis-based account storage
 * 
 * @author AI Assistant
 * @version 1.0.0
 * @since 2025-01-30
 */

// =============================================================================
// IMPORTS AND DEPENDENCIES
// =============================================================================

import { Application, Request, Response, NextFunction } from 'express';
import { Provider } from 'oidc-provider';
import { createLogger, LoggerType } from '../lib/logger.js';
import { createTelemetryLogger } from '@morezero/telemetry';
import { trace, context, SpanStatusCode } from '@opentelemetry/api';
import { JwtService } from '../services/jwt-service.js';
import { urlencoded } from 'express';
import { strict as assert } from 'node:assert';
import * as querystring from 'node:querystring';
import { inspect } from 'node:util';
import isEmpty from 'lodash/isEmpty.js';
import { storeAuthResult, deleteStoredAuthResult, CHAT_UI_CLIENT_ID, REGISTRY_CLI_CLIENT_ID } from '../config/oidc-provider.js';
import { getClientId, getApiUrl, getBaseUrl, getPostLogoutRedirectUrl, getEnvVarWithDefault } from '../config/env-validation.js';
// Local db services for user operations
import { createUsersService, createUserIdentitiesService } from '../db/services/index.js';
import type { NewUser, AccessContext } from '../schemas/index.js';
// Password hashing
import bcrypt from 'bcrypt';
// Organization resolution for email/password login (unified identity model)
import {
   verifyPasswordCredentials,
   resolveOrganization,
   resolveWithOrganization,
   getOrganizationsForUser,
   extractSubdomainFromOrigin,
   getApplicationBySubdomain,
   createAuthResult,
   type OrganizationInfo,
   type PasswordVerificationResult
} from '../services/organization-resolution-service.js';
// Identity registration service for checking existing users
import { getUserByEmail, addPasswordIdentityToUser } from '../services/identity-registration-service.js';
// Internal signup service for user + organization provisioning
import { getInternalSignupService } from '../services/internal-signup-service.js';
// OAuth state storage via Redis (centralized in oidc-provider.ts)
import { 
   storeOAuthState, 
   consumeOAuthState, 
   getAppSlug,
   type OAuthStateData 
} from '../config/oidc-provider.js';
// React SSR view rendering
import React from 'react';
import { renderPage } from '../helpers/render-page.js';
import { LoginPage } from '../views/LoginPage.js';
import { RegisterPage } from '../views/RegisterPage.js';
import { OrganizationSelectorPage } from '../views/OrganizationSelectorPage.js';
import { ConsentPage } from '../views/ConsentPage.js';
import { ResetPasswordPage } from '../views/ResetPasswordPage.js';
import { OnboardCompanyPage } from '../views/OnboardCompanyPage.js';
import { requestPasswordReset, confirmPasswordReset } from '../services/password-reset-service.js';


// Type for MCP server resourceInfo (matches RFC 9728 and McpServerResourceInfo schema - snake_case per RFC 9728)
type McpServerResourceInfo = {
   resource?: string;
   resource_id?: string;
   audience?: string;
   authorization_servers?: string[];
   scopes_supported?: string[]; // Array of supported scope values
   bearer_methods_supported?: string[];
   revocation_endpoint?: string;
   introspection_endpoint?: string;
   token_endpoint_auth_methods_supported?: string[];
   token_endpoint_auth_signing_alg_values_supported?: string[];
   introspection_endpoint_auth_methods_supported?: string[];
   introspection_endpoint_auth_signing_alg_values_supported?: string[];
   revocation_endpoint_auth_methods_supported?: string[];
   revocation_endpoint_auth_signing_alg_values_supported?: string[];
   resource_signing_alg_values_supported?: string[];
   resource_encryption_alg_values_supported?: string[];
   resource_encryption_enc_values_supported?: string[];
   resource_documentation?: string;
   resource_policy_uri?: string;
   resource_tos_uri?: string;
   resource_metadata?: string;
   discovery_uri?: string;
   metadata_etag?: string;
   [key: string]: unknown;
};

// Create the base logger using the logger package
const baseLogger = createLogger('auth-server:auth-routes', LoggerType.NODEJS);

// Create telemetry logger that wraps the base logger
const log = createTelemetryLogger(baseLogger, 'auth-routes', 'AuthRoutes', 'auth-server');

// =============================================================================
// MAIN ROUTE FACTORY FUNCTION
// =============================================================================

/**
 * Creates and configures all authentication routes for the Express application.
 * 
 * This function sets up OIDC-compliant authentication endpoints including:
 * - Login page rendering and form submission
 * - Consent handling with automatic approval
 * - Interaction management (login, consent, abort)
 * - Logout functionality with cookie cleanup
 * - Comprehensive error handling
 * 
 * @param app - Express Application instance
 * @param provider - OIDC Provider instance for handling OAuth flows
 * @param jwtService - Optional JwtService instance (creates new if not provided)
 */
export default function createAuthRoutes(
   app: Application, 
   provider: Provider, 
   jwtService?: JwtService
): void {
   
   // =============================================================================
   // SERVICE INITIALIZATION
   // =============================================================================
   
   const jwt = jwtService || new JwtService();
   const usersService = createUsersService();
   const userIdentitiesService = createUserIdentitiesService();
   // System context for internal operations (matches api-server pattern)
   const MORE0_SYSTEM_USER_ID = '00000000-0000-0000-0000-000000000000';
   const systemContext: AccessContext = { organizationId: 'public', userId: MORE0_SYSTEM_USER_ID };
   // Password hashing configuration
   const BCRYPT_SALT_ROUNDS = 12;
   const body = urlencoded({ extended: true }); // Enable extended parsing for nested objects like resourceScopes[resource]

   // =============================================================================
   // UTILITY FUNCTIONS
   // =============================================================================

   /**
    * Derive the base URL from the incoming request so that redirects stay on
    * the same origin the browser is using (important when behind a reverse
    * proxy such as auth.more0.dev → localhost:3280).  Falls back to the
    * static BASE_URL env var when headers are absent.
    */
   function getRequestBaseUrl(req: Request): string {
      const host = req.get('host');
      if (host) {
         const proto = req.protocol;
         return `${proto}://${host}`;
      }
      return getBaseUrl();
   }

   function isFirstPartyClient(clientId: string | undefined): boolean {
      if (!clientId) return false;
      return clientId === getClientId() || clientId === CHAT_UI_CLIENT_ID;
   }

   /**
    * Derive a "start over" URL that restarts the OIDC flow from the client app.
    * Tries the OIDC interaction first (to find the originating app), then falls
    * back to the first interactive static client's origin.
    */
   async function getStartOverUrl(uid: string, req: Request, res: Response): Promise<string> {
      try {
         const details = await provider.interactionDetails(req, res);
         const redirectUri = details.params.redirect_uri as string | undefined;
         if (redirectUri) {
            return new URL(redirectUri).origin;
         }
      } catch {
         // Interaction expired – fall through to static-client fallback
      }
      const interactiveClient = STATIC_CLIENTS.find(
         c => c.redirect_uris.length > 0 && c.grant_types.includes('authorization_code')
      );
      if (interactiveClient) {
         try { return new URL(interactiveClient.redirect_uris[0]).origin; } catch {}
      }
      return '/';
   }

   /**
    * Check if the resource is the Chat API resource
    * 
    * @param resource - The resource indicator to check
    * @returns true if this is the Chat API resource
    */
   function isChatResource(resource: string | string[] | undefined): boolean {
      if (!resource) return false;
      const apiUrl = getApiUrl();
      if (!apiUrl) return false;
      
      // Handle array of resources (OIDC provider may pass array)
      const resourceArray = Array.isArray(resource) ? resource : [resource];
      return resourceArray.some(r => r === apiUrl || r.startsWith(apiUrl));
   }

   /**
    * Fetch MCP server resourceInfo from API server by resource URL
    * 
    * @param resourceUrl - The resource URL to look up
    * @param userId - The user ID for authentication context
    * @returns The MCP server resourceInfo or null if not found
    */
   async function getMcpServerResourceInfo(resourceUrl: string, userId: string): Promise<McpServerResourceInfo | null> {
      try {
         const apiUrl = getApiUrl();
         if (!apiUrl) {
            log.warn({ functionName: 'getMcpServerResourceInfo', resourceUrl }, 'API URL not configured');
            return null;
         }

         const { getStoredAuthResult } = await import('../config/oidc-provider.js');
         const storedAuthResult = await getStoredAuthResult(userId);
         
         if (!storedAuthResult?.accessToken) {
            log.warn({ functionName: 'getMcpServerResourceInfo', resourceUrl, userId }, 'No access token available for API call');
            return null;
         }

         // Call API server to find MCP server by resource URL
         // We'll need to search through MCP servers to find one matching this resource
         const searchUrl = `${apiUrl}/api/v1/mcp/servers?resource=${encodeURIComponent(resourceUrl)}`;
         
         log.debug({ functionName: 'getMcpServerResourceInfo', resourceUrl, searchUrl }, 'Fetching MCP server resourceInfo from API');

         const response = await fetch(searchUrl, {
            headers: {
               'Authorization': `Bearer ${storedAuthResult.accessToken}`,
               'Content-Type': 'application/json',
            },
         });

         if (!response.ok) {
            log.warn({ 
               functionName: 'getMcpServerResourceInfo', 
               resourceUrl, 
               status: response.status 
            }, 'Failed to fetch MCP server from API');
            return null;
         }

         const data = await response.json();
         
         // Find server with matching resource URL in resourceInfo
         if (data.data && Array.isArray(data.data)) {
            for (const server of data.data) {
               const resourceInfo = server.resourceInfo as McpServerResourceInfo | undefined;
               if (resourceInfo?.resource === resourceUrl || resourceInfo?.resource_id === resourceUrl) {
                  log.info({ 
                     functionName: 'getMcpServerResourceInfo', 
                     resourceUrl,
                     scopes_supported: resourceInfo.scopes_supported 
                  }, 'Found MCP server resourceInfo');
                  return resourceInfo;
               }
            }
         }

         log.warn({ functionName: 'getMcpServerResourceInfo', resourceUrl }, 'MCP server not found for resource URL');
         return null;
      } catch (error) {
         log.error({ 
            functionName: 'getMcpServerResourceInfo', 
            resourceUrl, 
            error: error.message 
         }, 'Error fetching MCP server resourceInfo');
         return null;
      }
   }

   /**
    * Middleware function to set no-cache headers for security.
    * Prevents caching of authentication-related responses to ensure security.
    * 
    * @param req - Express Request object
    * @param res - Express Response object
    * @param next - Express NextFunction
    */
   function setNoCache(req: Request, res: Response, next: NextFunction) {
      res.set('cache-control', 'no-store');
      next();
   }
   // =============================================================================
   // LOGIN PAGE ROUTES
   // =============================================================================

   /**
    * GET /login - Renders the login page with form
    * 
    * This endpoint serves the login form to users. It requires an interaction
    * parameter from the OIDC provider to maintain the authentication flow.
    * 
    * Query Parameters:
    * - interaction: Required. OIDC interaction UID for maintaining auth flow
    * - error: Optional. Error message to display to user (URL encoded)
    * 
    * @route GET /login
    * @middleware setNoCache - Prevents caching of login page
    * @returns Rendered login page with interaction UID and optional error message
    */
   app.get('/login', setNoCache, async (req: Request, res: Response, next: NextFunction) => {
      const tracer = trace.getTracer('auth-routes', '1.0.0');
      
      return tracer.startActiveSpan('login', {
         attributes: {
            'auth.route': '/login',
            'auth.method': 'GET',
            'auth.interaction': req.query.interaction as string || '',
            'auth.has_error': !!req.query.error,
            'auth.client_ip': req.ip || '',
            'auth.user_agent': req.headers['user-agent'] || ''
         }
      }, async (span) => {
         try {
            const { interaction, error } = req.query;
         
            // Validate required interaction parameter
            if (!interaction) {
               log.warn({
                  functionName: 'login',
                  query: req.query
               }, 'Login page accessed without interaction parameter');
               span.setStatus({ code: SpanStatusCode.ERROR, message: 'Missing interaction parameter' });
               span.setAttributes({ 'auth.error': 'missing_interaction' });
               return res.status(400).send('Missing interaction parameter');
            }

            span.setAttributes({
               'auth.interaction_valid': true,
               'auth.error_present': !!error
            });
            
            const uid = interaction as string;
            const baseUrl = getRequestBaseUrl(req);
            const registered = req.query.registered === '1';
            const googleAuthUrl = `${baseUrl}/login/google/start?interaction=${encodeURIComponent(uid)}`;
            const loginActionUrl = `${baseUrl}/interaction/${uid}/login`;
            const registerUrl = `${baseUrl}/register?interaction=${uid}`;
            const resetPasswordUrl = `${baseUrl}/reset-password`;
            const appSlug = await getAppSlug(uid) || undefined;
            const startOverUrl = error ? await getStartOverUrl(uid, req, res) : undefined;

            const html = renderPage(
               React.createElement(LoginPage, {
                  uid,
                  error: error ? decodeURIComponent(error as string) : null,
                  registered,
                  googleAuthUrl,
                  loginActionUrl,
                  registerUrl,
                  resetPasswordUrl,
                  appSlug,
                  startOverUrl,
               }),
               { title: 'More0 - Sign In', description: 'Sign in to your account' }
            );
            res.send(html);
            
            span.setStatus({ code: SpanStatusCode.OK });
         } catch (err) {
            log.error({ functionName: 'login', error: err.message, query: req.query }, 'Error serving login page');
            span.recordException(err);
            span.setStatus({ code: SpanStatusCode.ERROR, message: err.message });
            return next(err);
         } finally {
            span.end();
         }
      });
   });

   /**
    * GET /register - Renders the registration page with form
    * 
    * This endpoint serves the registration form to users. It requires an interaction
    * parameter from the OIDC provider to maintain the authentication flow.
    * 
    * Query Parameters:
    * - interaction: Required. OIDC interaction UID for maintaining auth flow
    * - error: Optional. Error message to display to user (URL encoded)
    * 
    * @route GET /register
    * @middleware setNoCache - Prevents caching of registration page
    * @returns Rendered registration page with interaction UID and optional error message
    */
   app.get('/register', setNoCache, async (req: Request, res: Response, next: NextFunction) => {
      const tracer = trace.getTracer('auth-routes', '1.0.0');
      
      return tracer.startActiveSpan('register', {
         attributes: {
            'auth.route': '/register',
            'auth.method': 'GET',
            'auth.interaction': req.query.interaction as string || '',
            'auth.has_error': !!req.query.error,
            'auth.client_ip': req.ip || '',
            'auth.user_agent': req.headers['user-agent'] || ''
         }
      }, async (span) => {
         try {
            const { interaction, error } = req.query;
         
            // Validate required interaction parameter
            if (!interaction) {
               log.warn({
                  functionName: 'register',
                  query: req.query
               }, 'Register page accessed without interaction parameter');
               span.setStatus({ code: SpanStatusCode.ERROR, message: 'Missing interaction parameter' });
               span.setAttributes({ 'auth.error': 'missing_interaction' });
               return res.status(400).send('Missing interaction parameter');
            }

            span.setAttributes({
               'auth.interaction_valid': true,
               'auth.error_present': !!error
            });
            
            const uid = interaction as string;
            const baseUrl = getRequestBaseUrl(req);
            const proxyOrigin = req.query.proxy_origin as string | undefined;
            const registerActionUrl = proxyOrigin
               ? `${proxyOrigin}/api/auth/register-proxy?interaction=${encodeURIComponent(uid)}`
               : `${baseUrl}/interaction/${uid}/register`;
            const googleAuthUrl = `${baseUrl}/login/google/start?interaction=${encodeURIComponent(uid)}`;
            const loginUrl = `${baseUrl}/login?interaction=${uid}`;
            const startOverUrl = error ? await getStartOverUrl(uid, req, res) : undefined;

            const html = renderPage(
               React.createElement(RegisterPage, {
                  uid,
                  error: error ? decodeURIComponent(error as string) : null,
                  email: (req.query.email as string) || undefined,
                  googleAuthUrl,
                  registerActionUrl,
                  loginUrl,
                  startOverUrl,
               }),
               { title: 'More0 - Sign Up', description: 'Create your account' }
            );
            res.send(html);
            
            span.setStatus({ code: SpanStatusCode.OK });
         } catch (err) {
            log.error({ functionName: 'register', error: err.message, query: req.query }, 'Error serving registration page');
            span.recordException(err);
            span.setStatus({ code: SpanStatusCode.ERROR, message: err.message });
            return next(err);
         } finally {
            span.end();
         }
      });
   });

   /**
    * GET /reset-password - Renders the password reset request page
    */
   app.get('/reset-password', setNoCache, async (req: Request, res: Response, next: NextFunction) => {
      try {
         const error = req.query.error as string | undefined;
         const success = req.query.success === '1';
         const baseUrl = getRequestBaseUrl(req);

         const html = renderPage(
            React.createElement(ResetPasswordPage, {
               mode: 'request' as const,
               error: error ? decodeURIComponent(error) : null,
               success,
               loginUrl: `${baseUrl}/login`,
            }),
            { title: 'More0 - Reset Password', description: 'Reset your password' }
         );
         res.send(html);
      } catch (err) {
         log.error({ functionName: 'reset-password', error: err.message }, 'auth-server:auth-routes:reset-password - Error');
         return next(err);
      }
   });

   /**
    * GET /reset-password/confirm - Renders the new password form with token
    */
   app.get('/reset-password/confirm', setNoCache, async (req: Request, res: Response, next: NextFunction) => {
      try {
         const token = req.query.token as string;
         const error = req.query.error as string | undefined;
         const baseUrl = getRequestBaseUrl(req);

         if (!token) {
            return res.redirect(`${baseUrl}/reset-password?error=${encodeURIComponent('Invalid or missing reset token.')}`);
         }

         const html = renderPage(
            React.createElement(ResetPasswordPage, {
               mode: 'confirm' as const,
               token,
               error: error ? decodeURIComponent(error) : null,
               loginUrl: `${baseUrl}/login`,
            }),
            { title: 'More0 - Set New Password' }
         );
         res.send(html);
      } catch (err) {
         log.error({ functionName: 'reset-password-confirm', error: err.message }, 'auth-server:auth-routes:reset-password-confirm - Error');
         return next(err);
      }
   });

   /**
    * GET /onboard/company - Renders the company onboarding page
    */
   app.get('/onboard/company', setNoCache, async (req: Request, res: Response, next: NextFunction) => {
      try {
         const interaction = req.query.interaction as string || '';
         const email = req.query.email as string || '';
         const name = req.query.name as string || '';
         const provider = req.query.provider as string || '';
         const providerUserId = req.query.providerUserId as string || '';
         const displayName = req.query.displayName as string || '';
         const avatarUrl = req.query.avatarUrl as string || '';
         const error = req.query.error as string | undefined;
         const baseUrl = getRequestBaseUrl(req);

         if (!interaction || !email || !name) {
            return res.redirect(`${baseUrl}/register?error=${encodeURIComponent('Invalid registration link. Please try again.')}`);
         }

         const html = renderPage(
            React.createElement(OnboardCompanyPage, {
               uid: interaction,
               email,
               name,
               provider: provider || undefined,
               providerUserId: providerUserId || undefined,
               displayName: displayName || undefined,
               avatarUrl: avatarUrl || undefined,
               error: error ? decodeURIComponent(error) : null,
               actionUrl: `${baseUrl}/api/auth/signup`,
               loginUrl: `${baseUrl}/login`,
            }),
            { title: 'More0 - Complete Your Registration' }
         );
         res.send(html);
      } catch (err) {
         log.error({ functionName: 'onboard-company', error: err.message }, 'auth-server:auth-routes:onboard-company - Error');
         return next(err);
      }
   });

   /**
    * POST /api/auth/reset-password/request - Initiates password reset by sending email
    */
   app.post('/api/auth/reset-password/request', urlencoded({ extended: false }), async (req: Request, res: Response, next: NextFunction) => {
      const baseUrl = getRequestBaseUrl(req);
      try {
         const email = (req.body?.email || '').trim();
         if (!email) {
            return res.redirect(`${baseUrl}/reset-password?error=${encodeURIComponent('Please provide your email address.')}`);
         }

         await requestPasswordReset({ email });
         return res.redirect(`${baseUrl}/reset-password?success=1`);
      } catch (err) {
         log.error({ functionName: 'reset-password-request', error: err.message }, 'auth-server:auth-routes:reset-password-request - Error');
         return res.redirect(`${baseUrl}/reset-password?error=${encodeURIComponent('An error occurred. Please try again.')}`);
      }
   });

   /**
    * POST /api/auth/reset-password/confirm - Validates token and updates password
    */
   app.post('/api/auth/reset-password/confirm', urlencoded({ extended: false }), async (req: Request, res: Response, next: NextFunction) => {
      const baseUrl = getRequestBaseUrl(req);
      try {
         const token = (req.body?.token || '').trim();
         const password = (req.body?.password || '').trim();

         if (!token || !password) {
            return res.redirect(`${baseUrl}/reset-password?error=${encodeURIComponent('Invalid request.')}`);
         }

         const result = await confirmPasswordReset({ token, password });

         if (!result.success) {
            return res.redirect(`${baseUrl}/reset-password/confirm?token=${encodeURIComponent(token)}&error=${encodeURIComponent(result.error || 'Failed to reset password.')}`);
         }

         return res.redirect(`${baseUrl}/login?registered=0&error=${encodeURIComponent('')}&success_message=${encodeURIComponent('Password updated successfully. Please sign in with your new password.')}`);
      } catch (err) {
         log.error({ functionName: 'reset-password-confirm', error: err.message }, 'auth-server:auth-routes:reset-password-confirm - Error');
         return res.redirect(`${baseUrl}/reset-password?error=${encodeURIComponent('An error occurred. Please try again.')}`);
      }
   });

   /**
    * GET /login/session-refresh - Refreshes the OIDC interaction session
    * 
    * This endpoint allows the login page to refresh the interaction session
    * to prevent timeout during active user interaction.
    * 
    * @route GET /login/session-refresh
    * @param interaction - OIDC interaction UID from query parameter
    * @middleware setNoCache - Prevents caching of refresh responses
    * @returns JSON response indicating session refresh status
    */
   app.get('/login/session-refresh', setNoCache, async (req: Request, res: Response, next: NextFunction) => {
      const tracer = trace.getTracer('auth-routes', '1.0.0');
      
      return tracer.startActiveSpan('session-refresh', {
         attributes: {
            'auth.route': '/login/session-refresh',
            'auth.method': 'GET',
            'auth.interaction': req.query.interaction as string || '',
            'auth.client_ip': req.ip || '',
            'auth.user_agent': req.headers['user-agent'] || ''
         }
      }, async (span) => {
         try {
            const { interaction } = req.query;
         
            if (!interaction) {
               log.warn({ functionName: 'session-refresh', query: req.query }, 'Session refresh requested without interaction parameter');
               span.setStatus({ code: SpanStatusCode.ERROR, message: 'Missing interaction parameter' });
               span.setAttributes({ 'auth.error': 'missing_interaction' });
               return res.status(400).json({ 
                  success: false, 
                  error: 'Missing interaction parameter' 
               });
            }

            // Check if the interaction still exists and is valid
            try {
               const interactionDetails = await provider.interactionDetails(req, res);
               
               if (interactionDetails && interactionDetails.uid === interaction) {
                  span.setAttributes({ 'auth.session_valid': true });
                  span.setStatus({ code: SpanStatusCode.OK });
                  return res.json({ 
                     success: true, 
                     message: 'Session refreshed successfully',
                     expires_in: 3600 // 60 minutes
                  });
               } else {
                  span.setAttributes({ 'auth.session_valid': false, 'auth.error': 'session_expired' });
                  span.setStatus({ code: SpanStatusCode.ERROR, message: 'Session expired' });
                  return res.status(410).json({ 
                     success: false, 
                     error: 'Session expired',
                     redirect_required: true
                  });
               }
            } catch (interactionError) {
               log.warn({ 
                  interaction, 
                  error: interactionError.message 
               }, 'auth-server:auth-routes:session-refresh - Failed to validate interaction session');
               
               span.recordException(interactionError);
               span.setAttributes({ 'auth.error': 'validation_failed' });
               span.setStatus({ code: SpanStatusCode.ERROR, message: 'Failed to validate interaction session' });
               
               return res.status(410).json({ 
                  success: false, 
                  error: 'Session expired',
                  redirect_required: true
               });
            }
         } catch (err) {
            log.error({ 
               error: err.message, 
               query: req.query 
            }, 'auth-server:auth-routes:session-refresh - Session refresh error');
            
            span.recordException(err);
            span.setStatus({ code: SpanStatusCode.ERROR, message: err.message });
            
            return res.status(500).json({ 
               success: false, 
               error: 'Internal server error' 
            });
         } finally {
            span.end();
         }
      });
   });

   /**
    * GET /login/session-status - Checks the status of an OIDC interaction session
    * 
    * This endpoint allows the login page to check if the interaction session
    * is still valid without consuming it. It performs a lightweight check
    * without calling provider.interactionDetails to avoid session consumption.
    * 
    * @route GET /login/session-status
    * @param interaction - OIDC interaction UID from query parameter
    * @middleware setNoCache - Prevents caching of status responses
    * @returns JSON response indicating session status
    */
   app.get('/login/session-status', setNoCache, async (req: Request, res: Response, next: NextFunction) => {
      const tracer = trace.getTracer('auth-routes', '1.0.0');
      
      return tracer.startActiveSpan('session-status', {
         attributes: {
            'auth.route': '/login/session-status',
            'auth.method': 'GET',
            'auth.interaction': req.query.interaction as string || '',
            'auth.client_ip': req.ip || '',
            'auth.user_agent': req.headers['user-agent'] || ''
         }
      }, async (span) => {
         try {
            const { interaction } = req.query;
         
            if (!interaction) {
               log.warn({ functionName: 'session-status', query: req.query }, 'Session status requested without interaction parameter');
               span.setStatus({ code: SpanStatusCode.ERROR, message: 'Missing interaction parameter' });
               span.setAttributes({ 'auth.error': 'missing_interaction' });
               return res.status(400).json({ 
                  success: false, 
                  error: 'Missing interaction parameter' 
               });
            }

            // Perform a lightweight check without consuming the session
            // We'll assume the session is valid if we can reach this point
            // The actual validation will happen during form submission
            try {
               // Simple validation - just check if interaction parameter exists and looks valid
               if (typeof interaction === 'string' && interaction.length > 10) {
                  span.setAttributes({ 'auth.session_valid': true, 'auth.interaction_length': interaction.length });
                  span.setStatus({ code: SpanStatusCode.OK });
                  return res.json({ 
                     success: true, 
                     message: 'Session is valid',
                     expires_in: 3600, // 60 minutes
                     prompt: 'login' // Assume login prompt for session status
                  });
               } else {
                  span.setAttributes({ 'auth.session_valid': false, 'auth.error': 'invalid_format' });
                  span.setStatus({ code: SpanStatusCode.ERROR, message: 'Invalid interaction format' });
                  return res.status(410).json({ 
                     success: false, 
                     error: 'Invalid session',
                     redirect_required: true
                  });
               }
            } catch (validationError) {
               log.warn({ 
                  interaction, 
                  error: validationError.message 
               }, 'auth-server:auth-routes:session-status - Failed to validate interaction format');
               
               span.recordException(validationError);
               span.setAttributes({ 'auth.error': 'validation_failed' });
               span.setStatus({ code: SpanStatusCode.ERROR, message: 'Failed to validate interaction format' });
               
               return res.status(410).json({ 
                  success: false, 
                  error: 'Session expired',
                  redirect_required: true
               });
            }
         } catch (err) {
            log.error({ 
               error: err.message, 
               query: req.query 
            }, 'auth-server:auth-routes:session-status - Session status error');
            
            span.recordException(err);
            span.setStatus({ code: SpanStatusCode.ERROR, message: err.message });
            
            return res.status(500).json({ 
               success: false, 
               error: 'Internal server error' 
            });
         } finally {
            span.end();
         }
      });
   });

   // =============================================================================
   // INTERACTION HANDLING ROUTES
   // =============================================================================

   /**
    * GET /interaction/:uid - Main OIDC interaction handler
    * 
    * This endpoint handles OIDC interaction requests from the provider.
    * It processes different types of interactions including login and consent.
    * 
    * Interaction Types:
    * - login: Redirects to login page for user authentication
    * - consent: Auto-approves consent by creating/updating grants
    * 
    * @route GET /interaction/:uid
    * @param uid - OIDC interaction UID from the provider
    * @middleware setNoCache - Prevents caching of interaction responses
    * @returns Redirects to login page or processes consent automatically
    */
   app.get('/interaction/:uid', setNoCache, async (req: Request, res: Response, next: NextFunction) => {
      try {
         const { uid } = req.params;
         log.debug({ functionName: 'interaction', uid, timestamp: new Date().toISOString() }, 'GET request - getting interaction details');

         // Retrieve interaction details from OIDC provider
         const {
            uid: interactionUid, 
            prompt, 
            params, 
            session,
         } = await provider.interactionDetails(req, res);

         log.debug({ 
            uid: interactionUid, 
            prompt: prompt.name, 
            timestamp: new Date().toISOString() 
         }, 'auth-server:auth-routes:interaction - GET request - interaction details retrieved');

         // Find the OIDC client for this interaction
         const client = await provider.Client.find(params.client_id);

         // Get base URL to check if redirect_uri is external
         const baseUrl = getRequestBaseUrl(req);
         const redirectUri = params.redirect_uri as string | undefined;
         const isExternalRedirect = redirectUri && !redirectUri.startsWith(baseUrl);
         
         // Check state parameter for returnTo destination (used by custom registration pages)
         let returnToUrl: string | undefined;
         const stateParam = params.state as string | undefined;
         if (stateParam) {
            try {
               // Try to decode base64url encoded state
               const decodedState = Buffer.from(stateParam, 'base64url').toString('utf-8');
               const stateData = JSON.parse(decodedState);
               if (stateData.returnTo && typeof stateData.returnTo === 'string') {
                  returnToUrl = stateData.returnTo;
                  log.debug({ 
                     functionName: 'interaction',
                     uid: interactionUid,
                     returnTo: returnToUrl,
                     mode: stateData.mode
                  }, 'Found returnTo in state parameter');
               }
            } catch (error) {
               // State is not JSON-encoded, ignore
               log.debug({ 
                  functionName: 'interaction',
                  uid: interactionUid,
                  stateLength: stateParam.length
               }, 'State parameter is not JSON-encoded, ignoring');
            }
         }
         
         // Handle different interaction types
         switch (prompt.name) {
            case 'login': {
               log.info({ 
                  functionName: 'interaction', 
                  uid: interactionUid, 
                  prompt: prompt.name,
               }, 'auth-server:auth-routes:interaction - Rendering login page directly');

               return res.redirect(`${getRequestBaseUrl(req)}/login?interaction=${interactionUid}`);
            }

            case 'register': {
               log.info({ 
                  functionName: 'interaction', 
                  uid: interactionUid, 
                  prompt: prompt.name,
               }, 'auth-server:auth-routes:interaction - Rendering register page directly');

               const regRedirectUri = params.redirect_uri as string | undefined;
               const proxyOrigin = regRedirectUri ? new URL(regRedirectUri).origin : '';
               const registerQuery = new URLSearchParams({ interaction: interactionUid });
               if (proxyOrigin) registerQuery.set('proxy_origin', proxyOrigin);
               return res.redirect(`${getRequestBaseUrl(req)}/register?${registerQuery.toString()}`);
            }

            case 'select_organization': {
               log.info({ 
                  functionName: 'interaction', 
                  uid: interactionUid, 
                  prompt: prompt.name,
               }, 'auth-server:auth-routes:interaction - Rendering select_organization page directly');

               const selectOrganizationDetails = await provider.interactionDetails(req, res);
               const registerResult = selectOrganizationDetails.result?.register || {};
               const regOrganizations = (registerResult.organizations || []).map((o: any) => ({
                  organizationId: o.organizationId ?? o.id ?? '',
                  organizationName: o.organizationName ?? o.name ?? '',
                  role: o.role,
               }));
               const regEmail = registerResult.email || '';
               const regName = registerResult.name || '';

               const selectOrgHtml = renderPage(
                  React.createElement(OrganizationSelectorPage, {
                     uid: interactionUid,
                     organizations: regOrganizations,
                     email: regEmail,
                     name: regName,
                     error: (req.query.error as string) || null,
                     mode: 'registration',
                     actionUrl: `/interaction/${interactionUid}/select-organization`,
                     showCreateNew: true,
                  }),
                  { title: 'More0 - Select Organization' }
               );
               return res.send(selectOrgHtml);
            }

            case 'select_org': {
               log.info({ 
                  functionName: 'interaction', 
                  uid: interactionUid, 
                  prompt: prompt.name,
               }, 'auth-server:auth-routes:interaction - Rendering select_org page directly');

               const selectOrgDetails = await provider.interactionDetails(req, res);
               const loginResult = selectOrgDetails.result?.login || {};
               const loginOrganizations = (loginResult.organizations || []).map((o: any) => ({
                  organizationId: o.organizationId ?? o.id ?? '',
                  organizationName: o.organizationName ?? o.name ?? '',
                  role: o.role,
               }));
               const loginEmail = loginResult.email || '';
               const loginName = loginResult.name || '';

               const selectOrgHtml = renderPage(
                  React.createElement(OrganizationSelectorPage, {
                     uid: interactionUid,
                     organizations: loginOrganizations,
                     email: loginEmail,
                     name: loginName,
                     error: (req.query.error as string) || null,
                     mode: 'login',
                     actionUrl: `/interaction/${interactionUid}/select-org`,
                     showCreateNew: false,
                  }),
                  { title: 'More0 - Select Organization' }
               );
               return res.send(selectOrgHtml);
            }
            
            case 'consent': {
               // Handle consent interaction
               log.info({ functionName: 'interaction', uid: interactionUid, clientId: params.client_id }, 'Processing consent interaction');

               try {
                  // Get the interaction details to extract the grant information
                  log.info({ functionName: 'interaction', uid: interactionUid }, 'Getting interaction details for consent');
                  const interactionDetails = await provider.interactionDetails(req, res);
                  
                  log.info({
                     functionName: 'interaction',
                     uid: interactionUid,
                     hasPrompt: !!interactionDetails.prompt,
                     hasSession: !!interactionDetails.session,
                     hasGrantId: !!interactionDetails.grantId,
                     promptDetails: interactionDetails.prompt?.details,
                     accountId: interactionDetails.session?.accountId
                  }, 'Interaction details retrieved for consent');

                  // OIDC standard: session.accountId = userId (user identifier, not tenant)
                  const { prompt: { details }, session: { accountId }, grantId, params: interactionParams } = interactionDetails;
                  
                  // Get client information
                  const client = await provider.Client.find(params.client_id);
                  const clientName = client?.clientName || client?.clientId || 'Application';
                  
                  // Detect which resource this request is about
                  const resource = Array.isArray(interactionParams.resource) 
                     ? interactionParams.resource[0] 
                     : (interactionParams.resource as string | undefined);
                  
                  // === Auto-consent for Chat UI or Chat resource ===
                  if (isFirstPartyClient(params.client_id) || isChatResource(resource)) {
                     log.info({ 
                        functionName: 'interaction',
                        uid: interactionUid,
                        clientId: params.client_id,
                        resource,
                        isFirstPartyClient: isFirstPartyClient(params.client_id),
                        isChatResource: isChatResource(resource)
                     }, 'Auto-approving consent for Chat UI or Chat resource');
                     
                     // Create or find existing grant
                     let grant;
                     if (grantId) {
                        grant = await provider.Grant.find(grantId);
                        log.info({ functionName: 'interaction', uid: interactionUid, grantId }, 'Using existing grant for auto-consent');
                     } else {
                        grant = new provider.Grant({
                           accountId,
                           clientId: params.client_id,
                        });
                        log.info({ functionName: 'interaction', uid: interactionUid }, 'Created new grant for auto-consent');
                     }

                     // For first-party clients, grant ALL requested scopes as OIDC scopes
                     const requestedScopeStr = (interactionParams.scope || params.scope || '') as string;
                     const allRequestedScopes = requestedScopeStr.split(' ').filter(Boolean);
                     for (const scope of allRequestedScopes) {
                        grant.addOIDCScope(scope);
                     }

                     log.info({
                        functionName: 'interaction',
                        uid: interactionUid,
                        allRequestedScopes,
                        missingOIDCScope: details.missingOIDCScope ? [...details.missingOIDCScope] : [],
                        missingResourceScopesType: details.missingResourceScopes?.constructor?.name,
                     }, 'auth-server:auth-routes:interaction - Auto-consent scope details');

                     if (details.missingOIDCClaims) {
                        grant.addOIDCClaims(details.missingOIDCClaims);
                     }

                     // missingResourceScopes is a Map<string, Set<string>> in oidc-provider v9
                     if (details.missingResourceScopes) {
                        const entries = details.missingResourceScopes instanceof Map
                           ? details.missingResourceScopes
                           : Object.entries(details.missingResourceScopes);
                        for (const [rs, scopes] of entries) {
                           for (const scope of scopes) {
                              grant.addResourceScope(rs, scope);
                           }
                        }
                     }

                     const newGrantId = await grant.save();
                     log.info({ functionName: 'interaction', uid: interactionUid, newGrantId, wasExisting: !!grantId }, 'Grant saved for auto-consent');
                     
                     // Complete the interaction with auto-consent
                     // If grantId already exists, consent is already resolved, so we can omit it
                     // Otherwise, provide the new grantId
                     const result = grantId 
                        ? {} // Consent already resolved in previous interaction
                        : { consent: { grantId: newGrantId } };
                     
                     await provider.interactionFinished(req, res, result, { mergeWithLastSubmission: true });
                     
                     log.info({ functionName: 'interaction', uid: interactionUid }, 'Auto-consent completed successfully');
                     return; // Exit early - no UI needed
                  }

                  // === Otherwise (MCP) – render a consent screen ===
                  log.info({ 
                     functionName: 'interaction',
                     uid: interactionUid,
                     clientId: params.client_id,
                     resource
                  }, 'Rendering consent page for MCP resource');
                  
                  // Build scope information for display
                  const requestedScopeString = interactionParams.scope || params.scope || '';
                  const requestedScopes = requestedScopeString.split(' ').filter(Boolean);
                  
                  // Map standard OIDC scopes to user-friendly names
                  const scopeDescriptions: Record<string, { name: string; description: string }> = {
                     'openid': { name: 'OpenID Connect', description: 'Basic authentication and identity information' },
                     'profile': { name: 'Profile Information', description: 'Access to your profile information (name, picture, etc.)' },
                     'email': { name: 'Email Address', description: 'Access to your email address' },
                     'address': { name: 'Address', description: 'Access to your address information' },
                     'phone': { name: 'Phone Number', description: 'Access to your phone number' },
                     'offline_access': { name: 'Offline Access', description: 'Access your account when you are not present (refresh tokens)' },
                     'mcp:tools': { name: 'MCP Tools', description: 'Access to MCP (Model Context Protocol) tools and resources' }
                  };
                  
                  // Fetch MCP server resourceInfo to get scopes_supported
                  let mcpResourceInfo: McpServerResourceInfo | null = null;
                  if (resource) {
                     mcpResourceInfo = await getMcpServerResourceInfo(resource, accountId);
                  }
                  
                  // For MCP resources, use scopes_supported from resourceInfo if available
                  // Otherwise fall back to missingResourceScopes
                  const resourceScopes: Record<string, Array<{ value: string; name: string; description: string; required: boolean }>> = {};
                  const resourceScopeValues = new Set<string>();
                  
                  if (resource) {
                     // Get missing scopes for this resource
                     const missingScopes = details.missingResourceScopes?.[resource];
                     const missingScopeSet = new Set<string>();
                     if (missingScopes) {
                        const scopeArray = Array.isArray(missingScopes) ? missingScopes : [missingScopes];
                        scopeArray.forEach(s => missingScopeSet.add(String(s)));
                     }
                     
                     // Use scopes_supported from resourceInfo if available, otherwise use missingResourceScopes
                     const scopesToShow = mcpResourceInfo?.scopes_supported || 
                                        (missingScopes ? (Array.isArray(missingScopes) ? missingScopes : [missingScopes]) : []);
                     
                     if (scopesToShow.length > 0) {
                        resourceScopes[resource] = scopesToShow.map(scope => {
                           const scopeStr = String(scope);
                           resourceScopeValues.add(scopeStr);
                           const isMissing = missingScopeSet.has(scopeStr);
                           return {
                              value: scopeStr,
                              name: scopeDescriptions[scopeStr]?.name || scopeStr,
                              description: scopeDescriptions[scopeStr]?.description || `Access to ${scopeStr} for ${resource}`,
                              required: false
                           };
                        });
                     }
                  }
                  
                  // Build OIDC scopes list - exclude scopes that are already shown as resource scopes
                  // For MCP resources, if we have resource scopes, don't show OIDC scopes (they're duplicates)
                  const oidcScopes = (resource && resourceScopeValues.size > 0) 
                     ? [] // Don't show OIDC scopes if we have resource scopes (avoid duplicates)
                     : (details.missingOIDCScope?.filter(scope => !resourceScopeValues.has(scope)).map(scope => ({
                        value: scope,
                        name: scopeDescriptions[scope]?.name || scope,
                        description: scopeDescriptions[scope]?.description || `Access to ${scope} scope`,
                        required: false
                     })) || []);
                  
                  log.info({
                     functionName: 'interaction',
                     uid: interactionUid,
                     oidcScopesCount: oidcScopes.length,
                     resourceScopesCount: Object.keys(resourceScopes).length,
                     missingOIDCScope: details.missingOIDCScope,
                     missingResourceScopes: details.missingResourceScopes
                  }, 'Prepared scopes for consent page');
                  
                  const consentHtml = renderPage(
                     React.createElement(ConsentPage, {
                        uid: interactionUid,
                        clientName,
                        resource,
                        oidcScopes,
                        resourceScopes,
                        error: null,
                     }),
                     { title: 'Authorize Application - More0' }
                  );
                  return res.send(consentHtml);
               } catch (error) {
                  log.error({ 
                     functionName: 'interaction',
                     uid: interactionUid, 
                     error: error.message, 
                     stack: error.stack 
                  }, 'Error processing consent');
                  throw error;
               }
            }
            
            default:
               // Unknown interaction type - return error
               log.warn({ functionName: 'interaction', uid: interactionUid, promptName: prompt.name }, 'Unknown interaction type');
               return res.status(400).send('Unknown interaction type');
         }
      } catch (err) {
         log.error({ 
            functionName: 'interaction',
            error: err.message, 
            uid: req.params.uid 
         }, 'Interaction page error');
         return next(err);
      }
   });




   // =============================================================================
   // LOGIN SUBMISSION ROUTES
   // =============================================================================

   /**
    * POST /interaction/:uid/login - Handles login form submission
    * 
    * This endpoint processes login form submissions from the login page.
    * It authenticates users with the backend service and completes the OIDC flow.
    * 
    * Request Body:
    * - email: User's email address
    * - password: User's password
    * 
    * @route POST /interaction/:uid/login
    * @param uid - OIDC interaction UID from the provider
    * @middleware setNoCache - Prevents caching of login responses
    * @middleware body - Parses URL-encoded form data
    * @returns Completes OIDC login interaction or redirects with error
    */
   app.post('/interaction/:uid/login', setNoCache, body, async (req: Request, res: Response, next: NextFunction) => {
      try {
         const { uid } = req.params;
         log.info({ functionName: 'login-submit', uid, body: req.body }, 'Login submission received');

         // Add debugging for interaction lookup
         log.debug({ 
            functionName: 'login-submit',
            uid, 
            timestamp: new Date().toISOString() 
         }, 'POST request - attempting to retrieve interaction details');

         // Get interaction details (this will consume the session)
         const interactionDetails = await provider.interactionDetails(req, res);
         log.info({ 
            functionName: 'login-submit',
            interactionDetails, 
            timestamp: new Date().toISOString() 
         }, 'POST request - interaction details retrieved');

         // Validate that this is a login interaction
         const { prompt: { name } } = interactionDetails;
         assert.equal(name, 'login');
         
         // Extract redirect_uri to build external page URLs
         const redirectUri = interactionDetails.params.redirect_uri as string | undefined;
         let redirectOrigin = '';
         let servicePath = '';
         if (redirectUri) {
            try {
               redirectOrigin = new URL(redirectUri).origin;
               const redirectPath = new URL(redirectUri).pathname;
               servicePath = redirectPath.split('/api/')[0] || '';
            } catch (e) {
               log.warn({ functionName: 'login-submit', redirectUri }, 'Failed to parse redirect_uri');
            }
         }

         // Extract credentials from request body
         const { email, password } = req.body;
         log.info({ functionName: 'login-submit', email }, 'auth-server:auth-routes:login-submit - Processing login request');

         // =====================================================================
         // STEP 1: VERIFY PASSWORD CREDENTIALS (Unified Identity Model)
         // =====================================================================
         log.info({ functionName: 'login-submit', email }, 'auth-server:auth-routes:login-submit - Verifying password credentials');
         
         const verifyResult = await verifyPasswordCredentials({ email, password });
         
         if (!verifyResult.success) {
            log.warn({ 
               functionName: 'login-submit', 
               email, 
               errorCode: verifyResult.errorCode 
            }, 'auth-server:auth-routes:login-submit - Password verification failed');
            
            // If user not found, redirect to registration with the interaction
            // This allows seamless "try to login → user doesn't exist → register" flow.
            // Always use auth-server's /register so the user sees the form (apps like admin-ui
            // may not have a /register route; same-origin redirect also works with fetch+redirect:manual).
            if (verifyResult.errorCode === 'USER_NOT_FOUND') {
               log.info({ 
                  functionName: 'login-submit', 
                  email 
               }, 'auth-server:auth-routes:login-submit - User not found, redirecting to registration');
               const registerUrl = `/register?interaction=${uid}&email=${encodeURIComponent(email)}&from=login`;
               // When client uses fetch with redirect:'manual', return JSON so it can navigate (Location header may be inaccessible for cross-origin).
               if (req.headers['x-more0-app-slug']) {
                  return res.json({ returnTo: registerUrl });
               }
               return res.redirect(registerUrl);
            }
            
            // Other errors (wrong password, disabled account, etc.) - redirect back to
            // the auth server's own login page so the user sees the error inline.
            return res.redirect(`/login?interaction=${uid}&error=invalid_credentials&error_description=${encodeURIComponent(verifyResult.error || 'Invalid email or password')}`);
         }

         const userId = verifyResult.userId!;
         const userName = verifyResult.name || '';
         
         log.info({ functionName: 'login-submit', userId, email }, 'auth-server:auth-routes:login-submit - Password verified successfully');

         // =====================================================================
         // STEP 2: UNIFIED TENANT RESOLUTION (Same as Google OAuth)
         // =====================================================================
         const origin = req.get('origin') || req.get('referer') || '';
         const headerAppSlug = req.headers['x-more0-app-slug'] as string | undefined;
         const bodyAppSlug = typeof req.body?.app_slug === 'string' ? req.body.app_slug : undefined;
         log.info(
            { functionName: 'login-submit', xMore0AppSlug: headerAppSlug ?? null, bodyAppSlug: bodyAppSlug ?? null },
            `auth-server:auth-routes:login-submit - x-more0-app-slug header value: ${headerAppSlug ?? '(not set)'}, body app_slug: ${bodyAppSlug ?? '(not set)'}`
         );
         // Read app slug: header (from form JS fetch) > body (hidden field) > OIDC params > Redis-stored slug
         let storedAppKey = headerAppSlug || bodyAppSlug;
         if (!storedAppKey) {
            storedAppKey = interactionDetails.params?.app_slug as string | undefined;
         }
         if (!storedAppKey) {
            storedAppKey = await getAppSlug(uid) || undefined;
         }
         // Device flow (e.g. mz login) has no subdomain; use default app when client is registry-cli
         if (!storedAppKey && interactionDetails.params?.client_id === REGISTRY_CLI_CLIENT_ID) {
            storedAppKey = process.env.MZ_DEVICE_FLOW_APP_SUBDOMAIN || process.env.DEFAULT_APP_SUBDOMAIN || 'app';
            log.info({ functionName: 'login-submit', storedAppKey }, 'auth-server:auth-routes:login-submit - Using default app subdomain for registry-cli device flow');
         }
         log.info({ functionName: 'login-submit', userId, storedAppKey }, 'auth-server:auth-routes:login-submit - Starting unified tenant resolution');
         
         // Use resolveOrganization for unified flow (provider='password', providerSubject=email)
         let organizationResult = await resolveOrganization({
            provider: 'password',
            providerSubject: email,
            origin,
            appKey: storedAppKey
         });

         // Fallback: if application not found by app_slug, retry with default subdomain
         // (mirrors the registration flow which falls back to REGISTRATION_DEFAULT_APP_SUBDOMAIN)
         if (organizationResult.errorCode === 'APPLICATION_NOT_FOUND' && organizationResult.userId && organizationResult.organizationId) {
            const defaultSubdomain = getEnvVarWithDefault('REGISTRATION_DEFAULT_APP_SUBDOMAIN', 'app');
            if (defaultSubdomain !== storedAppKey) {
               log.info({
                  functionName: 'login-submit',
                  originalAppKey: storedAppKey,
                  fallbackSubdomain: defaultSubdomain
               }, 'auth-server:auth-routes:login-submit - Application not found, retrying with default subdomain');
               organizationResult = await resolveWithOrganization({
                  userId: organizationResult.userId,
                  organizationId: organizationResult.organizationId,
                  origin,
                  appKey: defaultSubdomain
               });
            }
         }

         // =====================================================================
         // STEP 3: HANDLE TENANT RESOLUTION RESULTS
         // =====================================================================
         // 
         // Policy-based org selection flow:
         // - If single org: complete login with full tenant info
         // - If multiple orgs: complete login with user info + organizations list
         //   The select_org policy will trigger next and show org selection
         // - If errors: redirect back with error message
         // =====================================================================

         // Handle tenant resolution errors (non-multi-organization errors)
         if (!organizationResult.success && organizationResult.errorCode !== 'MULTIPLE_ORGANIZATIONS') {
            log.warn(
               {
                  functionName: 'login-submit',
                  userId,
                  errorCode: organizationResult.errorCode,
                  error: organizationResult.error
               },
               `auth-server:auth-routes:login-submit - Tenant resolution failed: errorCode=${organizationResult.errorCode}, error=${organizationResult.error ?? '(none)'}`
            );

            const buildLoginErrorUrl = (errorCode: string, errorDescription: string) => {
               return `/login?interaction=${uid}&error=${errorCode}&error_description=${encodeURIComponent(errorDescription)}`;
            };

            // Handle user not found in identity table (legacy user without identity record)
            if (organizationResult.errorCode === 'USER_NOT_FOUND') {
               log.warn({ functionName: 'login-submit', email }, 'auth-server:auth-routes:login-submit - User identity not found, may need migration');
               return res.redirect(buildLoginErrorUrl('identity_not_found', 'Please contact support to update your account.'));
            }

            // Handle no organizations
            if (organizationResult.errorCode === 'NO_ORGANIZATIONS') {
               return res.redirect(buildLoginErrorUrl('no_organizations', organizationResult.error || 'Your account is not associated with any organization.'));
            }

            // Handle other errors
            return res.redirect(buildLoginErrorUrl(organizationResult.errorCode?.toLowerCase() || 'login_failed', organizationResult.error || 'Login failed'));
         }

         // =====================================================================
         // STEP 4: COMPLETE LOGIN (Policy will handle org selection if needed)
         // =====================================================================

         // Check if user has multiple organizations - let select_org policy handle it
         const hasMultipleOrganizations = (organizationResult.errorCode === 'MULTIPLE_ORGANIZATIONS' && organizationResult.organizations);
         
         const orgList = organizationResult.organizations ?? [];
         if (hasMultipleOrganizations) {
            log.info({ 
               functionName: 'login-submit', 
               userId, 
               organizationCount: orgList.length 
            }, 'auth-server:auth-routes:login-submit - Multiple organizations, completing login (select_org policy will handle org selection)');

            // Complete login with user info and organizations list (select_org policy)
            const result = {
               login: {
                  accountId: userId,
                  acr: '1',
                  amr: ['password'],
                  remember: true,
                  ts: Math.floor(Date.now() / 1000),
                  email: email,
                  name: userName,
                  provider: 'password',
                  organizations: orgList, // Array of org info for org selection
                  requiresOrgSelection: true,
               },
            };

            await provider.interactionFinished(req, res, result, { mergeWithLastSubmission: false });
            return;
         }

         // Single organization - complete login with full tenant info (from organizationResult)
         const organizationId = organizationResult.organizationId;
         const applicationId = organizationResult.applicationId!;

         log.info({ 
            functionName: 'login-submit',
            userId,
            organizationId,
            applicationId
         }, 'auth-server:auth-routes:login-submit - Single organization, completing login with full tenant info');

         // Create auth result with full tenant information
         const authResult = createAuthResult({
            userId: userId,
            email: email,
            name: userName,
            provider: 'password',
            organizationId: organizationId!,
            applicationId: applicationId!
         });

         // Store the auth result in Redis keyed by userId (OIDC account identifier)
         await storeAuthResult(userId, authResult);

         log.info({ 
            functionName: 'login-submit',
            userId,
            organizationId,
            applicationId
         }, 'auth-server:auth-routes:login-submit - Auth result stored, completing OIDC interaction');

         // Prepare login result for OIDC provider
         const result = {
            login: {
               accountId: userId,  // OIDC account identifier is always userId
               acr: '1',
               amr: ['password'],
               remember: true,
               ts: Math.floor(Date.now() / 1000),
               // Include selected org info (custom fields for token claims)
               organizationId,
               applicationId,
            },
         };

         // Complete the OIDC login interaction
         const returnTo = await provider.interactionResult(req, res, result, { mergeWithLastSubmission: false });
         log.info({ functionName: 'login-submit', returnTo, headersSent: res.headersSent, statusCode: res.statusCode }, 'auth-server:auth-routes:login-submit - interactionResult completed');

         if (res.headersSent) {
            log.warn({ functionName: 'login-submit' }, 'auth-server:auth-routes:login-submit - Headers already sent, cannot redirect');
            return;
         }

         // JavaScript fetch with redirect:'manual' produces opaque responses where
         // the Location header is inaccessible. Return JSON so the client can navigate.
         if (req.headers['x-more0-app-slug']) {
            return res.json({ returnTo });
         }

         res.redirect(303, returnTo);
      } catch (err) {
         log.error({ 
            functionName: 'login-submit',
            error: err.message, 
            uid: req.params.uid, 
            stack: err.stack,
            errorName: err.name,
            errorCode: err.code
         }, 'Login submission error');

         // Handle specific OIDC errors with redirects for form submissions
         if (err.name === 'SessionNotFound') {
            log.warn({ functionName: 'login-submit', uid: req.params.uid }, 'Interaction session not found');
            return res.redirect(`/login?interaction=${req.params.uid}&error=${encodeURIComponent('Session not found or expired. Please try again.')}`);
         }

         // Handle x-forwarded-proto errors (common in reverse proxy setups)
         if (err.message && err.message.includes('x-forwarded-proto')) {
            log.error({ functionName: 'login-submit', uid: req.params.uid }, 'X-Forwarded-Proto header error in OIDC provider');
            return res.redirect(`/login?interaction=${req.params.uid}&error=${encodeURIComponent('Authentication service temporarily unavailable. Please try again.')}`);
         }

         // Handle authentication errors from backend service
         if (err.message && (err.message.includes('Invalid credentials') || err.message.includes('User not found'))) {
            return res.redirect(`/login?interaction=${req.params.uid}&error=${encodeURIComponent('Login failed. Please check your credentials and try again.')}`);
         }

         // Pass other errors to Express error handler
         next(err);
      }
   });

   // =============================================================================
   // ORGANIZATION SELECTION ROUTES (Policy-based)
   // =============================================================================

   /**
    * POST /interaction/:uid/select-org - Handles organization selection
    * 
    * This endpoint processes organization selection when a user belongs to
    * multiple organizations. It's triggered by the select_org prompt policy.
    * 
    * Request Body:
    * - organizationId: Selected organization's ID
    * 
    * @route POST /interaction/:uid/select-org
    * @param uid - OIDC interaction UID from the provider
    * @middleware setNoCache - Prevents caching of responses
    * @middleware body - Parses URL-encoded form data
    * @returns Completes OIDC select_org interaction and continues to consent
    */
   app.post('/interaction/:uid/select-org', setNoCache, body, async (req: Request, res: Response, next: NextFunction) => {
      try {
         const { uid } = req.params;
         const { organizationId } = req.body;

         log.info({ 
            functionName: 'select-org-submit', 
            uid, 
            organizationId 
         }, 'auth-server:auth-routes:select-org-submit - Organization selection received');

         // Helper to build redirect URL back to app-site
         const getAppSelectOrgUrl = (error: string, organizations?: any[], email?: string, name?: string) => {
            const referer = req.get('referer');
            if (referer) {
               try {
                  const refererUrl = new URL(referer);
                  const selectOrgUrl = new URL('/select-org', refererUrl.origin);
                  selectOrgUrl.searchParams.set('interaction', uid);
                  selectOrgUrl.searchParams.set('error', error);
                  if (email) selectOrgUrl.searchParams.set('email', email);
                  if (name) selectOrgUrl.searchParams.set('name', name);
                  // Note: searchParams.set already handles URL encoding
                  if (organizations) selectOrgUrl.searchParams.set('organizations', JSON.stringify(organizations));
                  return selectOrgUrl.toString();
               } catch (e) {
                  // Fall through to default
               }
            }
            // Fallback to auth-server's select-org
            return `/select-org?interaction=${uid}&error=${encodeURIComponent(error)}`;
         };

         // Validate organizationId
         if (!organizationId) {
            log.warn({ functionName: 'select-org-submit', uid }, 'auth-server:auth-routes:select-org-submit - No organization ID provided');
            return res.redirect(getAppSelectOrgUrl('Please select an organization.'));
         }

         // Get interaction details
         const interactionDetails = await provider.interactionDetails(req, res);
         
         log.debug({ 
            functionName: 'select-org-submit',
            uid,
            promptName: interactionDetails.prompt.name,
            hasLoginResult: !!interactionDetails.result?.login
         }, 'auth-server:auth-routes:select-org-submit - Interaction details retrieved');

         // Validate this is a select_org interaction
         const { prompt: { name }, result: currentResult } = interactionDetails;
         
         if (name !== 'select_org') {
            log.warn({ 
               functionName: 'select-org-submit', 
               uid, 
               actualPrompt: name 
            }, 'auth-server:auth-routes:select-org-submit - Not a select_org interaction');
            return res.redirect(getAppSelectOrgUrl('Invalid interaction state.'));
         }

         // Get login result to find user info and organizations
         const loginResult = currentResult?.login;
         if (!loginResult) {
            log.error({ functionName: 'select-org-submit', uid }, 'auth-server:auth-routes:select-org-submit - No login result found');
            // Redirect to login since session is expired - use referer origin
            const referer = req.get('referer');
            const loginUrl = referer 
               ? new URL('/login', new URL(referer).origin).toString() + `?error=${encodeURIComponent('Session expired. Please login again.')}`
               : `/login?error=${encodeURIComponent('Session expired. Please login again.')}`;
            return res.redirect(loginUrl);
         }

         // OIDC standard: login.accountId = userId (user identifier, not tenant)
         const { accountId: userId, email, name: userName, organizations, provider: authProvider } = loginResult;
         const orgList = organizations ?? [];

         // Validate the selected organization is in the user's organizations list
         const selectedOrganization = orgList?.find((o: any) => o.organizationId === organizationId);
         if (!selectedOrganization) {
            log.warn({ 
               functionName: 'select-org-submit', 
               uid, 
               organizationId,
               availableOrganizations: orgList?.map((o: any) => o.organizationId)
            }, 'auth-server:auth-routes:select-org-submit - Selected organization not in user list');
            return res.redirect(getAppSelectOrgUrl('Invalid organization selected.', orgList, email, userName));
         }

         log.info({ 
            functionName: 'select-org-submit',
            uid,
            userId,
            selectedOrganizationId: organizationId,
            selectedOrganizationName: selectedOrganization.organizationName
         }, 'auth-server:auth-routes:select-org-submit - Valid organization selected');

         // =====================================================================
         // RESOLVE FULL TENANT INFO FOR SELECTED ORGANIZATION
         // =====================================================================
         const origin = req.get('origin') || req.get('referer') || '';
         const headerSubdomain = (req.get('x-app-subdomain') || '').trim();
         let application = headerSubdomain ? await getApplicationBySubdomain(headerSubdomain) : null;
         let applicationId = application?.id;
         if (!applicationId) {
            let selectOrgAppKey = interactionDetails.params?.app_slug as string | undefined;
            if (!selectOrgAppKey) {
               selectOrgAppKey = await getAppSlug(uid) || undefined;
            }
            if (!selectOrgAppKey && interactionDetails.params?.client_id === REGISTRY_CLI_CLIENT_ID) {
               selectOrgAppKey = process.env.MZ_DEVICE_FLOW_APP_SUBDOMAIN || process.env.DEFAULT_APP_SUBDOMAIN || 'app';
            }
            const subdomain = selectOrgAppKey || extractSubdomainFromOrigin(origin);
            application = subdomain ? await getApplicationBySubdomain(subdomain) : null;
            applicationId = application?.id;
         }

         log.debug({
            functionName: 'select-org-submit',
            organizationId,
            applicationId
         }, 'auth-server:auth-routes:select-org-submit - Resolved tenant info');

         // Create auth result with selected org
         const authResult = createAuthResult({
            userId: userId,
            email: email,
            name: userName || '',
            provider: authProvider || 'password',
            organizationId: organizationId,
            applicationId: applicationId || ''
         });

         // Store the auth result in Redis keyed by userId (OIDC account identifier)
         await storeAuthResult(userId, authResult);

         log.info({ 
            functionName: 'select-org-submit',
            userId,
            organizationId,
            applicationId
         }, 'auth-server:auth-routes:select-org-submit - Auth result stored');

         // Complete the select_org interaction
         // Include the selected organization info so it can be used in token claims
         const result = {
            select_org: {
               organizationId,
               organizationName: selectedOrganization.organizationName,
               applicationId,
            },
         };

         log.info({ 
            functionName: 'select-org-submit',
            uid,
            result
         }, 'auth-server:auth-routes:select-org-submit - Completing select_org interaction');

         await provider.interactionFinished(req, res, result, { mergeWithLastSubmission: true });

      } catch (err: any) {
         log.error({ 
            functionName: 'select-org-submit',
            error: err.message, 
            uid: req.params.uid, 
            stack: err.stack
         }, 'auth-server:auth-routes:select-org-submit - Organization selection error');

         if (err.name === 'SessionNotFound') {
            // Redirect to login - use referer origin if available
            const referer = req.get('referer');
            const loginUrl = referer 
               ? new URL('/login', new URL(referer).origin).toString() + `?error=${encodeURIComponent('Session expired. Please login again.')}`
               : `/login?error=${encodeURIComponent('Session expired. Please login again.')}`;
            return res.redirect(loginUrl);
         }

         next(err);
      }
   });

   /**
    * POST /interaction/:uid/select-organization - Handles organization selection during registration
    * 
    * This endpoint processes organization selection when an existing user registers
    * and has multiple organizations without accounts for this application.
    * 
    * Request Body:
    * - organizationId: Selected organization ID (optional if createNew=true)
    * - createNew: Whether to create a new organization (optional)
    * 
    * @route POST /interaction/:uid/select-organization
    * @param uid - OIDC interaction UID from the provider
    * @middleware setNoCache - Prevents caching of responses
    * @middleware body - Parses URL-encoded form data
    * @returns Completes OIDC select_organization interaction and creates account
    */
   app.post('/interaction/:uid/select-organization', setNoCache, body, async (req: Request, res: Response, next: NextFunction) => {
      try {
         const { uid } = req.params;
         const { organizationId, createNew } = req.body;

         log.info({ 
            functionName: 'select-organization-submit', 
            uid, 
            organizationId,
            createNew: !!createNew
         }, 'auth-server:auth-routes:select-organization-submit - Organization selection received');

         // Helper to build redirect URL back to app-site
         const getAppSelectOrganizationUrl = (error: string, organizations?: any[], email?: string, name?: string) => {
            const referer = req.get('referer');
            if (referer) {
               try {
                  const refererUrl = new URL(referer);
                  const selectOrganizationUrl = new URL('/select-organization', refererUrl.origin);
                  selectOrganizationUrl.searchParams.set('interaction', uid);
                  selectOrganizationUrl.searchParams.set('error', error);
                  if (email) selectOrganizationUrl.searchParams.set('email', email);
                  if (name) selectOrganizationUrl.searchParams.set('name', name);
                  if (organizations) selectOrganizationUrl.searchParams.set('organizations', JSON.stringify(organizations));
                  return selectOrganizationUrl.toString();
               } catch (e) {
                  // Fall through to default
               }
            }
            // Fallback to auth-server's select-organization
            return `/select-organization?interaction=${uid}&error=${encodeURIComponent(error)}`;
         };

         // Validate selection
         if (!organizationId && !createNew) {
            log.warn({ functionName: 'select-organization-submit', uid }, 'auth-server:auth-routes:select-organization-submit - No organization selected');
            return res.redirect(getAppSelectOrganizationUrl('Please select an organization or create a new one.'));
         }

         // Get interaction details
         const interactionDetails = await provider.interactionDetails(req, res);
         
         log.debug({ 
            functionName: 'select-organization-submit',
            uid,
            promptName: interactionDetails.prompt.name,
            hasRegisterResult: !!interactionDetails.result?.register
         }, 'auth-server:auth-routes:select-organization-submit - Interaction details retrieved');

         // Validate this is a select_organization interaction
         const { prompt: { name }, result: currentResult } = interactionDetails;
         
         if (name !== 'select_organization') {
            log.warn({ 
               functionName: 'select-organization-submit', 
               uid, 
               actualPrompt: name 
            }, 'auth-server:auth-routes:select-organization-submit - Not a select_organization interaction');
            return res.redirect(getAppSelectOrganizationUrl('Invalid interaction state.'));
         }

         // Get registration result to find user info and organizations
         const registerResult = currentResult?.register;
         if (!registerResult) {
            log.error({ functionName: 'select-organization-submit', uid }, 'auth-server:auth-routes:select-organization-submit - No register result found');
            const referer = req.get('referer');
            const registerUrl = referer 
               ? new URL('/register', new URL(referer).origin).toString() + `?error=${encodeURIComponent('Session expired. Please register again.')}`
               : `/register?error=${encodeURIComponent('Session expired. Please register again.')}`;
            return res.redirect(registerUrl);
         }

         const { userId, email, name: userName, organizations } = registerResult;
         const orgList = organizations ?? [];

         // Validate the selected organization is in the user's organizations list (if not creating new)
         if (!createNew && organizationId) {
            const selectedOrganization = orgList?.find((o: any) => o.organizationId === organizationId);
            if (!selectedOrganization) {
               log.warn({ 
                  functionName: 'select-organization-submit', 
                  uid, 
                  organizationId,
                  availableOrganizations: orgList?.map((o: any) => o.organizationId)
               }, 'auth-server:auth-routes:select-organization-submit - Selected organization not in user list');
               return res.redirect(getAppSelectOrganizationUrl('Invalid organization selected.', orgList, email, userName));
            }
         }

         log.info({ 
            functionName: 'select-organization-submit',
            uid,
            userId,
            organizationId: organizationId || 'NEW',
            createNew: !!createNew
         }, 'auth-server:auth-routes:select-organization-submit - Valid organization selection');

         // =====================================================================
         // CREATE ACCOUNT FOR SELECTED ORGANIZATION
         // =====================================================================
         const origin = req.get('origin') || req.get('referer') || '';
         const headerSubdomainSelectOrg = (req.get('x-app-subdomain') || '').trim();
         let application = headerSubdomainSelectOrg ? await getApplicationBySubdomain(headerSubdomainSelectOrg) : null;
         let applicationId = application?.id;
         let subdomain: string | null = null;
         if (!applicationId) {
            let selectOrgAppKeyFromInteraction = interactionDetails.params?.app_slug as string | undefined;
            if (!selectOrgAppKeyFromInteraction) {
               selectOrgAppKeyFromInteraction = await getAppSlug(uid) || undefined;
            }
            if (!selectOrgAppKeyFromInteraction && interactionDetails.params?.client_id === REGISTRY_CLI_CLIENT_ID) {
               selectOrgAppKeyFromInteraction = process.env.MZ_DEVICE_FLOW_APP_SUBDOMAIN || process.env.DEFAULT_APP_SUBDOMAIN || 'app';
            }
            subdomain = selectOrgAppKeyFromInteraction || extractSubdomainFromOrigin(origin);
            application = subdomain ? await getApplicationBySubdomain(subdomain) : null;
            applicationId = application?.id;
         }

         if (!applicationId) {
            log.error({ functionName: 'select-organization-submit', subdomain }, 'auth-server:auth-routes:select-organization-submit - Could not resolve application');
            return res.redirect(getAppSelectOrganizationUrl('Could not determine application. Please try again.'));
         }

         // Get user to create identity if needed
         const user = await usersService.getUser(systemContext, userId);
         if (!user) {
            log.error({ functionName: 'select-organization-submit', userId }, 'auth-server:auth-routes:select-organization-submit - User not found');
            return res.redirect(getAppSelectOrganizationUrl('User not found. Please register again.'));
         }

         // Use InternalSignupService to create account
         // Note: Password identity should already be created during registration
         const internalSignupService = getInternalSignupService();
         
         // If creating new organization, don't provide organizationId
         // If using existing organization, provide organizationId
         const signupResult = await internalSignupService.signup({
            email: user.email || email,
            name: user.name || userName,
            provider: 'password',
            providerUserId: email,
            // Don't pass password - identity should already exist from registration
            organizationId: createNew ? undefined : organizationId,
            organizationName: createNew ? `${userName || email}'s Organization` : undefined,
            applicationId,
            origin
         });

         if (!signupResult.success) {
            log.error({ 
               functionName: 'select-organization-submit',
               error: signupResult.error,
               errorCode: signupResult.errorCode
            }, 'auth-server:auth-routes:select-organization-submit - Account creation failed');
            return res.redirect(getAppSelectOrganizationUrl(signupResult.error || 'Failed to create account. Please try again.'));
         }

         if (!signupResult.organizationId) {
            log.error({ 
               functionName: 'select-organization-submit',
               userId,
               organizationId: signupResult.organizationId
            }, 'auth-server:auth-routes:select-organization-submit - Account created without tenant assignment (invalid state)');
            return res.redirect(getAppSelectOrganizationUrl('Failed to assign organization. Please try again or contact support.'));
         }

         log.info({ 
            functionName: 'select-organization-submit',
            userId,
            organizationId: signupResult.organizationId
         }, 'auth-server:auth-routes:select-organization-submit - Account created successfully');

         // Create auth result
         const authResult = createAuthResult({
            userId: userId,
            email: email,
            name: userName || '',
            provider: 'password',
            organizationId: signupResult.organizationId!,
            applicationId: applicationId
         });

         // Store the auth result in Redis keyed by userId (OIDC account identifier)
         await storeAuthResult(userId, authResult);

         log.info({ 
            functionName: 'select-organization-submit',
            userId,
            organizationId: signupResult.organizationId
         }, 'auth-server:auth-routes:select-organization-submit - Auth result stored');

         // Complete the select_organization interaction
         // Include the selected organization info so it can be used in token claims
         const result = {
            select_organization: {
               organizationId: signupResult.organizationId,
               createNew: !!createNew,
            },
            // Also complete login since user is now authenticated
            login: {
               accountId: userId,  // OIDC account identifier is always userId
               acr: '1',
               amr: ['password'],
               remember: true,
               ts: Math.floor(Date.now() / 1000),
            },
         };

         log.info({ 
            functionName: 'select-organization-submit',
            uid,
            result
         }, 'auth-server:auth-routes:select-organization-submit - Completing select_organization interaction');

         await provider.interactionFinished(req, res, result, { mergeWithLastSubmission: true });

      } catch (err: any) {
         log.error({ 
            functionName: 'select-organization-submit',
            error: err.message, 
            uid: req.params.uid, 
            stack: err.stack
         }, 'auth-server:auth-routes:select-organization-submit - Organization selection error');

         if (err.name === 'SessionNotFound') {
            // Redirect to register - use referer origin if available
            const referer = req.get('referer');
            const registerUrl = referer 
               ? new URL('/register', new URL(referer).origin).toString() + `?error=${encodeURIComponent('Session expired. Please register again.')}`
               : `/register?error=${encodeURIComponent('Session expired. Please register again.')}`;
            return res.redirect(registerUrl);
         }

         next(err);
      }
   });

   /**
    * POST /interaction/:uid/register - Handles registration form submission
    * 
    * This endpoint processes registration form submissions from the registration page.
    * It creates a new user using UsersService and completes the OIDC flow.
    * 
    * Request Body:
    * - name: User's full name
    * - email: User's email address
    * - password: User's password
    * - confirmPassword: Password confirmation
    * 
    * @route POST /interaction/:uid/register
    * @param uid - OIDC interaction UID from the provider
    * @middleware setNoCache - Prevents caching of registration responses
    * @middleware body - Parses URL-encoded form data
    * @returns Completes OIDC registration interaction or redirects with error
    */
   app.post('/interaction/:uid/register', setNoCache, body, async (req: Request, res: Response, next: NextFunction) => {
      try {
         const { uid } = req.params;
         log.info({ functionName: 'register-submit', uid, body: req.body }, 'Registration submission received');

         // Add debugging for interaction lookup
         log.debug({ 
            functionName: 'register-submit',
            uid, 
            timestamp: new Date().toISOString() 
         }, 'POST request - attempting to retrieve interaction details');

         // Get interaction details (this will consume the session)
         const interactionDetails = await provider.interactionDetails(req, res);
         log.info({ 
            functionName: 'register-submit',
            interactionDetails, 
            timestamp: new Date().toISOString() 
         }, 'POST request - interaction details retrieved');

         // Validate that this is a register interaction
         // Prompt can be 'register' or 'login' (provider may advance to next prompt before POST is processed)
         const { prompt: { name } } = interactionDetails;
         if (name !== 'register' && name !== 'login') {
            log.warn({ functionName: 'register-submit', promptName: name, uid }, 'auth-server:auth-routes:register-submit - Unexpected prompt, expected register or login');
            return res.redirect(`/register?interaction=${uid}&error=${encodeURIComponent('Invalid session state. Please try again.')}`);
         }

         // Extract registration data from request body
         const { name: userName, email, password, confirmPassword, company } = req.body;
         log.info({ functionName: 'register-submit', email, company }, 'Processing registration request');

         // Validate required fields
         if (!userName || !email || !password || !confirmPassword) {
            log.warn({ functionName: 'register-submit', email }, 'Missing required registration fields');
            return res.redirect(`/register?interaction=${uid}&error=${encodeURIComponent('All fields are required.')}`);
         }

         // Validate password match
         if (password !== confirmPassword) {
            log.warn({ functionName: 'register-submit', email }, 'Password mismatch');
            return res.redirect(`/register?interaction=${uid}&error=${encodeURIComponent('Passwords do not match.')}`);
         }

         // Validate password length
         if (password.length < 8) {
            log.warn({ functionName: 'register-submit', email }, 'Password too short');
            return res.redirect(`/register?interaction=${uid}&error=${encodeURIComponent('Password must be at least 8 characters long.')}`);
         }

         // =====================================================================
         // PHASE 0: Check if user already exists
         // =====================================================================
         // Create AccessContext for user/identity operations
         const accessContext: AccessContext = {
            organizationId: 'public', // Will be updated after user creation
            userId: MORE0_SYSTEM_USER_ID
         };

         const origin = req.get('origin') || req.get('referer') || '';
         // Resolve application: x-app-subdomain header first, then app_slug/subdomain/redirect_uri/default
         const headerSubdomain = (req.get('x-app-subdomain') || '').trim();
         let application = headerSubdomain ? await getApplicationBySubdomain(headerSubdomain) : null;
         let applicationId = application?.id;
         if (applicationId) {
            log.info({ functionName: 'register-submit', applicationId, subdomain: headerSubdomain }, 'auth-server:auth-routes:register - Resolved application from x-app-subdomain header');
         }
         if (!applicationId) {
            let registerAppKey = interactionDetails.params?.app_slug as string | undefined;
            if (!registerAppKey) {
               registerAppKey = await getAppSlug(uid) || undefined;
            }
            const subdomain = registerAppKey || extractSubdomainFromOrigin(origin);
            application = subdomain ? await getApplicationBySubdomain(subdomain) : null;
            applicationId = application?.id;
         }

         // When the user submits from auth server's register page (e.g. auth.more0.dev/register),
         // origin is the auth host so subdomain is "auth" and application is null. Fall back to
         // redirect_uri from the OIDC interaction to determine the requesting app's context.
         if (!applicationId) {
            const redirectUri = interactionDetails.params.redirect_uri as string | undefined;
            if (redirectUri) {
               try {
                  const redirectOrigin = new URL(redirectUri).origin;
                  const redirectSubdomain = extractSubdomainFromOrigin(redirectOrigin);
                  if (redirectSubdomain) {
                     application = await getApplicationBySubdomain(redirectSubdomain);
                     applicationId = application?.id;
                     if (applicationId) {
                        log.info({ functionName: 'register-submit', redirectUri, redirectSubdomain, applicationId }, 'auth-server:auth-routes:register - Resolved application from redirect_uri');
                     }
                  }
               } catch (urlError) {
                  log.warn({ functionName: 'register-submit', redirectUri, error: urlError instanceof Error ? urlError.message : String(urlError) }, 'auth-server:auth-routes:register - Failed to parse redirect_uri for application context');
               }
            }
         }

         // When origin/redirect_uri are localhost (no subdomain), use default app subdomain (e.g. device flow registry-cli, or admin-ui at localhost:3207)
         if (!applicationId) {
            const defaultSubdomain =
               (interactionDetails.params?.client_id === REGISTRY_CLI_CLIENT_ID
                  ? (process.env.MZ_DEVICE_FLOW_APP_SUBDOMAIN || process.env.DEFAULT_APP_SUBDOMAIN || 'app')
                  : null) || getEnvVarWithDefault('REGISTRATION_DEFAULT_APP_SUBDOMAIN', 'app');
            application = await getApplicationBySubdomain(defaultSubdomain);
            applicationId = application?.id;
            if (applicationId) {
               log.info({ functionName: 'register-submit', defaultSubdomain, applicationId }, 'auth-server:auth-routes:register - Resolved application from REGISTRATION_DEFAULT_APP_SUBDOMAIN');
            }
         }

         log.info({ functionName: 'register-submit', email, applicationId }, 'auth-server:auth-routes:register - Checking for existing user');
         const existingUser = await getUserByEmail(email);

         if (existingUser && applicationId) {
            // User exists - check if they already have password identity
            // If they do, they should LOGIN, not register
            log.info({ 
               functionName: 'register-submit', 
               userId: existingUser.userId, 
               email 
            }, 'auth-server:auth-routes:register - Existing user found, checking password identity');

            const existingPasswordIdentity = await userIdentitiesService.getByProviderAndProviderUserId({
               context: systemContext,
               provider: 'password',
               providerUserId: email
            });

            if (existingPasswordIdentity) {
               // User already has password identity - they should login, not register
               // Redirect to external app's login page (not auth-server's internal login)
               log.info({ 
                  functionName: 'register-submit',
                  userId: existingUser.userId
               }, 'auth-server:auth-routes:register - User already has password identity, redirecting to login');
               
               // Get redirect_uri from interaction to determine app's origin
               const redirectUri = interactionDetails.params.redirect_uri as string | undefined;
               if (redirectUri) {
                  try {
                     const redirectOrigin = new URL(redirectUri).origin;
                     const redirectPath = new URL(redirectUri).pathname;
                     const servicePath = redirectPath.split('/api/')[0] || '';
                     const loginUrl = new URL(`${servicePath}/login`, redirectOrigin);
                     loginUrl.searchParams.set('interaction', uid);
                     loginUrl.searchParams.set('email', email);
                     loginUrl.searchParams.set('from', 'register');
                     loginUrl.searchParams.set('message', 'You already have an account. Please sign in.');
                     log.info({ functionName: 'register-submit', loginUrl: loginUrl.toString() }, 'Redirecting to external login page');
                     return res.redirect(loginUrl.toString());
                  } catch (urlError) {
                     log.warn({ functionName: 'register-submit', redirectUri, error: urlError.message }, 'Failed to parse redirect_uri, using auth-server login');
                  }
               }
               // Fallback to auth-server login
               return res.redirect(`${getRequestBaseUrl(req)}/login?interaction=${uid}&email=${encodeURIComponent(email)}&from=register&message=${encodeURIComponent('You already have an account. Please sign in.')}`);
            }

            // User exists but doesn't have password identity
            // This means they registered with a different provider (e.g., Google)
            // They're trying to add password auth to their account
            // This is valid - create password identity and continue with organization selection
            log.info({ 
               functionName: 'register-submit',
               userId: existingUser.userId
            }, 'auth-server:auth-routes:register - Existing user without password identity, creating password identity');
            
            const passwordHash = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
            await userIdentitiesService.createUserIdentity(accessContext, {
               userId: existingUser.userId,
               provider: 'password',
               providerUserId: email,
               displayName: userName,
               rawProfile: { 
                  passwordHash,
                  passwordSetAt: new Date().toISOString(),
                  registeredAt: new Date().toISOString(), 
                  method: 'email_password' 
               }
            });

            // Get user's organizations to determine registration flow
            const userOrganizations = await getOrganizationsForUser(existingUser.userId);

            if (userOrganizations.length > 1) {
               // Multiple organizations - trigger select_organization prompt
               log.info({ 
                  functionName: 'register-submit',
                  userId: existingUser.userId,
                  organizationCount: userOrganizations.length
               }, 'auth-server:auth-routes:register - Multiple organizations, triggering select_organization');

               const organizationsForPrompt = userOrganizations.map(o => ({
                  organizationId: o.id,
                  organizationName: o.name
               }));

               const result = {
                  register: {
                     userId: existingUser.userId,
                     email: existingUser.email,
                     name: existingUser.name || userName,
                     organizations: organizationsForPrompt,
                     requiresOrganizationSelection: true
                  }
               };

               await provider.interactionFinished(req, res, result, { mergeWithLastSubmission: false });
               return;
            } else if (userOrganizations.length === 1) {
               // Single organization - auto-select and continue
               log.info({ 
                  functionName: 'register-submit',
                  userId: existingUser.userId,
                  organizationId: userOrganizations[0].id
               }, 'auth-server:auth-routes:register - Single organization, auto-selecting');

               const internalSignupService = getInternalSignupService();
               
               const signupResult = await internalSignupService.signup({
                  email: existingUser.email,
                  name: existingUser.name || userName,
                  provider: 'password',
                  providerUserId: email,
                  organizationId: userOrganizations[0].id,
                  applicationId,
                  origin
               });

               if (!signupResult.success) {
                  log.error({ functionName: 'register-submit', error: signupResult.error }, 'auth-server:auth-routes:register - Signup failed');
                  return res.redirect(`/register?interaction=${uid}&error=${encodeURIComponent(signupResult.error || 'Registration failed')}`);
               }

               if (!signupResult.organizationId) {
                  log.error({ functionName: 'register-submit', userId: existingUser.userId, organizationId: signupResult.organizationId }, 'auth-server:auth-routes:register - Signup completed without tenant assignment (invalid state)');
                  return res.redirect(`/register?interaction=${uid}&error=${encodeURIComponent('Registration failed: unable to assign organization. Please try again or contact support.')}`);
               }

               const authResult = createAuthResult({
                  userId: existingUser.userId,
                  email: existingUser.email,
                  name: existingUser.name || userName,
                  provider: 'password',
                  organizationId: signupResult.organizationId!,
                  applicationId: applicationId!
               });

               await storeAuthResult(existingUser.userId, authResult);

               const result = {
                  register: {
                     userId: existingUser.userId,
                     email: existingUser.email,
                     name: existingUser.name || userName,
                     completed: true
                  },
                  login: {
                     accountId: existingUser.userId,  // OIDC account identifier is always userId
                     acr: '1',
                     amr: ['password'],
                     remember: true,
                     ts: Math.floor(Date.now() / 1000),
                  }
               };

               await provider.interactionFinished(req, res, result, { mergeWithLastSubmission: false });
               return;
            } else {
               // User has no organizations - redirect to login (they already exist but need org setup)
               log.info({ 
                  functionName: 'register-submit',
                  userId: existingUser.userId
               }, 'auth-server:auth-routes:register - No organizations found, redirecting to login');
               
               const redirectUri = interactionDetails.params.redirect_uri as string | undefined;
               if (redirectUri) {
                  try {
                     const redirectOrigin = new URL(redirectUri).origin;
                     const redirectPath = new URL(redirectUri).pathname;
                     const servicePath = redirectPath.split('/api/')[0] || '';
                     const loginUrl = new URL(`${servicePath}/login`, redirectOrigin);
                     loginUrl.searchParams.set('interaction', uid);
                     loginUrl.searchParams.set('email', email);
                     loginUrl.searchParams.set('from', 'register');
                     loginUrl.searchParams.set('message', 'You already have an account. Please sign in.');
                     log.info({ functionName: 'register-submit', loginUrl: loginUrl.toString() }, 'Redirecting to external login page');
                     return res.redirect(loginUrl.toString());
                  } catch (urlError) {
                     log.warn({ functionName: 'register-submit', redirectUri, error: urlError.message }, 'Failed to parse redirect_uri, using auth-server login');
                  }
               }
               return res.redirect(`${getRequestBaseUrl(req)}/login?interaction=${uid}&email=${encodeURIComponent(email)}&from=register&message=${encodeURIComponent('You already have an account. Please sign in.')}`);
            }
         }

         // User doesn't exist - create new user with full provisioning using ApplicationSignupService
         // This creates user, user_identity, organization, organization_user in one transaction

         // =====================================================================
         // UNIFIED SIGNUP: Create all records in a single transaction
         // =====================================================================
         
         // Require applicationId for new user registration
         if (!applicationId) {
            log.error({ functionName: 'register-submit', email, origin }, 'auth-server:auth-routes:register - Cannot register: no application context');
            return res.redirect(`/register?interaction=${uid}&error=${encodeURIComponent('Registration failed: unable to determine application context.')}`);
         }

         log.info({ 
            functionName: 'register-submit', 
            email, 
            applicationId,
            organizationName: company || userName
         }, 'auth-server:auth-routes:register - Starting unified signup via ApplicationSignupService');

         const internalSignupService = getInternalSignupService();
         
         const signupResult = await internalSignupService.signup({
            email,
            name: userName,
            provider: 'password',
            providerUserId: email,
            password, // Service will hash the password
            organizationName: company || `${userName}'s Organization`,
            applicationId,
            origin
         });

         if (!signupResult.success) {
            log.error({ 
               functionName: 'register-submit', 
               email, 
               error: signupResult.error,
               errorCode: signupResult.errorCode
            }, 'auth-server:auth-routes:register - Unified signup failed');
            return res.redirect(`/register?interaction=${uid}&error=${encodeURIComponent(signupResult.error || 'Registration failed')}`);
         }

         // Enforce: user MUST be assigned to a tenant (organization) on registration
         if (!signupResult.organizationId) {
            log.error({ 
               functionName: 'register-submit', 
               email, 
               userId: signupResult.userId,
               organizationId: signupResult.organizationId
            }, 'auth-server:auth-routes:register - Registration completed without tenant assignment (invalid state)');
            return res.redirect(`/register?interaction=${uid}&error=${encodeURIComponent('Registration failed: unable to assign organization. Please try again or contact support.')}`);
         }

         log.info({ 
            functionName: 'register-submit',
            userId: signupResult.userId,
            organizationId: signupResult.organizationId,
            userIdentityId: signupResult.userIdentityId,
            scenario: signupResult.scenario
         }, 'auth-server:auth-routes:register - Unified signup completed successfully');

         // Create auth result with full tenant information
         const authResult = createAuthResult({
            userId: signupResult.userId!,
            email,
            name: userName,
            provider: 'password',
            organizationId: signupResult.organizationId!,
            applicationId
         });

         // Store the auth result in Redis keyed by userId (OIDC account identifier)
         await storeAuthResult(signupResult.userId!, authResult);

         log.info({ 
            functionName: 'register-submit',
            userId: signupResult.userId,
            organizationId: signupResult.organizationId,
            applicationId
         }, 'auth-server:auth-routes:register - Auth result stored, completing register interaction');

         // Include both register and login so the provider accepts the result whether
         // the current prompt is still 'register' or has advanced to 'login'
         const result = {
            register: {
               userId: signupResult.userId,
               email,
               name: userName,
               organizationId: signupResult.organizationId,
               applicationId,
               completed: true
            },
            login: {
               accountId: signupResult.userId!,
               acr: '1',
               amr: ['password'],
               remember: true,
               ts: Math.floor(Date.now() / 1000),
            }
         };

         await provider.interactionFinished(req, res, result, { mergeWithLastSubmission: false });
      } catch (err) {
         // Handle registration errors
         log.error({ 
            functionName: 'register-submit',
            error: err.message,
            email: req.body?.email,
            uid: req.params?.uid
         }, 'auth-server:auth-routes:register - Registration error');

         // Handle specific errors with user-friendly messages
         if (err.message && (err.message.includes('duplicate') || err.message.includes('already exists') || err.message.includes('unique'))) {
            return res.redirect(`/register?interaction=${req.params.uid}&error=${encodeURIComponent('An account with this email already exists. Please sign in instead.')}`);
         }

         if (err.name === 'SessionNotFound') {
            return res.redirect(`/register?interaction=${req.params.uid}&error=${encodeURIComponent('Session expired. Please try again.')}`);
         }

         // Pass other errors to Express error handler
         next(err);
      }
   });

   // =============================================================================
   // ADD PASSWORD IDENTITY ENDPOINT (SCENARIO 1)
   // =============================================================================

   /**
    * POST /api/auth/add-password - Add password identity to existing OAuth user
    * 
    * SCENARIO 1: User registered with OAuth, now wants to add password authentication
    * 
    * This endpoint allows users who registered via OAuth (Google, Apple, etc.) to
    * add password authentication to their account. The user must be authenticated
    * via their OAuth identity first to prove their identity.
    * 
    * Security:
    * - User must be authenticated (userId should come from authenticated session/token)
    * - User must have at least one OAuth identity (not password-only)
    * - Email must match the user's account email
    * 
    * @route POST /api/auth/add-password
    * @middleware body - Parses URL-encoded or JSON form data
    * @param userId - User ID (should come from authenticated session/token)
    * @param email - User's email (must match account)
    * @param password - Password to set (min 8 characters)
    * @returns JSON response with success status and identity ID
    */
   app.post('/api/auth/add-password', body, async (req: Request, res: Response, next: NextFunction) => {
      try {
         const functionName = 'add-password';
         const { userId, email, password } = req.body;
         
         log.info({ 
            functionName, 
            userId, 
            email,
            hasPassword: !!password 
         }, 'auth-server:auth-routes:add-password - Add password identity request received');

         // Validate required fields
         if (!userId || !email || !password) {
            log.warn({ functionName, userId, email, hasPassword: !!password }, 
               'auth-server:auth-routes:add-password - Missing required fields');
            return res.status(400).json({
               error: 'VALIDATION_ERROR',
               message: 'userId, email, and password are required'
            });
         }

         // Call the service to add password identity
         const result = await addPasswordIdentityToUser({
            userId,
            email,
            password
         });

         if (!result.success) {
            log.warn({ 
               functionName, 
               userId, 
               email, 
               error: result.error,
               errorCode: result.errorCode 
            }, 'auth-server:auth-routes:add-password - Failed to add password identity');

            const statusCode = result.errorCode === 'IDENTITY_ALREADY_EXISTS' ? 409 : 400;
            return res.status(statusCode).json({
               error: result.errorCode || 'ADD_PASSWORD_FAILED',
               message: result.error || 'Failed to add password identity'
            });
         }

         log.info({ 
            functionName, 
            userId, 
            email, 
            identityId: result.identityId 
         }, 'auth-server:auth-routes:add-password - Password identity added successfully');

         return res.status(200).json({
            success: true,
            identityId: result.identityId,
            message: 'Password identity added successfully'
         });

      } catch (error: any) {
         log.error({
            functionName: 'add-password',
            error: error.message,
            stack: error.stack
         }, 'auth-server:auth-routes:add-password - Unexpected error');

         return res.status(500).json({
            error: 'INTERNAL_ERROR',
            message: 'An unexpected error occurred'
         });
      }
   });

   // =============================================================================
   // INTERACTION ABORT ROUTES
   // =============================================================================

   /**
    * GET /interaction/:uid/abort - Handles interaction abortion
    * 
    * This endpoint allows users to abort OIDC interactions (e.g., cancel login).
    * It completes the interaction with an access_denied error.
    * 
    * @route GET /interaction/:uid/abort
    * @param uid - OIDC interaction UID from the provider
    * @middleware setNoCache - Prevents caching of abort responses
    * @returns Completes OIDC interaction with access_denied error
    */
   app.get('/interaction/:uid/abort', setNoCache, async (req: Request, res: Response, next: NextFunction) => {
      try {
         const { uid } = req.params;
         log.info({ functionName: 'abort', uid }, 'Interaction abort requested');

         // Prepare abort result for OIDC provider
         const result = {
            error: 'access_denied',
            error_description: 'End-User aborted interaction',
         };

         // Complete the interaction with abort result
         await provider.interactionFinished(req, res, result, { mergeWithLastSubmission: false });
         log.info({ functionName: 'abort', uid }, 'Interaction aborted successfully');
      } catch (err) {
         log.error({ 
            error: err.message, 
            uid: req.params.uid 
         }, 'auth-server:auth-routes:abort - Interaction abort error');
         next(err);
      }
   });

   /**
    * POST /interaction/:uid/consent - Handles consent form submission
    * 
    * This endpoint processes consent form submissions from the consent page.
    * It creates/updates grants based on user-selected scopes and completes the OIDC flow.
    * 
    * Request Body:
    * - scopes: Array of selected OIDC scopes
    * - resourceScopes: Object mapping resource URLs to arrays of selected scopes
    * 
    * @route POST /interaction/:uid/consent
    * @param uid - OIDC interaction UID from the provider
    * @middleware setNoCache - Prevents caching of consent responses
    * @middleware body - Parses URL-encoded form data
    * @returns Completes OIDC consent interaction or redirects with error
    */
   app.post('/interaction/:uid/consent', setNoCache, body, async (req: Request, res: Response, next: NextFunction) => {
      try {
         const { uid } = req.params;
         log.info({ 
            functionName: 'consent-submit', 
            uid, 
            body: req.body,
            bodyKeys: Object.keys(req.body || {}),
            bodyType: typeof req.body,
            hasResourceScopes: !!req.body.resourceScopes,
            resourceScopesType: typeof req.body.resourceScopes
         }, 'Consent submission received');

         // Get interaction details
         const interactionDetails = await provider.interactionDetails(req, res);
         // OIDC standard: session.accountId = userId (user identifier, not tenant)
         const { prompt: { details }, session: { accountId }, grantId, params: interactionParams } = interactionDetails;
         const params = interactionParams as any;

         // Detect which resource this request is about
         const resource = Array.isArray(interactionParams.resource) 
            ? interactionParams.resource[0] 
            : (interactionParams.resource as string | undefined);

         // Get selected scopes from form
         const selectedScopes = Array.isArray(req.body.scopes) ? req.body.scopes : 
                               req.body.scopes ? [req.body.scopes] : [];
         
         // Get selected resource scopes from form
         // Handle both nested object format (extended: true) and flat format
         const selectedResourceScopes: Record<string, string[]> = {};
         if (req.body.resourceScopes) {
            if (typeof req.body.resourceScopes === 'object' && !Array.isArray(req.body.resourceScopes)) {
               // Nested object format: { "https://resource.com": ["scope1", "scope2"] }
               for (const [res, scopes] of Object.entries(req.body.resourceScopes)) {
                  selectedResourceScopes[res] = Array.isArray(scopes) ? scopes : [scopes];
               }
            }
         }
         
         // Also check for flat format: resourceScopes[resource]=scope
         // This handles cases where extended parsing might not work as expected
         for (const [key, value] of Object.entries(req.body)) {
            if (key.startsWith('resourceScopes[') && key.endsWith(']')) {
               const res = key.slice('resourceScopes['.length, -1);
               if (!selectedResourceScopes[res]) {
                  selectedResourceScopes[res] = [];
               }
               if (Array.isArray(value)) {
                  selectedResourceScopes[res].push(...value);
               } else {
                  selectedResourceScopes[res].push(String(value));
               }
            }
         }
         
         log.info({ 
            functionName: 'consent-submit',
            uid,
            selectedScopes,
            selectedScopesCount: selectedScopes.length,
            selectedResourceScopes,
            resourceScopesCount: Object.keys(selectedResourceScopes).length,
            resource,
            rawBody: req.body,
            bodyKeys: Object.keys(req.body || {})
         }, 'Parsed scopes from form submission');

         log.info({ 
            functionName: 'consent-submit',
            uid,
            selectedScopes,
            selectedResourceScopes,
            accountId,
            grantId
         }, 'Processing consent with selected scopes');

         // Create or find existing grant
         let grant;
         if (grantId) {
            grant = await provider.Grant.find(grantId);
            log.info({ functionName: 'consent-submit', uid, grantId }, 'Using existing grant');
         } else {
            grant = new provider.Grant({
               accountId,
               clientId: params.client_id,
            });
            log.info({ functionName: 'consent-submit', uid }, 'Created new grant');
         }

         // Collect all scopes that need to be granted as OIDC scopes
         const oidcScopesToGrant = new Set<string>(selectedScopes);
         
         // Add selected resource scopes to the grant (for MCP resources)
         // Only grant what the user selected for this MCP resource
         if (resource && selectedResourceScopes[resource]) {
            const scopes = selectedResourceScopes[resource];
            if (scopes.length > 0) {
               log.info({ functionName: 'consent-submit', uid, resource, scopes }, 'Adding selected resource scopes for MCP resource');
               for (const scope of scopes) {
                  grant.addResourceScope(resource, scope);
                  
                  // If this scope was also in missingOIDCScope, grant it as OIDC scope too
                  // This handles cases where a scope appears in both missingOIDCScope and missingResourceScopes
                  if (details.missingOIDCScope?.includes(scope)) {
                     oidcScopesToGrant.add(scope);
                     log.info({ functionName: 'consent-submit', uid, scope }, 'Scope was also missing as OIDC scope, will grant as OIDC scope too');
                  }
               }
            }
         } else if (Object.keys(selectedResourceScopes).length > 0) {
            // Fallback: if resource not in params but we have resource scopes, add them all
            for (const [res, scopes] of Object.entries(selectedResourceScopes)) {
               if (scopes.length > 0) {
                  log.info({ functionName: 'consent-submit', uid, res, scopes }, 'Adding selected resource scopes');
                  for (const scope of scopes) {
                     grant.addResourceScope(res, scope);
                     
                     // If this scope was also in missingOIDCScope, grant it as OIDC scope too
                     if (details.missingOIDCScope?.includes(scope)) {
                        oidcScopesToGrant.add(scope);
                     }
                  }
               }
            }
         }
         
         // Add selected OIDC scopes to the grant (if any)
         if (oidcScopesToGrant.size > 0) {
            log.info({ functionName: 'consent-submit', uid, oidcScopes: Array.from(oidcScopesToGrant) }, 'Adding selected OIDC scopes');
            grant.addOIDCScope(Array.from(oidcScopesToGrant).join(' '));
         }
         
         // If no scopes were selected at all, this is an error - user must select at least one
         if (selectedScopes.length === 0 && Object.keys(selectedResourceScopes).length === 0) {
            log.warn({ functionName: 'consent-submit', uid }, 'No scopes selected - this should not happen as all are checked by default');
            // Still proceed - the grant will be created but with no scopes
            // The OIDC provider will handle this appropriately
         }
         
         // Ensure we have at least some scopes to grant
         // If only resource scopes are present, that's fine - resource scopes are valid
         const hasAnyScopes = selectedScopes.length > 0 || Object.keys(selectedResourceScopes).some(r => selectedResourceScopes[r].length > 0);
         if (!hasAnyScopes) {
            log.error({ 
               functionName: 'consent-submit', 
               uid,
               selectedScopes,
               selectedResourceScopes,
               resource,
               rawBody: req.body,
               bodyKeys: Object.keys(req.body || {}),
               detailsMissingOIDCScope: details.missingOIDCScope,
               detailsMissingResourceScopes: details.missingResourceScopes
            }, 'No scopes to grant - this indicates a form submission issue');
            throw new Error('No scopes were selected. Please select at least one permission.');
         }

         // Add requested OIDC claims if any
         if (details.missingOIDCClaims) {
            log.info({ functionName: 'consent-submit', uid, missingClaims: details.missingOIDCClaims }, 'Adding missing OIDC claims');
            grant.addOIDCClaims(details.missingOIDCClaims);
         }

         // Save the grant
         const newGrantId = await grant.save();
         log.info({ functionName: 'consent-submit', uid, newGrantId, wasExisting: !!grantId }, 'Grant saved');

         // Prepare consent result
         const result = {
            consent: {
               grantId: !grantId ? newGrantId : undefined
            }
         };

         // Complete the interaction
         await provider.interactionFinished(req, res, result, { mergeWithLastSubmission: true });
         log.info({ functionName: 'consent-submit', uid }, 'Consent interaction completed');
      } catch (err) {
         log.error({ 
            functionName: 'consent-submit',
            error: err.message, 
            uid: req.params.uid, 
            stack: err.stack
         }, 'Consent submission error');

         // Handle session not found
         if (err.name === 'SessionNotFound') {
            return res.redirect(`/interaction/${req.params.uid}?error=${encodeURIComponent('Session not found or expired. Please try again.')}`);
         }

         // Re-render consent page with error
         try {
            const interactionDetails = await provider.interactionDetails(req, res);
            const { prompt: { details }, params: interactionParams } = interactionDetails;
            const params = interactionParams as any;
            const client = await provider.Client.find(params.client_id);
            const clientName = client?.clientName || client?.clientId || 'Application';
            
            // Detect which resource this request is about
            const resource = Array.isArray(interactionParams.resource) 
               ? interactionParams.resource[0] 
               : (interactionParams.resource as string | undefined);
            
            const scopeDescriptions: Record<string, { name: string; description: string }> = {
               'openid': { name: 'OpenID Connect', description: 'Basic authentication and identity information' },
               'profile': { name: 'Profile Information', description: 'Access to your profile information (name, picture, etc.)' },
               'email': { name: 'Email Address', description: 'Access to your email address' },
               'address': { name: 'Address', description: 'Access to your address information' },
               'phone': { name: 'Phone Number', description: 'Access to your phone number' },
               'offline_access': { name: 'Offline Access', description: 'Access your account when you are not present (refresh tokens)' },
               'mcp:tools': { name: 'MCP Tools', description: 'Access to MCP (Model Context Protocol) tools and resources' }
            };
            
            // For MCP resources, prioritize resource scopes over OIDC scopes to avoid duplicates
            const resourceScopes: Record<string, Array<{ value: string; name: string; description: string; required: boolean }>> = {};
            const resourceScopeValues = new Set<string>();
            
            if (resource && details.missingResourceScopes?.[resource]) {
               const scopes = details.missingResourceScopes[resource];
               const scopeArray = Array.isArray(scopes) ? scopes : [scopes];
               resourceScopes[resource] = scopeArray.map(scope => {
                  const scopeStr = String(scope);
                  resourceScopeValues.add(scopeStr);
                  return {
                     value: scopeStr,
                     name: scopeDescriptions[scopeStr]?.name || scopeStr,
                     description: scopeDescriptions[scopeStr]?.description || `Access to ${scopeStr} for ${resource}`,
                     required: false
                  };
               });
            }
            
            // Build OIDC scopes list - exclude scopes that are already shown as resource scopes
            // For MCP resources, if we have resource scopes, don't show OIDC scopes (they're duplicates)
            const oidcScopes = (resource && resourceScopeValues.size > 0) 
               ? [] // Don't show OIDC scopes if we have resource scopes (avoid duplicates)
               : (details.missingOIDCScope?.filter(scope => !resourceScopeValues.has(scope)).map(scope => ({
                  value: scope,
                  name: scopeDescriptions[scope]?.name || scope,
                  description: scopeDescriptions[scope]?.description || `Access to ${scope} scope`,
                  required: false
               })) || []);
            
            const errorConsentHtml = renderPage(
               React.createElement(ConsentPage, {
                  uid: req.params.uid,
                  clientName,
                  resource,
                  oidcScopes,
                  resourceScopes,
                  error: err.message || 'An error occurred processing your consent',
               }),
               { title: 'Authorize Application - More0' }
            );
            return res.send(errorConsentHtml);
         } catch (renderError) {
            return next(err);
         }
      }
   });

   // =============================================================================
   // LOGOUT ROUTES
   // =============================================================================

   const cookieClearOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict' as const,
      path: '/'
   };

   /**
    * Decode id_token_hint JWT payload to get sub (accountId). No signature verification;
    * used only for logout cleanup. Returns null if decode fails.
    */
   function decodeIdTokenHintSub(idTokenHint: string): string | null {
      try {
         const parts = idTokenHint.split('.');
         if (parts.length !== 3) return null;
         const payload = JSON.parse(
            Buffer.from(parts[1], 'base64url').toString('utf8')
         );
         return typeof payload.sub === 'string' ? payload.sub : null;
      } catch {
         return null;
      }
   }

   /**
    * Shared logout cleanup: clear Redis account data (when accountId known) and auth-server cookies.
    * Returns accountId if id_token_hint was decoded, else undefined.
    */
   async function performLogoutCleanup(res: Response, idTokenHint: string | undefined): Promise<string | undefined> {
      let accountId: string | undefined;
      if (idTokenHint) {
         accountId = decodeIdTokenHintSub(idTokenHint);
         if (accountId) {
            try {
               await deleteStoredAuthResult(accountId);
            } catch (err) {
               log.warn({
                  error: err instanceof Error ? err.message : String(err),
                  accountId
               }, 'auth-server:auth-routes:performLogoutCleanup - deleteStoredAuthResult failed (non-fatal)');
            }
         }
      }
      res.clearCookie('access_token', cookieClearOptions);
      res.clearCookie('refresh_token', cookieClearOptions);
      return accountId;
   }

   /**
    * POST /logout - Programmatic logout: optional id_token_hint, Redis cleanup, clear cookies, JSON response.
    * Does not use provider.interactionFinished(); performs session/account cleanup directly.
    */
   app.post('/logout', async (req: Request, res: Response) => {
      log.info({
         clientIP: req.ip,
         userAgent: req.headers['user-agent']
      }, 'auth-server:auth-routes:logout - Logout request received');

      const body = req.body && typeof req.body === 'object' ? req.body : {};
      const idTokenHint = body.id_token_hint ?? (typeof req.query?.id_token_hint === 'string' ? req.query.id_token_hint : undefined);

      await performLogoutCleanup(res, idTokenHint);

      log.info({
         action: 'logout',
         hadIdTokenHint: !!idTokenHint
      }, 'auth-server:auth-routes:logout - Logout completed');

      return res.json({
         success: true,
         message: 'Logged out successfully'
      });
   });

   /**
    * GET /logout - Redirect-based logout: optional post_logout_redirect_uri and id_token_hint.
    * Same cleanup as POST /logout; redirects if URI matches registered post_logout_redirect_uri.
    */
   app.get('/logout', async (req: Request, res: Response) => {
      log.info({
         clientIP: req.ip,
         userAgent: req.headers['user-agent']
      }, 'auth-server:auth-routes:logout - GET logout request received');

      const idTokenHint = typeof req.query?.id_token_hint === 'string' ? req.query.id_token_hint : undefined;
      const postLogoutRedirectUri = typeof req.query?.post_logout_redirect_uri === 'string' ? req.query.post_logout_redirect_uri : undefined;

      await performLogoutCleanup(res, idTokenHint);

      const allowedRedirect = getPostLogoutRedirectUrl();
      if (postLogoutRedirectUri && postLogoutRedirectUri === allowedRedirect) {
         log.info({ postLogoutRedirectUri }, 'auth-server:auth-routes:logout - Redirecting after GET logout');
         return res.redirect(postLogoutRedirectUri);
      }

      log.info({ action: 'get_logout' }, 'auth-server:auth-routes:logout - GET logout completed, returning JSON');
      return res.json({
         success: true,
         message: 'Logged out successfully'
      });
   });



   // =============================================================================
   // ERROR HANDLING MIDDLEWARE
   // =============================================================================

   /**
    * Global error handler for authentication routes
    * 
    * This middleware handles common OIDC errors and provides appropriate responses.
    * It specifically handles SessionNotFound errors which are common in OIDC flows.
    * 
    * @param err - Error object from previous middleware
    * @param req - Express Request object
    * @param res - Express Response object
    * @param next - Express NextFunction
    */
   app.use((err: any, req: Request, res: Response, next: NextFunction) => {
      if (err.name === 'SessionNotFound') {
         // Handle interaction expired / session not found error
         log.warn({ 
            uid: req.params.uid 
         }, 'auth-server:auth-routes:error-handler - Interaction session not found');
         return res.status(400).send('Session expired. Please try again.');
      }
      
      // Pass other errors to Express default error handler
      next(err);
   });
}