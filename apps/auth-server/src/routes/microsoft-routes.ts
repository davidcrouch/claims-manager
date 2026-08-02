import { Application, Request, Response, NextFunction } from 'express';
import { createLogger, LoggerType } from '../lib/logger.js';
import { createTelemetryLogger } from '@morezero/telemetry';
import { getBaseUrl, getPostLoginRedirectUrl, getMicrosoftOAuthConfig, getClientCallbackUrl } from '../config/env-validation.js';
import {
   storeAuthResult,
   storeOAuthState,
   consumeOAuthState,
   type OAuthStateData
} from '../config/oidc-provider.js';
import { GlobalCacheManager } from '../lib/cache/global-cache-manager.js';
import axios from 'axios';
import { randomBytes } from 'node:crypto';
import {
   resolveOrganization,
   createAuthResult,
} from '../services/organization-resolution-service.js';
import {
   registerIdentity,
   identityExists,
   getUserByEmail,
   type IdentityRegistrationInput
} from '../services/identity-registration-service.js';
import { tryAutoLinkInvitedUser } from '../services/invited-user-auto-link.js';

const baseLogger = createLogger('auth-server:microsoft-routes', LoggerType.NODEJS);
const log = createTelemetryLogger(baseLogger, 'microsoft-routes', 'MicrosoftRoutes', 'auth-server');

export default function createMicrosoftRoutes(app: Application, provider: any): void {

   // Microsoft OAuth start endpoint - redirects to Microsoft Entra ID
   app.get('/login/microsoft/start', async (req: Request, res: Response, next: NextFunction) => {
      log.info({
         method: req.method,
         path: req.path,
         hasInteraction: !!req.query.interaction,
         hasState: !!req.query.state,
         clientIP: req.ip,
         userAgent: req.headers['user-agent']
      }, 'auth-server:microsoft-routes:start - Microsoft OAuth login initiated');

      try {
         const msConfig = getMicrosoftOAuthConfig();

         if (!msConfig) {
            throw new Error('Microsoft OAuth is not configured. Please set MICROSOFT_CLIENT_ID and MICROSOFT_CLIENT_SECRET');
         }

         const host = req.get('host');
         const baseUrl = host ? `${req.protocol}://${host}` : getBaseUrl();

         const interactionUid = (req.query.interaction || req.query.state || req.query.uid) as string | undefined;

         if (!interactionUid) {
            log.warn({
               queryParams: Object.keys(req.query).join(', ') || 'none',
               referer: req.headers.referer || 'none',
            }, 'auth-server:microsoft-routes:start - No interaction UID provided. User may have bypassed OIDC authorize flow.');
         }

         log.debug({
            interactionUid: interactionUid || 'undefined',
            hasCookies: !!req.cookies,
            hasInteractionCookie: !!(req.cookies?._interaction || req.cookies?._interaction_resume)
         }, 'auth-server:microsoft-routes:start - Extracted params');

         // Resolve the client redirect_uri from the OIDC interaction stored in Redis
         let clientRedirectUri: string | undefined;
         if (interactionUid) {
            try {
               const redis = await GlobalCacheManager.getInstance('auth-server');
               const interactionData = await redis.get<Record<string, any>>(`oidc:Interaction:${interactionUid}`);
               clientRedirectUri = interactionData?.params?.redirect_uri as string | undefined;
               log.info({ interactionUid, clientRedirectUri, hasData: !!interactionData, hasParams: !!interactionData?.params }, 'auth-server:microsoft-routes:start - Resolved client redirect_uri from interaction');
            } catch (detailsErr: any) {
               log.warn({ error: detailsErr.message, interactionUid }, 'auth-server:microsoft-routes:start - Could not read interaction from Redis');
            }
         }

         // Generate a random state parameter for CSRF protection
         const csrfState = randomBytes(32).toString('hex');
         await storeOAuthState(csrfState, {
            createdAt: Date.now(),
            interactionUid: interactionUid,
            clientRedirectUri: clientRedirectUri
         });

         // Build Microsoft authorization URL
         const params = new URLSearchParams({
            client_id: msConfig.clientId,
            redirect_uri: msConfig.redirectUri,
            response_type: 'code',
            scope: 'openid profile email',
            state: csrfState,
            response_mode: 'query'
         });

         const microsoftAuthUrl = `https://login.microsoftonline.com/${msConfig.tenantId}/oauth2/v2.0/authorize?${params.toString()}`;

         log.info({
            redirectUrl: msConfig.redirectUri,
            baseUrl: baseUrl,
            method: 'microsoft_oauth_start',
            clientId: msConfig.clientId,
            tenantId: msConfig.tenantId,
            hasInteractionUid: !!interactionUid
         }, 'auth-server:microsoft-routes:start - Redirecting to Microsoft OAuth');

         res.redirect(microsoftAuthUrl);
      } catch (error: any) {
         log.error({
            error: error.message,
            stack: error.stack
         }, 'auth-server:microsoft-routes:start - Failed to initiate Microsoft OAuth login');

         res.status(500).json({
            error: 'Failed to initiate Microsoft login'
         });
      }
   });

   // Microsoft OAuth callback endpoint - handles Microsoft OAuth callback
   app.get('/login/microsoft/callback', async (req: Request, res: Response, next: NextFunction) => {
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
         cookieCount: allCookies.length,
         cookieNames: allCookies.join(', ') || 'NONE',
         hasInteractionCookie,
         hasInteractionResumeCookie,
         hasSessionCookie
      }, 'auth-server:microsoft-routes:callback - Microsoft OAuth callback received');

      const code = req.query.code as string;
      const error = req.query.error as string;
      const errorDescription = req.query.error_description as string;
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
            }, 'auth-server:microsoft-routes:callback - Invalid or expired state parameter');
            return res.status(400).send('Invalid or expired state parameter');
         }
         interactionUid = stateData.interactionUid;
         storedClientRedirectUri = stateData.clientRedirectUri;

         log.debug({
            interactionUid: interactionUid || 'NONE',
            storedClientRedirectUri: storedClientRedirectUri || 'NONE',
            hasInteractionCookie,
            hasInteractionResumeCookie
         }, 'auth-server:microsoft-routes:callback - Retrieved state data');
      }

      if (error) {
         log.warn({
            oauthError: error,
            errorDescription: errorDescription || 'none',
            action: 'callback_validation'
         }, 'auth-server:microsoft-routes:callback - OAuth error in callback');
         const redirectUrl = getPostLoginRedirectUrl();
         return res.redirect(`${redirectUrl}?error=${encodeURIComponent(error)}`);
      }

      if (!code) {
         log.warn({
            missingCode: true,
            action: 'callback_validation'
         }, 'auth-server:microsoft-routes:callback - Missing authorization code in callback');
         const redirectUrl = getPostLoginRedirectUrl();
         return res.redirect(`${redirectUrl}?error=missing_code`);
      }

      try {
         const msConfig = getMicrosoftOAuthConfig();

         if (!msConfig) {
            throw new Error('Microsoft OAuth is not configured');
         }

         // Exchange authorization code for tokens
         const tokenParams = new URLSearchParams({
            code: code,
            client_id: msConfig.clientId,
            client_secret: msConfig.clientSecret,
            redirect_uri: msConfig.redirectUri,
            grant_type: 'authorization_code',
            scope: 'openid profile email'
         });

         const tokenResponse = await axios.post(
            `https://login.microsoftonline.com/${msConfig.tenantId}/oauth2/v2.0/token`,
            tokenParams.toString(),
            {
               headers: {
                  'Content-Type': 'application/x-www-form-urlencoded'
               }
            }
         );

         const { access_token, id_token } = tokenResponse.data;

         if (!access_token) {
            throw new Error('No access token received from Microsoft');
         }

         log.info({
            hasAccessToken: !!access_token,
            hasIdToken: !!id_token,
            accessTokenLength: access_token?.length,
            idTokenLength: id_token?.length
         }, 'auth-server:microsoft-routes:callback - Successfully exchanged code for tokens');

         // Decode ID token to get user info (JWT payload is base64url-encoded)
         let msUser: { sub?: string; oid?: string; email?: string; preferred_username?: string; name?: string };
         if (id_token) {
            const payload = id_token.split('.')[1];
            const decoded = Buffer.from(payload, 'base64url').toString('utf-8');
            msUser = JSON.parse(decoded);
         } else {
            // Fallback: call MS Graph /me endpoint
            const meResponse = await axios.get('https://graph.microsoft.com/v1.0/me', {
               headers: { Authorization: `Bearer ${access_token}` }
            });
            msUser = {
               oid: meResponse.data.id,
               email: meResponse.data.mail || meResponse.data.userPrincipalName,
               name: meResponse.data.displayName
            };
         }

         const authProvider = 'microsoft';
         const providerSubject = msUser.oid || msUser.sub;
         const email = msUser.email || msUser.preferred_username;
         const name = msUser.name || email;

         if (!providerSubject || !email) {
            log.error({
               msUser: JSON.stringify(msUser, null, 2),
               hasId: !!providerSubject,
               hasEmail: !!email
            }, 'auth-server:microsoft-routes:callback - Missing required user information from Microsoft');
            throw new Error('Missing required user information from Microsoft');
         }

         // Fetch avatar from MS Graph (optional)
         let avatarUrl: string | undefined;
         try {
            const photoResponse = await axios.get('https://graph.microsoft.com/v1.0/me/photo/$value', {
               headers: { Authorization: `Bearer ${access_token}` },
               responseType: 'arraybuffer'
            });
            if (photoResponse.status === 200 && photoResponse.data) {
               const base64 = Buffer.from(photoResponse.data).toString('base64');
               const contentType = photoResponse.headers['content-type'] || 'image/jpeg';
               avatarUrl = `data:${contentType};base64,${base64}`;
            }
         } catch {
            // Avatar fetch is optional - continue without it
         }

         log.info({
            providerSubject,
            email,
            name,
            provider: 'microsoft',
            hasInteractionUid: !!interactionUid,
            hasAvatar: !!avatarUrl
         }, 'auth-server:microsoft-routes:callback - Microsoft OAuth authentication successful');

         const originUri = storedClientRedirectUri || getClientCallbackUrl();
         const appOrigin = new URL(originUri).origin;

         log.info({
            providerSubject,
            email,
         }, 'auth-server:microsoft-routes:callback - Starting organization resolution for login');

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
            }, 'auth-server:microsoft-routes:callback - Tenant resolution failed');

            const orgList = organizationResult.organizations ?? [];
            if (organizationResult.errorCode === 'MULTIPLE_ORGANIZATIONS' && orgList.length > 0) {
               log.info({
                  organizationCount: orgList.length,
                  userId: organizationResult.userId,
                  hasInteractionUid: !!interactionUid
               }, 'auth-server:microsoft-routes:callback - Multiple organizations, completing login (select_org policy will handle org selection)');

               if (!interactionUid || !provider) {
                  log.error({
                     hasInteractionUid: !!interactionUid,
                     hasProvider: !!provider
                  }, 'auth-server:microsoft-routes:callback - No OIDC interaction for multi-organization flow');

                  const callbackUri = getClientCallbackUrl();
                  const appBaseUrl = new URL(callbackUri).origin;
                  const serviceUrl = process.env.MOREZERO_SERVICE ? "/" + process.env.MOREZERO_SERVICE : "";
                  return res.redirect(`${appBaseUrl}${serviceUrl}/api/auth/login?error=${encodeURIComponent('Please login through the application.')}`);
               }

               const result = {
                  login: {
                     accountId: organizationResult.userId!,
                     acr: '1',
                     amr: ['microsoft'],
                     remember: true,
                     ts: Math.floor(Date.now() / 1000),
                     email: email,
                     name: name,
                     avatarUrl: avatarUrl || '',
                     provider: 'microsoft',
                     providerSubject: providerSubject,
                     organizations: orgList,
                     requiresOrgSelection: true,
                  },
               };

               await provider.interactionFinished(req, res, result, { mergeWithLastSubmission: false });
               return;
            }

            // For USER_NOT_FOUND, try invite auto-link first, then auto-register
            if (organizationResult.errorCode === 'USER_NOT_FOUND') {
               const existingUser = await getUserByEmail(email);

               if (existingUser) {
                  const autoLink = await tryAutoLinkInvitedUser({
                     email,
                     emailVerified: true,
                     provider: 'microsoft',
                     providerUserId: providerSubject,
                     displayName: name,
                     avatarUrl,
                  });

                  if (autoLink.linked) {
                     const orgResult = await resolveOrganization({
                        provider: 'microsoft',
                        providerSubject,
                     });

                     if (orgResult.success && orgResult.organizationId) {
                        const authResult = createAuthResult({
                           userId: orgResult.userId!,
                           email,
                           name,
                           avatarURL: avatarUrl,
                           provider: authProvider,
                           organizationId: orgResult.organizationId,
                        });
                        await storeAuthResult(orgResult.userId!, authResult);

                        if (interactionUid && provider) {
                           const oidcResult = {
                              login: {
                                 accountId: orgResult.userId!,
                                 acr: '1',
                                 amr: ['microsoft'],
                                 remember: true,
                                 ts: Math.floor(Date.now() / 1000),
                              },
                           };
                           await provider.interactionFinished(req, res, oidcResult, { mergeWithLastSubmission: false });
                           log.info(
                              { interactionUid, userId: orgResult.userId },
                              'auth-server:microsoft-routes:callback - OIDC interaction completed after invite auto-link',
                           );
                           return;
                        }
                     }

                     const autoLinkOrgList = orgResult.organizations ?? [];
                     if (
                        orgResult.errorCode === 'MULTIPLE_ORGANIZATIONS' &&
                        autoLinkOrgList.length > 0 &&
                        interactionUid &&
                        provider
                     ) {
                        const oidcResult = {
                           login: {
                              accountId: autoLink.userId!,
                              acr: '1',
                              amr: ['microsoft'],
                              remember: true,
                              ts: Math.floor(Date.now() / 1000),
                              email,
                              name,
                              avatarUrl: avatarUrl || '',
                              provider: 'microsoft',
                              providerSubject,
                              organizations: autoLinkOrgList,
                              requiresOrgSelection: true,
                           },
                        };
                        await provider.interactionFinished(req, res, oidcResult, { mergeWithLastSubmission: false });
                        log.info(
                           { userId: autoLink.userId, organizationCount: autoLinkOrgList.length },
                           'auth-server:microsoft-routes:callback - OIDC interaction completed with org selection after invite auto-link',
                        );
                        return;
                     }

                     const callbackUri = getClientCallbackUrl();
                     const appBaseUrl = new URL(callbackUri).origin;
                     const serviceUrl = process.env.MOREZERO_SERVICE ? '/' + process.env.MOREZERO_SERVICE : '';
                     return res.redirect(`${appBaseUrl}${serviceUrl}/api/auth/login?registered=1`);
                  }

                  log.warn(
                     { email, reason: autoLink.reason },
                     'auth-server:microsoft-routes:callback - Existing user could not be auto-linked',
                  );
                  const callbackUri = getClientCallbackUrl();
                  const appBaseUrl = new URL(callbackUri).origin;
                  const serviceUrl = process.env.MOREZERO_SERVICE ? '/' + process.env.MOREZERO_SERVICE : '';
                  return res.redirect(
                     `${appBaseUrl}${serviceUrl}/api/auth/login?error=${encodeURIComponent('An account with this email already exists. Accept your invite or sign in with password.')}`,
                  );
               }

               log.info({
                  email,
                  providerSubject,
                  provider: authProvider
               }, 'auth-server:microsoft-routes:callback - New user, auto-registering via unified service');

               const registrationInput: IdentityRegistrationInput = {
                  provider: 'microsoft',
                  providerUserId: providerSubject,
                  credentials: {
                     oauthTokens: {
                        accessToken: access_token,
                     }
                  },
                  profile: {
                     email: email,
                     name: name,
                     avatarUrl: avatarUrl
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
                  }, 'auth-server:microsoft-routes:callback - Auto-registration failed');

                  const callbackUri = getClientCallbackUrl();
                  const appBaseUrl = new URL(callbackUri).origin;
                  const serviceUrl = process.env.MOREZERO_SERVICE ? "/" + process.env.MOREZERO_SERVICE : "";
                  return res.redirect(`${appBaseUrl}${serviceUrl}/register?error=${encodeURIComponent(registrationResult.error || 'Registration failed')}`);
               }

               log.info({
                  userId: registrationResult.userId,
                  organizationId: registrationResult.organizationId,
                  email
               }, 'auth-server:microsoft-routes:callback - Auto-registration successful, completing OIDC flow');

               const authResult = createAuthResult({
                  userId: registrationResult.userId!,
                  email: email,
                  name: name,
                  avatarURL: avatarUrl,
                  provider: authProvider,
                  organizationId: registrationResult.organizationId!,
               });

               await storeAuthResult(registrationResult.userId!, authResult);

               if (interactionUid && provider) {
                  const oidcResult = {
                     login: {
                        accountId: registrationResult.userId!,
                        acr: '1',
                        amr: ['microsoft'],
                        remember: true,
                        ts: Math.floor(Date.now() / 1000),
                     },
                  };

                  try {
                     await provider.interactionFinished(req, res, oidcResult, { mergeWithLastSubmission: false });
                     log.info({
                        interactionUid,
                        userId: registrationResult.userId
                     }, 'auth-server:microsoft-routes:callback - OIDC interaction completed after auto-registration');
                     return;
                  } catch (interactionError: any) {
                     log.warn({
                        error: interactionError.message,
                        interactionUid
                     }, 'auth-server:microsoft-routes:callback - OIDC interaction failed after registration, redirecting to login');

                     const callbackUri = getClientCallbackUrl();
                     const appBaseUrl = new URL(callbackUri).origin;
                     const serviceUrl = process.env.MOREZERO_SERVICE ? "/" + process.env.MOREZERO_SERVICE : "";
                     return res.redirect(`${appBaseUrl}${serviceUrl}/api/auth/login?registered=1`);
                  }
               } else {
                  const callbackUri = getClientCallbackUrl();
                  const appBaseUrl = new URL(callbackUri).origin;
                  const serviceUrl = process.env.MOREZERO_SERVICE ? "/" + process.env.MOREZERO_SERVICE : "";
                  return res.redirect(`${appBaseUrl}${serviceUrl}/api/auth/login?registered=1`);
               }
            }

            // For other errors, redirect to login with error message
            const redirectUrl = getPostLoginRedirectUrl();
            const errorUrl = `${redirectUrl}?error=${organizationResult.errorCode?.toLowerCase() || 'login_failed'}&error_description=${encodeURIComponent(organizationResult.error || 'Login failed')}`;

            return res.redirect(errorUrl);
         }

         // Organization resolution successful - create auth result and complete login
         const { userId, organizationId } = organizationResult;

         log.info({
            userId,
            organizationId,
            hasInteractionUid: !!interactionUid
         }, 'auth-server:microsoft-routes:callback - Organization resolution successful');

         const authResult = createAuthResult({
            userId: userId!,
            email: email,
            name: name,
            avatarURL: avatarUrl,
            provider: authProvider,
            organizationId: organizationId!,
         });

         await storeAuthResult(userId!, authResult);

         log.info({
            userId,
            organizationId,
            userEmail: email
         }, 'auth-server:microsoft-routes:callback - Microsoft authentication successful, auth result stored');

         // OIDC interaction is required
         if (!interactionUid || !provider) {
            log.error({
               hasInteractionUid: !!interactionUid,
               hasProvider: !!provider,
               userId
            }, 'auth-server:microsoft-routes:callback - Missing OIDC interaction, cannot complete login');

            const redirectUrl = getPostLoginRedirectUrl();
            return res.redirect(`${redirectUrl}?error=invalid_request&error_description=${encodeURIComponent('Login must be initiated through the application. Please try again.')}`);
         }

         log.info({
            interactionUid: interactionUid || 'undefined',
            userId,
            hasCookies: !!req.cookies,
            hasInteractionCookie: !!(req.cookies?._interaction || req.cookies?._interaction_resume)
         }, 'auth-server:microsoft-routes:callback - Completing OIDC interaction');

         const oidcResult = {
            login: {
               accountId: userId!,
               acr: '1',
               amr: ['microsoft'],
               remember: true,
               ts: Math.floor(Date.now() / 1000),
            },
         };

         try {
            try {
               const interactionDetails = await provider.interactionDetails(req, res);
               log.debug({
                  uid: interactionDetails?.uid,
                  prompt: interactionDetails?.prompt?.name,
                  hasParams: !!interactionDetails?.params
               }, 'auth-server:microsoft-routes:callback - Interaction details retrieved before finish');
            } catch (detailsError: any) {
               log.warn({
                  error: detailsError?.message || String(detailsError),
                  errorName: detailsError?.name,
                  interactionUid: interactionUid || 'undefined'
               }, 'auth-server:microsoft-routes:callback - Could not get interaction details, session may be expired');
            }

            await provider.interactionFinished(req, res, oidcResult, { mergeWithLastSubmission: false });
            log.info({ interactionUid: interactionUid || 'undefined', userId }, 'auth-server:microsoft-routes:callback - OIDC interaction completed');
            return;
         } catch (interactionError: any) {
            log.error({
               error: interactionError.message,
               interactionUid,
               userId
            }, 'auth-server:microsoft-routes:callback - OIDC interaction failed');

            const redirectUrl = getPostLoginRedirectUrl();
            return res.redirect(`${redirectUrl}?error=session_expired&error_description=${encodeURIComponent('Your login session has expired. Please try again.')}`);
         }
      } catch (error: any) {
         log.error({
            error: error.message,
            stack: error.stack,
            code: code ? code.substring(0, 20) + '...' : 'null',
            storedClientRedirectUri: storedClientRedirectUri || 'NONE'
         }, `auth-server:microsoft-routes:callback - Microsoft OAuth authentication failed: ${error.message}`);

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
}
