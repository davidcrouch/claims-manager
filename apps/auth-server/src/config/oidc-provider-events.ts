import { Provider } from 'oidc-provider';
import { createLogger, LoggerType } from '../lib/logger.js';
import { createTelemetryLogger } from '@morezero/telemetry';
import { trace, context, SpanStatusCode } from '@opentelemetry/api';

const baseLogger = createLogger('auth-server:oidc-provider-events', LoggerType.NODEJS);
const log = createTelemetryLogger(baseLogger, 'oidc-provider-events', 'OidcProviderEvents', 'auth-server');

export function registerOidcProviderEvents(provider: Provider): void {
   const tracer = trace.getTracer('oidc-provider-events', '1.0.0');
   
   return tracer.startActiveSpan('registerOidcProviderEvents', {
      attributes: {
         'oidc.operation': 'register_events',
         'oidc.provider_type': 'oidc'
      }
   }, (span) => {
      // ================================================
      // Interaction Events (authorize start/consent)
      // ================================================

   provider.on('interaction.started', (ctx) => {
      log.info({
         clientId: ctx?.oidc?.client?.clientId,
         redirectUri: ctx?.oidc?.params?.redirect_uri,
         state: ctx?.oidc?.params?.state,
         nonce: ctx?.oidc?.params?.nonce,
         scope: ctx?.oidc?.params?.scope,
         responseType: ctx?.oidc?.params?.response_type,
         host: ctx?.req?.headers?.host,
         xForwardedHost: ctx?.req?.headers?.['x-forwarded-host']
      }, 'OIDC Interaction Started');
   });

   provider.on('interaction.success', (ctx) => {
      log.info({
         uid: ctx?.oidc?.uid,
         clientId: ctx?.oidc?.client?.clientId,
         prompt: ctx?.oidc?.prompt?.name,
         host: ctx?.req?.headers?.host,
         xForwardedHost: ctx?.req?.headers?.['x-forwarded-host']
      }, 'OIDC Interaction Success');
   });

   provider.on('interaction.error', (ctx, error) => {
      log.error({
         error: error.message,
         errorCode: error.error,
         uid: ctx?.oidc?.uid,
         clientId: ctx?.oidc?.client?.clientId,
         prompt: ctx?.oidc?.prompt?.name,
         host: ctx?.req?.headers?.host,
         xForwardedHost: ctx?.req?.headers?.['x-forwarded-host']
      }, 'OIDC Interaction Error');
   });

   // COMMENTED OUT: Business logic moved to allow OIDC provider to handle naturally
   /*
   // Handle InvalidAccount errors by redirecting to login
   provider.on('interaction.error', (ctx, error) => {
      if (error.name === 'InvalidAccount') {
         log.warn({ 
            accountId: ctx?.oidc?.session?.accountId,
            sessionId: ctx?.oidc?.session?.uid 
         }, 'Invalid account detected - redirecting to login');
         
         // Clear the session
         if (ctx?.oidc?.session) {
            ctx.oidc.session.destroy();
         }
         
         // Redirect to login with proper OIDC error
         ctx.throw(400, 'login_required', 'Account data not found - please log in again');
      }
   });
   */

   // ================================================
   // Authorization Endpoint Events
   // ================================================

   provider.on('authorization.success', (ctx) => {
      log.info({
         clientId: ctx?.oidc?.client?.clientId,
         redirectUri: ctx?.oidc?.params?.redirect_uri,
         state: ctx?.oidc?.params?.state,
         nonce: ctx?.oidc?.params?.nonce,
         scope: ctx?.oidc?.params?.scope,
         responseType: ctx?.oidc?.params?.response_type,
         host: ctx?.req?.headers?.host,
         xForwardedHost: ctx?.req?.headers?.['x-forwarded-host']
      }, 'OIDC Authorization Success');
   });
   provider.on('authorization.error', (ctx, error) => {
      const client = ctx?.oidc?.client;
      log.error({
         error: error.message,
         errorCode: error.error,
         errorName: error.name,
         clientId: client?.clientId,
         clientScope: client?.scope, // Client's registered/allowed scopes
         requestedScope: ctx?.oidc?.params?.scope, // Scope being requested
         redirectUri: ctx?.oidc?.params?.redirect_uri,
         state: ctx?.oidc?.params?.state,
         nonce: ctx?.oidc?.params?.nonce,
         responseType: ctx?.oidc?.params?.response_type,
         resource: ctx?.oidc?.params?.resource, // Resource indicator
         host: ctx?.req?.headers?.host,
         xForwardedHost: ctx?.req?.headers?.['x-forwarded-host'],
         isDynamicallyRegistered: client?.clientId && !['morezero-chat-ui', 'api-server-client'].includes(client.clientId),
         clientMetadata: client?.metadata ? Object.keys(client.metadata()) : []
      }, 'OIDC Authorization Error - Detailed diagnostics for access_denied');
   });

   // COMMENTED OUT: Business logic moved to allow OIDC provider to handle naturally
   /*
   // Handle InvalidAccount and login_required errors during authorization
   provider.on('authorization.error', (ctx, error) => {
      log.debug({ errorName: error.name, errorMessage: error.message }, 'Authorization error handler called');
      if (error.name === 'InvalidAccount' || error.name === 'login_required') {
         log.warn({ 
            accountId: ctx?.oidc?.session?.accountId,
            sessionId: ctx?.oidc?.session?.uid,
            clientId: ctx?.oidc?.client?.clientId,
            errorName: error.name
         }, 'Account requires re-authentication during authorization - redirecting to login');
         
         // Clear the session
         if (ctx?.oidc?.session) {
            ctx.oidc.session.destroy();
         }
         
         // Redirect to login with proper OIDC error
         ctx.throw(400, 'login_required', 'Account data not found - please log in again');
      }
   });
   */

   // ================================================
   // Session Events
   // ================================================

   provider.on('session.saved', async (session: any) => {
      // session.accountId is the OIDC standard account identifier (= userId in our system)
      const sessionUserId = session?.accountId;
      let organizationId: string | undefined;

      if (sessionUserId) {
         try {
            const { getStoredAuthResult } = await import('./oidc-provider.js');
            const authResult = await getStoredAuthResult(sessionUserId);
            if (authResult) {
               organizationId = authResult.organizationId;
            }
         } catch (error) {
            log.debug({
               error: error instanceof Error ? error.message : String(error),
               sessionUserId
            }, 'auth-server:oidc-provider-events:session.saved - Could not retrieve auth result');
         }
      }

      log.info({
         uid: session?.uid,
         sessionUserId,
         organizationId,
         loginTs: session?.loginTs,
         amr: session?.amr
      }, 'auth-server:oidc-provider-events:session.saved - Session Saved');

      // COMMENTED OUT: Business logic moved to allow OIDC provider to handle naturally
      /*
      // Validate that auth result data exists when session is created
      const userId = session?.accountId; // OIDC standard: accountId = userId
      if (userId) {
         try {
            const { getStoredAuthResult } = await import('./oidc-provider.js');
            
            let authResult = null;
            let retryCount = 0;
            const maxRetries = 3;
            
            while (retryCount < maxRetries && !authResult) {
               try {
                  authResult = await getStoredAuthResult(userId);
                  break;
               } catch (retryError) {
                  retryCount++;
                  if (retryError.message.includes('Redis') || retryError.message.includes('network')) {
                     log.warn({ 
                        userId,
                        sessionId: session.uid,
                        retryCount,
                        error: retryError.message
                     }, 'Network error during auth result validation - retrying');
                     
                     if (retryCount < maxRetries) {
                        await new Promise(resolve => setTimeout(resolve, 100 * retryCount));
                        continue;
                     }
                  }
                  throw retryError;
               }
            }
            
            if (!authResult || !authResult.user || !authResult.user.userId) {
               const validationDetails = {
                  userId,
                  sessionId: session.uid,
                  hasAuthResult: !!authResult,
                  hasUser: !!(authResult?.user),
                  hasUserId: !!(authResult?.user?.userId),
                  authResultKeys: authResult ? Object.keys(authResult) : [],
                  userKeys: authResult?.user ? Object.keys(authResult.user) : [],
                  timestamp: new Date().toISOString()
               };
               
               log.warn(validationDetails, 'auth-server:oidc-provider-events:session.saved - Auth result invalid for new session - destroying session');
               
               await session.destroy();
               throw new Error('Auth result not found - please log in again');
            } else {
               log.debug({ 
                  userId,
                  sessionId: session.uid,
                  authUserId: authResult.user.userId
               }, 'auth-server:oidc-provider-events:session.saved - Auth result validation successful for new session');
            }
         } catch (error) {
            log.error({ 
               error: error.message,
               userId,
               sessionId: session.uid,
               stack: error.stack
            }, 'auth-server:oidc-provider-events:session.saved - Error validating auth result for new session');
            
            if (error.message.includes('Auth result not found')) {
               throw error;
            }
            
            if (process.env.NODE_ENV === 'development' && 
                (error.message.includes('Redis') || error.message.includes('network'))) {
               log.warn({}, 'Development mode: Keeping session despite network error');
               return;
            }
            
            log.warn({}, 'Non-critical error during validation - keeping session');
         }
      }
      */
   });

   provider.on('session.destroyed', async (session: any) => {
      // session.accountId is the OIDC standard account identifier (= userId in our system)
      const sessionUserId = session?.accountId;
      log.info({
         uid: session?.uid,
         sessionUserId
      }, 'auth-server:oidc-provider-events:session.destroyed - Session Destroyed');
      if (sessionUserId) {
         try {
            const { deleteStoredAuthResult } = await import('./oidc-provider.js');
            await deleteStoredAuthResult(sessionUserId);
         } catch (err) {
            log.warn({
               error: err instanceof Error ? err.message : String(err),
               sessionUserId
            }, 'auth-server:oidc-provider-events:session.destroyed - deleteStoredAuthResult failed (non-fatal)');
         }
      }
   });

   // ================================================
   // Authorization Code Lifecycle (created at /authorize, used at /token)
   // ================================================

   provider.on('authorization_code.saved', (code: any) => {
      log.info({
         jti: code?.jti,
         accountId: code?.accountId,
         clientId: code?.clientId,
         scope: code?.scope,
         redirectUri: code?.redirectUri
      }, 'auth-server:oidc-provider-events:authorization_code.saved - Authorization Code Saved');
   });

   provider.on('authorization_code.consumed', (code: any) => {
      log.info({
         jti: code?.jti,
         accountId: code?.accountId,
         clientId: code?.clientId,
         scope: code?.scope
      }, 'auth-server:oidc-provider-events:authorization_code.consumed - Authorization Code Consumed');
   });

   provider.on('authorization_code.destroyed', (code: any) => {
      log.info({
         jti: code?.jti,
         accountId: code?.accountId,
         clientId: code?.clientId,
         scope: code?.scope
      }, 'auth-server:oidc-provider-events:authorization_code.destroyed - Authorization Code Destroyed');
   });

   // ================================================
   // Token Endpoint Events (/token)
   // ================================================

   provider.on('token.before', (ctx) => {
      log.info({
         step: 'jwt_customizer_tracking_reset',
         clientId: ctx?.oidc?.client?.clientId,
         grantType: ctx?.oidc?.params?.grant_type,
         code: ctx?.oidc?.params?.code?.substring(0, 20) + '...',
         redirectUri: ctx?.oidc?.params?.redirect_uri
      }, 'JWT customizer tracking reset');
   });

   provider.on('token.start', (ctx) => {
      log.info({
         step: 'token_processing_start',
         clientId: ctx?.oidc?.client?.clientId,
         grantType: ctx?.oidc?.params?.grant_type,
         code: ctx?.oidc?.params?.code?.substring(0, 20) + '...',
         redirectUri: ctx?.oidc?.params?.redirect_uri
      }, 'Token processing started');
   });

   // Signing events occur during token issuance
   provider.on('jwt.sign', (ctx, token) => {
      log.info({
         tokenType: token.constructor.name,
         clientId: ctx?.oidc?.client?.clientId,
         accountId: token.accountId,
         scope: token.scope
      }, 'JWT Sign Event - Token being signed');
   });

   provider.on('jwt.sign.error', (ctx, error, token) => {
      log.error({
         error: error.message,
         stack: error.stack,
         tokenType: token?.constructor?.name,
         clientId: ctx?.oidc?.client?.clientId,
         accountId: token?.accountId,
         scope: token?.scope,
         fullError: error
      }, 'JWT Sign Error - DETAILED');
   });

   provider.on('token.after', (ctx) => {
      log.info({
         step: 'token_after_event',
         hasAccessToken: !!ctx?.oidc?.entities?.AccessToken,
         hasIdToken: !!ctx?.oidc?.entities?.IdToken
      }, 'Token generation completed');
   });

   provider.on('token.success', (ctx) => {
      log.info({
         ctx: ctx ? {
            method: ctx.req?.method,
            url: ctx.req?.url,
            headers: ctx.req?.headers,
            entities: ctx?.oidc?.entities
         } : undefined
      }, 'OIDC Token Success - METADATA');

      const accessTokenJWT = ctx?.oidc?.entities?.AccessToken?.jwt;
      let accessTokenPayload = null;
      if (accessTokenJWT) {
         try {
            const parts = accessTokenJWT.split('.');
            if (parts.length === 3) {
               const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
               accessTokenPayload = payload;
            }
         } catch (error) {
            log.warn({ functionName: 'registerOidcProviderEvents', error: error.message }, 'Failed to decode access token JWT for logging');
         }
      }

      const hasAccessToken = !!ctx?.oidc?.entities?.AccessToken;
      const hasIdToken = !!ctx?.oidc?.entities?.IdToken;
      const hasRefreshToken = !!ctx?.oidc?.entities?.RefreshToken;

      const logInfo: Record<string, unknown> = {};
      logInfo.host = ctx?.req?.headers?.host;
      logInfo.xForwardedHost = ctx?.req?.headers?.['x-forwarded-host'];
      logInfo.clientId = ctx?.oidc?.client?.clientId;
      logInfo.grantType = ctx?.oidc?.params?.grant_type;
      logInfo.code = ctx?.oidc?.params?.code?.substring(0, 20) + '...';
      logInfo.redirectUri = ctx?.oidc?.params?.redirect_uri;
      logInfo.state = ctx?.oidc?.params?.state;
      logInfo.hasAccessToken = hasAccessToken;
      logInfo.hasIdToken = hasIdToken;
      logInfo.hasRefreshToken = hasRefreshToken;
      hasAccessToken && (logInfo.accessTokenId = ctx?.oidc?.entities?.AccessToken?.jti);
      hasIdToken && (logInfo.idTokenId = ctx?.oidc?.entities?.IdToken?.jti);
      hasRefreshToken && (logInfo.refreshTokenId = ctx?.oidc?.entities?.RefreshToken?.jti);

      log.info(logInfo, 'OIDC Token Success - DETAILED');
   });

   provider.on('token.error', (ctx, error) => {
      log.error({
         error: error.message,
         errorCode: error.error,
         clientId: ctx?.oidc?.client?.clientId,
         grantType: ctx?.oidc?.params?.grant_type,
         code: ctx?.oidc?.params?.code?.substring(0, 20) + '...',
         redirectUri: ctx?.oidc?.params?.redirect_uri,
         state: ctx?.oidc?.params?.state,
         host: ctx?.req?.headers?.host,
         xForwardedHost: ctx?.req?.headers?.['x-forwarded-host'],
         stack: error.stack,
         fullError: error,
         requestBody: ctx?.req?.body,
         requestHeaders: ctx?.req?.headers,
      }, 'OIDC Token Error - DETAILED');
   });

   // ================================================
   // Access Token Lifecycle
   // ================================================

   provider.on('access_token.issued', (token: any) => {
      log.info({
         jti: token?.jti,
         accountId: token?.accountId,
         clientId: token?.clientId,
         scope: token?.scope
      }, 'auth-server:oidc-provider-events:access_token.issued - Access Token Issued');
   });
   provider.on('access_token.saved', (token: any) => {
      log.info({
         jti: token?.jti,
         accountId: token?.accountId,
         clientId: token?.clientId,
         scope: token?.scope
      }, 'auth-server:oidc-provider-events:access_token.saved - Access Token Saved');
   });
   provider.on('access_token.destroyed', (token: any) => {
      log.info({
         jti: token?.jti,
         accountId: token?.accountId,
         clientId: token?.clientId,
         scope: token?.scope
      }, 'auth-server:oidc-provider-events:access_token.destroyed - Access Token Destroyed');
   });

   // ================================================
   // Refresh Token Lifecycle
   // ================================================

   provider.on('refresh_token.saved', (token: any) => {
      log.info({
         jti: token?.jti,
         accountId: token?.accountId,
         clientId: token?.clientId,
         scope: token?.scope
      }, 'auth-server:oidc-provider-events:refresh_token.saved - Refresh Token Saved');
   });
   provider.on('refresh_token.consumed', (token: any) => {
      log.info({
         jti: token?.jti,
         accountId: token?.accountId,
         clientId: token?.clientId,
         scope: token?.scope
      }, 'auth-server:oidc-provider-events:refresh_token.consumed - Refresh Token Consumed');
   });
   provider.on('refresh_token.destroyed', (token: any) => {
      log.info({
         jti: token?.jti,
         accountId: token?.accountId,
         clientId: token?.clientId,
         scope: token?.scope
      }, 'auth-server:oidc-provider-events:refresh_token.destroyed - Refresh Token Destroyed');
   });

   // ================================================
   // Client Credentials Lifecycle (M2M)
   // ================================================

   provider.on('client_credentials.issued', (token: any) => {
      log.info({
         jti: token?.jti,
         clientId: token?.clientId,
         scope: token?.scope
      }, 'auth-server:oidc-provider-events:client_credentials.issued - Client Credentials Issued');
   });
   provider.on('client_credentials.saved', (token: any) => {
      log.info({
         jti: token?.jti,
         clientId: token?.clientId,
         scope: token?.scope
      }, 'auth-server:oidc-provider-events:client_credentials.saved - Client Credentials Saved');
   });
   provider.on('client_credentials.destroyed', (token: any) => {
      log.info({
         jti: token?.jti,
         clientId: token?.clientId,
         scope: token?.scope
      }, 'auth-server:oidc-provider-events:client_credentials.destroyed - Client Credentials Destroyed');
   });

   // ================================================
   // UserInfo Endpoint Events
   // ================================================

   provider.on('userinfo.success', (ctx, ...rest) => {
      log.info({
         subject: ctx?.oidc?.session?.accountId,
      }, 'auth-server:oidc-provider-events:userinfo.success - UserInfo Success');
   });
   provider.on('userinfo.error', (ctx, error, ...rest) => {
      log.error({
         error: error?.message,
         subject: ctx?.oidc?.session?.accountId,
      }, 'auth-server:oidc-provider-events:userinfo.error - UserInfo Error');
   });

   // ================================================
   // Token Management Endpoints (revocation)
   // ================================================

   provider.on('revocation.success', (ctx, ...rest) => {
      log.info({
         clientId: ctx?.oidc?.client?.clientId,
         token: ctx?.oidc?.params?.token,
      }, 'auth-server:oidc-provider-events:revocation.success - Revocation Success');
   });
   provider.on('revocation.error', (ctx, error, ...rest) => {
      log.error({
         error: error?.message,
         clientId: ctx?.oidc?.client?.clientId,
         token: ctx?.oidc?.params?.token,
      }, 'auth-server:oidc-provider-events:revocation.error - Revocation Error');
   });

   // ================================================
   // Logout Events (end_session)
   // ================================================

   provider.on('end_session.success', async (ctx, ...rest) => {
      // ctx.oidc.session.accountId is the OIDC standard account identifier (= userId in our system)
      const sessionUserId = ctx?.oidc?.session?.accountId;
      log.info({
         clientId: ctx?.oidc?.client?.clientId,
         sessionId: ctx?.oidc?.session?.uid,
         sessionUserId,
         postLogoutRedirectUri: ctx?.oidc?.params?.post_logout_redirect_uri,
      }, 'auth-server:oidc-provider-events:end_session.success - Logout Success');
      if (sessionUserId) {
         try {
            const { deleteStoredAuthResult } = await import('./oidc-provider.js');
            await deleteStoredAuthResult(sessionUserId);
         } catch (err) {
            log.warn({
               error: err instanceof Error ? err.message : String(err),
               sessionUserId
            }, 'auth-server:oidc-provider-events:end_session.success - deleteStoredAuthResult failed (non-fatal)');
         }
      }
   });

   provider.on('end_session.error', (ctx, error, ...rest) => {
      // ctx.oidc.session.accountId is the OIDC standard account identifier (= userId)
      log.error({
         error: error?.message,
         clientId: ctx?.oidc?.client?.clientId,
         sessionId: ctx?.oidc?.session?.uid,
         sessionUserId: ctx?.oidc?.session?.accountId,
      }, 'auth-server:oidc-provider-events:end_session.error - Logout Error');
   });

   // ================================================
   // Grant Lifecycle Events (using supported event names)
   // ================================================

   // Using the correct event names from the official documentation
   provider.on('grant.saved', (grant: any) => {
      log.info({
         jti: grant?.jti,
         accountId: grant?.accountId,
         clientId: grant?.clientId,
         scope: grant?.scope
      }, 'auth-server:oidc-provider-events:grant.saved - Grant Saved');
   });

   provider.on('grant.deleted', (grant: any) => {
      log.info({
         jti: grant?.jti,
         accountId: grant?.accountId,
         clientId: grant?.clientId,
         scope: grant?.scope
      }, 'auth-server:oidc-provider-events:grant.deleted - Grant Deleted');
   });


   // ================================================
   // Dynamic Client Registration
   // ================================================

   provider.on('registration_create.success', (ctx, ...rest) => {
      log.info({
         softwareId: ctx?.req?.body?.software_id,
         clientId: ctx?.oidc?.client?.clientId,
      }, 'auth-server:oidc-provider-events:registration_create.success - Client Registration Created');
   });
   provider.on('registration_create.error', (ctx, error, ...rest) => {
      log.error({
         error: error?.message,
         body: ctx?.req?.body,
      }, 'auth-server:oidc-provider-events:registration_create.error - Client Registration Error');
   });
   provider.on('registration_update.success', (ctx, ...rest) => {
      log.info({
         clientId: ctx?.oidc?.client?.clientId,
      }, 'auth-server:oidc-provider-events:registration_update.success - Client Registration Updated');
   });
   provider.on('registration_update.error', (ctx, error, ...rest) => {
      log.error({
         error: error?.message,
         clientId: ctx?.oidc?.client?.clientId,
      }, 'auth-server:oidc-provider-events:registration_update.error - Client Registration Update Error');
   });
   provider.on('registration_delete.success', (ctx, ...rest) => {
      log.info({
         clientId: ctx?.oidc?.client?.clientId,
      }, 'auth-server:oidc-provider-events:registration_delete.success - Client Registration Deleted');
   });
   provider.on('registration_delete.error', (ctx, error, ...rest) => {
      log.error({
         error: error?.message,
         clientId: ctx?.oidc?.client?.clientId,
      }, 'auth-server:oidc-provider-events:registration_delete.error - Client Registration Delete Error');
   });

   // ================================================
   // JWKS
   // ================================================

   provider.on('jwks.error', (ctx, error) => {
      log.error({
         error: error.message,
         stack: error.stack,
         requestUrl: ctx?.req?.url,
         requestHeaders: ctx?.req?.headers
      }, 'JWKS Error - DETAILED');
   });

   // ================================================
   // Errors
   // ================================================

   provider.on('error', (ctx, error) => {
      log.debug({ errorName: error.name, errorMessage: error.message, url: ctx?.req?.url }, 'General error handler called');
      
      // COMMENTED OUT: Business logic moved to allow OIDC provider to handle naturally
      /*
      // Handle InvalidAccount and login_required errors at the general error level
      if (error.name === 'InvalidAccount' || error.name === 'login_required') {
         log.warn({ 
            accountId: ctx?.oidc?.session?.accountId,
            sessionId: ctx?.oidc?.session?.uid,
            clientId: ctx?.oidc?.client?.clientId,
            url: ctx?.req?.url,
            errorName: error.name
         }, 'Account requires re-authentication - redirecting to login');
         
         // Clear the session
         if (ctx?.oidc?.session) {
            ctx.oidc.session.destroy();
         }
         
         // Redirect to login with proper OIDC error
         ctx.throw(400, 'login_required', 'Account data not found - please log in again');
      }
      */

      log.error({
         error: error.message,
         stack: error.stack,
         ctx: ctx ? {
            method: ctx.req?.method,
            url: ctx.req?.url,
            headers: ctx.req?.headers
         } : undefined,
      }, 'OIDC Provider Unhandled Error - DETAILED');
   });

      provider.on('server_error', (ctx, error) => {
         log.error({
            functionName: 'registerOidcProviderEvents',
            error: error.message,
            stack: error.stack,
            clientId: ctx?.oidc?.client?.clientId,
            requestUrl: ctx?.req?.url,
            requestMethod: ctx?.req?.method,
            requestBody: ctx?.req?.body,
            requestHeaders: ctx?.req?.headers,
            fullError: error
         }, 'OIDC Server Error - DETAILED');
      });

      span.setAttributes({ 'oidc.events_registered': true });
      span.setStatus({ code: SpanStatusCode.OK });
      span.end();
   });
}