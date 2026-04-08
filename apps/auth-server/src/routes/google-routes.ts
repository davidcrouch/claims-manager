import { Application, Request, Response, NextFunction } from 'express';
import { createLogger, LoggerType } from '../lib/logger.js';
import { createTelemetryLogger } from '@morezero/telemetry';
import { getBaseUrl, getPostLoginRedirectUrl, getGoogleOAuthConfig, getClientCallbackUrl, getApiUrl, getClientId } from '../config/env-validation.js';
import { 
   storeAuthResult,
   storeOAuthState,
   consumeOAuthState,
   storeGoogleAuthCode,
   consumeGoogleAuthCode,
   type OAuthStateData,
   type GoogleAuthCodeData
} from '../config/oidc-provider.js';
import type { NewUser } from '../schemas/index.js';
import { GlobalCacheManager } from '../lib/cache/global-cache-manager.js';
import axios from 'axios';
import { randomBytes } from 'node:crypto';
import { urlencoded } from 'express';
import {
   resolveOrganization,
   createAuthResult,
   type OrganizationResolutionResult,
   type OrganizationInfo
} from '../services/organization-resolution-service.js';
import {
   registerIdentity,
   identityExists,
   type IdentityRegistrationInput
} from '../services/identity-registration-service.js';

const baseLogger = createLogger('auth-server:google-routes', LoggerType.NODEJS);
const log = createTelemetryLogger(baseLogger, 'google-routes', 'GoogleRoutes', 'auth-server');

// OAuth state storage is now handled by Redis via oidc-provider.ts functions:
// - storeOAuthState / consumeOAuthState for CSRF state
// - storeGoogleAuthCode / consumeGoogleAuthCode for auth code exchange

export default function createGoogleRoutes(app: Application, provider?: any): void {
   // Body parser for POST requests
   const body = urlencoded({ extended: true });

   // Endpoint to complete OIDC interaction after signup
   app.get('/complete-signup', async (req: Request, res: Response, next: NextFunction) => {
      log.info({
         method: req.method,
         path: req.path,
         query: req.query
      }, 'auth-server:google-routes:complete-signup - Completing OIDC interaction after signup');

      try {
         const interactionUid = req.query.interaction as string;
         const userId = req.query.userId as string;
         const email = req.query.email as string;
         const name = req.query.name as string;
         const avatarUrl = req.query.avatarUrl as string | undefined;

         if (!interactionUid || !userId || !email) {
            log.error({ interactionUid, userId, email }, 'auth-server:google-routes:complete-signup - Missing required params');
            const callbackUri = getClientCallbackUrl();
            const appBaseUrl = new URL(callbackUri).origin;
            return res.redirect(`${appBaseUrl}/app/register?error=${encodeURIComponent('Invalid signup completion request.')}`);
         }

         if (!provider) {
            log.error({}, 'auth-server:google-routes:complete-signup - OIDC provider not available');
            const callbackUri = getClientCallbackUrl();
            const appBaseUrl = new URL(callbackUri).origin;
            return res.redirect(`${appBaseUrl}/app/register?error=${encodeURIComponent('Authentication service unavailable.')}`);
         }

         // Prepare login result for OIDC provider
         // OIDC account identifier should always be userId (per OIDC standard)
         const result = {
            login: {
               accountId: userId,  // OIDC account identifier is always userId
               acr: '1', // Authentication Context Class Reference
               amr: ['google'], // Authentication Method References
               remember: true,
               ts: Math.floor(Date.now() / 1000), // Timestamp
            },
         };

         const authResult = {
            user: {
               userId: userId,
               email: email,
               name: name,
               avatarURL: avatarUrl || ''
            }
         };
         
         try {
            await storeAuthResult(userId, authResult);
            log.info({ userId }, 'auth-server:google-routes:complete-signup - Auth result stored successfully');
         } catch (storeError: any) {
            log.error({
               error: storeError.message,
               userId
            }, 'auth-server:google-routes:complete-signup - Failed to store auth result, continuing with interaction');
            // Continue even if account storage fails
         }

         // Complete the OIDC interaction
         try {
            // Check if interaction exists before trying to finish it
            let interactionDetails;
            try {
               interactionDetails = await provider.interactionDetails(req, res);
               log.debug({ 
                  interactionUid: interactionDetails.uid,
                  prompt: interactionDetails.prompt?.name,
                  params: interactionDetails.params 
               }, 'auth-server:google-routes:complete-signup - Interaction details retrieved');
            } catch (detailsError: any) {
               log.warn({
                  error: detailsError.message,
                  interactionUid,
                  errorName: detailsError.name
               }, 'auth-server:google-routes:complete-signup - Could not retrieve interaction details, interaction may be expired or invalid');
               // Continue anyway - interactionFinished will handle the error
            }

            await provider.interactionFinished(req, res, result, { mergeWithLastSubmission: false });
            log.info({ interactionUid, userId }, 'auth-server:google-routes:complete-signup - OIDC interaction completed successfully');
            return; // interactionFinished handles the response
         } catch (interactionError: any) {
            // OIDC interaction expired or invalid - this is expected if user took too long
            // Signup was successful, so redirect to login page with success message
            // User will do a fresh login which will work now that their account exists
            log.info({
               error: interactionError.message,
               interactionUid,
               userId
            }, 'auth-server:google-routes:complete-signup - OIDC interaction expired, redirecting to login (signup was successful)');
            
            const callbackUri = getClientCallbackUrl();
            const appBaseUrl = new URL(callbackUri).origin;
            const serviceUrl = process.env.MOREZERO_SERVICE ? "/" + process.env.MOREZERO_SERVICE : "";
            // Redirect to login page with registered=1 to show success message
            return res.redirect(`${appBaseUrl}${serviceUrl}/login?registered=1`);
         }
      } catch (error: any) {
         log.error({
            error: error.message,
            stack: error.stack
         }, 'auth-server:google-routes:complete-signup - Failed to complete signup');
         
         const callbackUri = getClientCallbackUrl();
         const appBaseUrl = new URL(callbackUri).origin;
         const serviceUrl = process.env.MOREZERO_SERVICE ? "/" + process.env.MOREZERO_SERVICE : "";
         // Redirect to login page with success message - signup was successful even if OIDC failed
         return res.redirect(`${appBaseUrl}${serviceUrl}/login?registered=1`);
      }
   });
   // Google OAuth start endpoint - redirects to Google OAuth
   app.get('/login/google/start', async (req: Request, res: Response, next: NextFunction) => {
      log.info({
         method: req.method,
         path: req.path,
         hasInteraction: !!req.query.interaction,
         hasState: !!req.query.state,
         clientIP: req.ip,
         userAgent: req.headers['user-agent']
      }, 'auth-server:google-routes:start - Google OAuth login initiated');

      try {
         const googleConfig = getGoogleOAuthConfig();
         
         if (!googleConfig) {
            throw new Error('Google OAuth is not configured. Please set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET');
         }

         const host = req.get('host');
         const baseUrl = host ? `${req.protocol}://${host}` : getBaseUrl();
         
         // Get interaction UID if present (for OIDC flow)
         // Note: 'state' query param is used for interaction UID in login.ejs, but we'll use 'interaction' to avoid confusion
         const interactionUid = (req.query.interaction || req.query.state) as string | undefined;
         
         if (!interactionUid) {
            log.warn({
               queryParams: Object.keys(req.query).join(', ') || 'none',
               referer: req.headers.referer || 'none',
            }, 'auth-server:google-routes:start - No interaction UID provided. User may have bypassed OIDC authorize flow.');
         }
         
         log.debug({
            interactionUid: interactionUid || 'undefined',
            hasCookies: !!req.cookies,
            hasInteractionCookie: !!(req.cookies?._interaction || req.cookies?._interaction_resume)
         }, 'auth-server:google-routes:start - Extracted params');
         
         // Resolve the client redirect_uri from the OIDC interaction stored in Redis
         let clientRedirectUri: string | undefined;
         if (interactionUid) {
            try {
               const redis = await GlobalCacheManager.getInstance('auth-server');
               const interactionData = await redis.get<Record<string, any>>(`oidc:Interaction:${interactionUid}`);
               clientRedirectUri = interactionData?.params?.redirect_uri as string | undefined;
               log.info({ interactionUid, clientRedirectUri, hasData: !!interactionData, hasParams: !!interactionData?.params }, 'auth-server:google-routes:start - Resolved client redirect_uri from interaction');
            } catch (detailsErr: any) {
               log.warn({ error: detailsErr.message, interactionUid }, 'auth-server:google-routes:start - Could not read interaction from Redis');
            }
         }

         // Generate a random state parameter for CSRF protection
         const csrfState = randomBytes(32).toString('hex');
         await storeOAuthState(csrfState, { 
            createdAt: Date.now(),
            interactionUid: interactionUid,
            clientRedirectUri: clientRedirectUri
         });

         // Build Google OAuth authorization URL
         const params = new URLSearchParams({
            client_id: googleConfig.clientId,
            redirect_uri: googleConfig.redirectUri,
            response_type: 'code',
            scope: 'openid email profile',
            state: csrfState, // Use CSRF state for Google OAuth
            access_type: 'offline', // Request refresh token
            prompt: 'consent' // Force consent screen to get refresh token
         });

         const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;

         log.info({
            redirectUrl: params.get('redirect_uri'),
            baseUrl: baseUrl,
            method: 'google_oauth_start',
            clientId: params.get('client_id'),
            hasInteractionUid: !!interactionUid
         }, 'auth-server:google-routes:start - Redirecting to Google OAuth');

         res.redirect(googleAuthUrl);
      } catch (error) {
         log.error({
            error: error.message,
            stack: error.stack
         }, 'auth-server:google-routes:start - Failed to initiate Google OAuth login');

         res.status(500).json({
            error: 'Failed to initiate Google login'
         });
      }
   });

   // Google OAuth callback endpoint - handles Google OAuth callback
   app.get('/login/google/callback', async (req: Request, res: Response, next: NextFunction) => {
      // DIAGNOSTIC: Log all cookies received to understand why interaction cookies might be missing
      const allCookies = req.cookies ? Object.keys(req.cookies) : [];
      const hasInteractionCookie = !!(req.cookies?._interaction);
      const hasInteractionResumeCookie = !!(req.cookies?._interaction_resume);
      const hasSessionCookie = !!(req.cookies?._session);
      
      log.info({
         method: req.method,
         path: req.path,
         hasCode: !!req.query.code,
         hasError: !!req.query.error,
         hasState: !!req.query.state,
         clientIP: req.ip,
         userAgent: req.headers['user-agent'],
         // Cookie diagnostics
         cookieCount: allCookies.length,
         cookieNames: allCookies.join(', ') || 'NONE',
         hasInteractionCookie,
         hasInteractionResumeCookie,
         hasSessionCookie
      }, 'auth-server:google-routes:callback - Google OAuth callback received');

      const code = req.query.code as string;
      const error = req.query.error as string;
      const state = req.query.state as string;

      // Validate state parameter for CSRF protection and get stored data
      let interactionUid: string | undefined;
      let storedClientRedirectUri: string | undefined;
      if (state) {
         const stateData = await consumeOAuthState(state);
         if (!stateData) {
            log.warn({
               invalidState: true,
               action: 'callback_validation',
               cookiesReceived: allCookies.join(', ') || 'NONE'
            }, 'auth-server:google-routes:callback - Invalid or expired state parameter');
            return res.status(400).send('Invalid or expired state parameter');
         }
         interactionUid = stateData.interactionUid;
         storedClientRedirectUri = stateData.clientRedirectUri;
         
         log.debug({
            interactionUid: interactionUid || 'NONE',
            storedClientRedirectUri: storedClientRedirectUri || 'NONE',
            hasInteractionCookie,
            hasInteractionResumeCookie
         }, 'auth-server:google-routes:callback - Retrieved state data');
      }

      if (error) {
         log.warn({
            oauthError: error,
            action: 'callback_validation'
         }, 'auth-server:google-routes:callback - OAuth error in callback');
         const redirectUrl = getPostLoginRedirectUrl();
         return res.redirect(`${redirectUrl}?error=${encodeURIComponent(error)}`);
      }

      if (!code) {
         log.warn({
            missingCode: true,
            action: 'callback_validation'
         }, 'auth-server:google-routes:callback - Missing authorization code in callback');
         const redirectUrl = getPostLoginRedirectUrl();
         return res.redirect(`${redirectUrl}?error=missing_code`);
      }

      try {
         const googleConfig = getGoogleOAuthConfig();
         
         if (!googleConfig) {
            throw new Error('Google OAuth is not configured');
         }

         // Exchange authorization code for access token
         const tokenParams = new URLSearchParams({
            code: code,
            client_id: googleConfig.clientId,
            client_secret: googleConfig.clientSecret,
            redirect_uri: googleConfig.redirectUri,
            grant_type: 'authorization_code'
         });

         const tokenResponse = await axios.post(
            'https://oauth2.googleapis.com/token',
            tokenParams.toString(),
            {
               headers: {
                  'Content-Type': 'application/x-www-form-urlencoded'
               }
            }
         );

         const { access_token, refresh_token, id_token } = tokenResponse.data;

         if (!access_token) {
            throw new Error('No access token received from Google');
         }

         // Log token information (mask sensitive parts)
         const accessTokenPreview = access_token ? `${access_token.substring(0, 20)}...${access_token.substring(access_token.length - 10)}` : null;
         const refreshTokenPreview = refresh_token ? `${refresh_token.substring(0, 20)}...${refresh_token.substring(refresh_token.length - 10)}` : null;
         const idTokenPreview = id_token ? `${id_token.substring(0, 20)}...${id_token.substring(id_token.length - 10)}` : null;

         log.info({
            hasAccessToken: !!access_token,
            hasRefreshToken: !!refresh_token,
            hasIdToken: !!id_token,
            accessTokenLength: access_token?.length,
            refreshTokenLength: refresh_token?.length,
            idTokenLength: id_token?.length,
            accessTokenPreview: accessTokenPreview,
            refreshTokenPreview: refreshTokenPreview,
            idTokenPreview: idTokenPreview
         }, 'auth-server:google-routes:callback - Successfully exchanged code for tokens');

         // Get user info from Google
         log.info({
            userInfoUrl: 'https://www.googleapis.com/oauth2/v2/userinfo',
            hasAccessToken: !!access_token
         }, 'auth-server:google-routes:callback - Fetching user info from Google');

         const userInfoResponse = await axios.get('https://www.googleapis.com/oauth2/v2/userinfo', {
            headers: {
               'Authorization': `Bearer ${access_token}`
            }
         });

         const googleUser = userInfoResponse.data;
         const authProvider = 'google'; // Explicitly set provider since we're in Google callback
         const providerSubject = googleUser.id || googleUser.sub;
         const email = googleUser.email;
         const name = googleUser.name || googleUser.given_name || email;

         if (!providerSubject || !email) {
            log.error({
               googleUser: JSON.stringify(googleUser, null, 2),
               hasId: !!providerSubject,
               hasEmail: !!email
            }, 'auth-server:google-routes:callback - Missing required user information from Google');
            throw new Error('Missing required user information from Google');
         }

         // Log full Google user info
         log.info({
            providerSubject,
            email,
            name,
            provider: 'google',
            hasInteractionUid: !!interactionUid,
            googleUser: {
               id: googleUser.id,
               sub: googleUser.sub,
               email: googleUser.email,
               verified_email: googleUser.verified_email,
               name: googleUser.name,
               given_name: googleUser.given_name,
               family_name: googleUser.family_name,
               picture: googleUser.picture,
               locale: googleUser.locale
            }
         }, 'auth-server:google-routes:callback - Google OAuth authentication successful');

         const originUri = storedClientRedirectUri || getClientCallbackUrl();
         const appOrigin = new URL(originUri).origin;

         log.info({
            providerSubject,
            email,
         }, 'auth-server:google-routes:callback - Starting organization resolution for login');

         const organizationResult = await resolveOrganization({
            provider: authProvider,
            providerSubject,
         });

         // Handle organization resolution errors
         if (!organizationResult.success) {
            log.warn({
               providerSubject,
               email,
               errorCode: organizationResult.errorCode,
               error: organizationResult.error
            }, 'auth-server:google-routes:callback - Tenant resolution failed');

            // If multiple organizations, complete login with organizations list
            // The select_org policy will trigger and show org selection
            const orgList = organizationResult.organizations ?? [];
            if (organizationResult.errorCode === 'MULTIPLE_ORGANIZATIONS' && orgList.length > 0) {
               log.info({
                  organizationCount: orgList.length,
                  userId: organizationResult.userId,
                  hasInteractionUid: !!interactionUid
               }, 'auth-server:google-routes:callback - Multiple organizations, completing login (select_org policy will handle org selection)');

               // If no OIDC interaction, we can't use the policy system
               if (!interactionUid || !provider) {
                  log.error({
                     hasInteractionUid: !!interactionUid,
                     hasProvider: !!provider
                  }, 'auth-server:google-routes:callback - No OIDC interaction for multi-organization flow');
                  
                  const callbackUri = getClientCallbackUrl();
                  const appBaseUrl = new URL(callbackUri).origin;
                  const serviceUrl = process.env.MOREZERO_SERVICE ? "/" + process.env.MOREZERO_SERVICE : "";
                  return res.redirect(`${appBaseUrl}${serviceUrl}/login?error=${encodeURIComponent('Please login through the application.')}`);
               }

               // Complete login with user info and organizations list
               // The select_org policy will detect this and trigger org selection
               // OIDC standard: login.accountId = userId (user identifier)
               const result = {
                  login: {
                     accountId: organizationResult.userId!,  // OIDC account identifier is always userId
                     acr: '1',
                     amr: ['google'],
                     remember: true,
                     ts: Math.floor(Date.now() / 1000),
                     // Include user info and organizations for select_org policy
                     email: email,
                     name: name,
                     avatarUrl: googleUser.picture || '',
                     provider: 'google',
                     providerSubject: providerSubject,
                     organizations: orgList,
                     requiresOrgSelection: true,
                  },
               };

               await provider.interactionFinished(req, res, result, { mergeWithLastSubmission: false });
               return;
            }

            // For USER_NOT_FOUND, automatically register the new user using unified service
            if (organizationResult.errorCode === 'USER_NOT_FOUND') {
               log.info({
                  email,
                  providerSubject,
                  provider: authProvider
               }, 'auth-server:google-routes:callback - New user, auto-registering via unified service');
               
               // Use the unified identity registration service
               const registrationInput: IdentityRegistrationInput = {
                  provider: 'google',
                  providerUserId: providerSubject,
                  credentials: {
                     oauthTokens: {
                        accessToken: access_token,
                        refreshToken: refresh_token || undefined,
                     }
                  },
                  profile: {
                     email: email,
                     name: name,
                     avatarUrl: googleUser.picture
                  },
                  organizationContext: {},
                  interactionUid: interactionUid,
                  origin: appOrigin
               };
               
               const registrationResult = await registerIdentity(registrationInput);
               
               if (!registrationResult.success) {
                  log.error({
                     error: registrationResult.error,
                     errorCode: registrationResult.errorCode,
                     email
                  }, 'auth-server:google-routes:callback - Auto-registration failed');
                  
                  const callbackUri = getClientCallbackUrl();
                  const appBaseUrl = new URL(callbackUri).origin;
                  const serviceUrl = process.env.MOREZERO_SERVICE ? "/" + process.env.MOREZERO_SERVICE : "";
                  return res.redirect(`${appBaseUrl}${serviceUrl}/register?error=${encodeURIComponent(registrationResult.error || 'Registration failed')}`);
               }
               
               log.info({
                  userId: registrationResult.userId,
                  organizationId: registrationResult.organizationId,
                  email
               }, 'auth-server:google-routes:callback - Auto-registration successful, completing OIDC flow');
               
               // Create auth result with registration result
               const authResult = createAuthResult({
                  userId: registrationResult.userId!,
                  email: email,
                  name: name,
                  avatarURL: googleUser.picture,
                  provider: authProvider,
                  organizationId: registrationResult.organizationId!,
               });
               
               // Store the auth result (always use userId as storage key per OIDC standard)
               await storeAuthResult(registrationResult.userId!, authResult);
               
               // Complete OIDC interaction if we have one
               if (interactionUid && provider) {
                  const oidcResult = {
                     login: {
                        accountId: registrationResult.userId!,  // OIDC account identifier is always userId
                        acr: '1',
                        amr: ['google'],
                        remember: true,
                        ts: Math.floor(Date.now() / 1000),
                     },
                  };
                  
                  try {
                     await provider.interactionFinished(req, res, oidcResult, { mergeWithLastSubmission: false });
                     log.info({ 
                        interactionUid, 
                        userId: registrationResult.userId 
                     }, 'auth-server:google-routes:callback - OIDC interaction completed after auto-registration');
                     return;
                  } catch (interactionError: any) {
                     log.warn({
                        error: interactionError.message,
                        interactionUid
                     }, 'auth-server:google-routes:callback - OIDC interaction failed after registration, redirecting to login');
                     
                     const callbackUri = getClientCallbackUrl();
                     const appBaseUrl = new URL(callbackUri).origin;
                     const serviceUrl = process.env.MOREZERO_SERVICE ? "/" + process.env.MOREZERO_SERVICE : "";
                     return res.redirect(`${appBaseUrl}${serviceUrl}/login?registered=1`);
                  }
               } else {
                  // No OIDC interaction, redirect to login
                  const callbackUri = getClientCallbackUrl();
                  const appBaseUrl = new URL(callbackUri).origin;
                  const serviceUrl = process.env.MOREZERO_SERVICE ? "/" + process.env.MOREZERO_SERVICE : "";
                  return res.redirect(`${appBaseUrl}${serviceUrl}/login?registered=1`);
               }
            }

            // For other errors, redirect to login with error message
            const redirectUrl = getPostLoginRedirectUrl();
            const errorUrl = `${redirectUrl}?error=${organizationResult.errorCode?.toLowerCase() || 'login_failed'}&error_description=${encodeURIComponent(organizationResult.error || 'Login failed')}`;
            
            return res.redirect(errorUrl);
         }

         // Tenant resolution successful - create auth result and complete login
         const { userId, organizationId } = organizationResult;

         log.info({
            userId,
            organizationId,
            hasInteractionUid: !!interactionUid
         }, 'auth-server:google-routes:callback - Organization resolution successful');

         // Create auth result with organization information
         const authResult = createAuthResult({
            userId: userId!,
            email: email,
            name: name,
            avatarURL: googleUser.picture,
            provider: authProvider,
            organizationId: organizationId!,
         });

         // Store the complete authResult in Redis for later use (keyed by userId per OIDC standard)
         await storeAuthResult(userId!, authResult);

         log.info({ 
            userId,
            organizationId,
            userEmail: email
         }, 'auth-server:google-routes:callback - Google authentication successful, auth result stored');

         // OIDC interaction is required - only OIDC provider issues tokens
         if (!interactionUid || !provider) {
            log.error({
               hasInteractionUid: !!interactionUid,
               hasProvider: !!provider,
               userId
            }, 'auth-server:google-routes:callback - Missing OIDC interaction, cannot complete login');
            
            const redirectUrl = getPostLoginRedirectUrl();
            return res.redirect(`${redirectUrl}?error=invalid_request&error_description=${encodeURIComponent('Login must be initiated through the application. Please try again.')}`);
         }

         log.info({
            interactionUid: interactionUid || 'undefined',
            userId,
            hasCookies: !!req.cookies,
            hasInteractionCookie: !!(req.cookies?._interaction || req.cookies?._interaction_resume)
         }, 'auth-server:google-routes:callback - Completing OIDC interaction');

         // Prepare login result for OIDC provider
         const oidcResult = {
            login: {
               accountId: userId!,  // OIDC account identifier is always userId
               acr: '1',
               amr: ['google'],
               remember: true,
               ts: Math.floor(Date.now() / 1000),
            },
         };

         try {
            // Try to get interaction details first to validate the session exists
            try {
               const interactionDetails = await provider.interactionDetails(req, res);
               log.debug({
                  uid: interactionDetails?.uid,
                  prompt: interactionDetails?.prompt?.name,
                  hasParams: !!interactionDetails?.params
               }, 'auth-server:google-routes:callback - Interaction details retrieved before finish');
            } catch (detailsError: any) {
               log.warn({
                  error: detailsError?.message || String(detailsError),
                  errorName: detailsError?.name,
                  interactionUid: interactionUid || 'undefined'
               }, 'auth-server:google-routes:callback - Could not get interaction details, session may be expired');
            }

            await provider.interactionFinished(req, res, oidcResult, { mergeWithLastSubmission: false });
            log.info({ interactionUid: interactionUid || 'undefined', userId }, 'auth-server:google-routes:callback - OIDC interaction completed');
            return; // interactionFinished handles the response
         } catch (interactionError: any) {
            // OIDC interaction expired or invalid - redirect to login with error
            log.error({
               error: interactionError.message,
               interactionUid,
               userId
            }, 'auth-server:google-routes:callback - OIDC interaction failed');
            
            const redirectUrl = getPostLoginRedirectUrl();
            return res.redirect(`${redirectUrl}?error=session_expired&error_description=${encodeURIComponent('Your login session has expired. Please try again.')}`);
         }
      } catch (error) {
         log.error({
            error: error.message,
            stack: error.stack,
            code: code ? code.substring(0, 20) + '...' : 'null',
            storedClientRedirectUri: storedClientRedirectUri || 'NONE'
         }, `auth-server:google-routes:callback - Google OAuth authentication failed: ${error.message}`);

         // Redirect to the originating client (if known) or fallback to configured post-login URL
         let errorBaseUrl: string;
         if (storedClientRedirectUri) {
            errorBaseUrl = new URL(storedClientRedirectUri).origin;
         } else {
            errorBaseUrl = getPostLoginRedirectUrl();
         }
         const errorUrl = `${errorBaseUrl}?error=oauth_failed`;
         return res.redirect(errorUrl);
      }
   });

   // Exchange endpoint for getting internal token (now just returns the internal token from cookie)
   app.post('/api/auth/exchange', async (req: Request, res: Response, next: NextFunction) => {
      log.info({
         method: req.method,
         path: req.path,
         clientIP: req.ip,
         userAgent: req.headers['user-agent']
      }, 'auth-server:google-routes:exchange - Internal token exchange request');

      try {
         // Get internal token from cookie
         const backendToken = req.cookies?.["internal_token"] as string;

         if (!backendToken) {
            log.warn({
               missingToken: true,
               tokenType: 'internal',
               action: 'exchange_validation'
            }, 'Missing internal token in exchange request');
            return res.status(401).json({ error: "Missing internal token" });
         }

         log.debug({
            hasInternalToken: !!backendToken,
            tokenLength: backendToken.length
         }, 'Internal token found');

         log.info({
            tokenRetrieved: true,
            tokenType: 'internal'
         }, 'Internal token retrieved successfully');
         return res.json({
            access_token: backendToken,
            token_type: 'Bearer',
            expires_in: 3600 // 1 hour
         });
      } catch (error) {
         log.error({
            error: error.message,
            stack: error.stack
         }, 'Failed to retrieve internal token');
         return res.status(401).json({ error: error.message || "Unauthorized" });
      }
   });

   // Google OAuth code exchange endpoint - exchanges authorization code for token
   // This is called by app-site's callback to get the token after Google OAuth redirect
   app.post('/api/auth/google/token', async (req: Request, res: Response, next: NextFunction) => {
      log.info({
         method: req.method,
         path: req.path,
         hasCode: !!req.body?.code,
         clientIP: req.ip
      }, 'auth-server:google-routes:google-token - Google OAuth code exchange request');

      try {
         const { code, client_id, client_secret } = req.body;

         if (!code) {
            log.warn({
               missingCode: true,
               action: 'google_token_validation'
            }, 'auth-server:google-routes:google-token - Missing authorization code');
            return res.status(400).json({ 
               error: 'invalid_request',
               error_description: 'Missing authorization code' 
            });
         }

         // Validate client credentials (optional, for extra security)
         const expectedClientId = getClientId();
         if (client_id && client_id !== expectedClientId) {
            log.warn({
               providedClientId: client_id,
               action: 'google_token_validation'
            }, 'auth-server:google-routes:google-token - Invalid client_id');
            return res.status(401).json({ 
               error: 'invalid_client',
               error_description: 'Invalid client credentials' 
            });
         }

         // Look up and consume the authorization code from Redis (one-time use)
         const authCodeData = await consumeGoogleAuthCode(code);
         
         if (!authCodeData) {
            log.warn({
               invalidCode: true,
               action: 'google_token_validation'
            }, 'auth-server:google-routes:google-token - Invalid or expired authorization code');
            return res.status(400).json({ 
               error: 'invalid_grant',
               error_description: 'Invalid or expired authorization code' 
            });
         }
         // No need to delete or check expiry - consumeGoogleAuthCode handles deletion
         // and Redis TTL handles expiry automatically

         log.info({
            userId: authCodeData.userId,
            email: authCodeData.email,
            tokenExchangeSuccess: true
         }, 'auth-server:google-routes:google-token - Google OAuth code exchanged successfully');

         // Return the token response
         return res.json({
            access_token: authCodeData.token,
            token_type: 'Bearer',
            expires_in: 3600, // 1 hour
            // Include user info for the client
            user: {
               id: authCodeData.userId,
               email: authCodeData.email,
               name: authCodeData.name,
               picture: authCodeData.picture
            }
         });
      } catch (error: any) {
         log.error({
            error: error.message,
            stack: error.stack
         }, 'auth-server:google-routes:google-token - Failed to exchange Google OAuth code');
         return res.status(500).json({ 
            error: 'server_error',
            error_description: error.message || 'Internal server error' 
         });
      }
   });
}
