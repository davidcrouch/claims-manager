import { Provider, Configuration, interactionPolicy, errors } from 'oidc-provider';
import { createLogger, LoggerType } from '../lib/logger.js';
import { createTelemetryLogger } from '@morezero/telemetry';
import { trace, context, SpanStatusCode } from '@opentelemetry/api';
import UpstashAdapter from './upstash-adapter.js';
import { GlobalCacheManager } from '../lib/cache/global-cache-manager.js';
import register from './register-prompt.js';
import selectOrganization from './select-organization-prompt.js';
import selectOrg from './select-org-prompt.js';
import {
   getOidcIssuer,
   getClientId,
   getAllRedirectUris,
   getJwksConfig,
   getApiUrl,
   getMcpBaseUrl,
   getTokenTtlConfig,
   getOidcCookieKeys
} from './env-validation.js';
import { registerOidcProviderEvents } from './oidc-provider-events.js';
import { renderLogoutPage } from '../helpers/logout-renderer.js';
import {
   getStaticClients,
   CLAIMS_MANAGER_UI_CLIENT_ID,
} from './static-clients.js';

const baseLogger = createLogger('auth-server:oidc-provider', LoggerType.NODEJS);
const log = createTelemetryLogger(baseLogger, 'oidc-provider', 'OidcProvider', 'auth-server');

// Re-export for consumers (e.g. auth-routes)
export { CLAIMS_MANAGER_UI_CLIENT_ID };

/** Parse DCR `allowed_apps` (array or JSON string) for MCP gateway authorization. */
function normalizeAllowedAppsFromMetadata(metadata: Record<string, unknown> | undefined): string[] {
   if (!metadata) return [];
   const raw = metadata.allowed_apps;
   if (raw == null) return [];
   if (Array.isArray(raw)) {
      return raw.filter((x): x is string => typeof x === 'string' && x.length > 0);
   }
   if (typeof raw === 'string') {
      try {
         const parsed = JSON.parse(raw) as unknown;
         if (Array.isArray(parsed)) {
            return parsed.filter((x): x is string => typeof x === 'string' && x.length > 0);
         }
      } catch {
         return [];
      }
   }
   return [];
}

// Initialize Redis connection using global cache manager
async function initializeRedis() {
   try {
      const redis = await GlobalCacheManager.getInstance('auth-server');
      log.info({
         redisInitialized: true,
         purpose: 'auth_result_storage',
         sharedConnection: true
      }, 'Redis client initialized using global cache manager for auth result storage');
      return redis;
   } catch (error) {
      log.error({
         error: error.message,
         stack: error.stack
      }, 'Failed to initialize Redis connection for auth result storage');
      throw error;
   }
}

// Helper function to store authResult in Redis
export async function storeAuthResult(userId: string, authResult: any) {
   const tracer = trace.getTracer('oidc-provider', '1.0.0');
   
   return tracer.startActiveSpan('storeAuthResult', {
      attributes: {
         'oidc.user_id': userId,
         'oidc.has_access_token': !!authResult.accessToken,
         'oidc.has_refresh_token': !!authResult.refreshToken,
         'oidc.has_user': !!authResult.user,
         'oidc.organization_id': authResult.organizationId || ''
      }
   }, async (span) => {
      try {
         const redis = await initializeRedis();
         const key = `auth:user:${userId}`;

      const cleanAuthResult = {
         accessToken: authResult.accessToken,
         refreshToken: authResult.refreshToken,
         user: {
            userId: authResult.user?.userId,
            name: authResult.user?.name,
            email: authResult.user?.email,
            avatarURL: authResult.user?.avatarURL,
            phone: authResult.user?.phone
         },
         organizationId: authResult.organizationId,
         // Add token metadata for token exchange
         metadata: {
            stored_at: Date.now(),
            expires_at: Date.now() + (getTokenTtlConfig().refreshToken * 1000),
            source: 'login',
            version: '1.0'
         }
      };

         log.info({
            userId,
            cleanAuthResult,
         }, 'auth-server:oidc-provider:storeAuthResult - Storing auth result in Redis');

         // Store with refresh token TTL to match token lifetime
         const refreshTokenTtl = getTokenTtlConfig().refreshToken;
         await redis.set(key, cleanAuthResult, { ex: refreshTokenTtl });
         log.debug({ functionName: 'storeAuthResult', userId, key }, 'auth-server:oidc-provider:storeAuthResult - Stored auth result in Redis');

         span.setAttributes({
            'oidc.storage_success': true,
            'oidc.storage_key': key,
            'oidc.storage_ttl': refreshTokenTtl
         });
         span.setStatus({ code: SpanStatusCode.OK });

      } catch (error) {
         log.error({ functionName: 'storeAuthResult', error: error.message, userId }, 'auth-server:oidc-provider:storeAuthResult - Failed to store auth result in Redis');
         span.recordException(error);
         span.setAttributes({ 'oidc.storage_success': false, 'oidc.storage_error': error.message });
         span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
      } finally {
         span.end();
      }
   });
}

// Helper function to retrieve authResult from Redis
export async function getStoredAuthResult(userId: string) {
   const tracer = trace.getTracer('oidc-provider', '1.0.0');
   
   return tracer.startActiveSpan('getStoredAuthResult', {
      attributes: {
         'oidc.user_id': userId,
         'oidc.operation': 'retrieve'
      }
   }, async (span) => {
      try {
         const redis = await initializeRedis();
         const key = `auth:user:${userId}`;
      const authResult = await redis.get<{
         accessToken?: string;
         refreshToken?: string;
         user: {
            userId: string;
            name?: string;
            email?: string;
            avatarURL?: string;
            phone?: string;
            provider?: string;
         };
         organizationId?: string;
      }>(key);

         if (authResult) {
            log.debug({ userId, key }, 'auth-server:oidc-provider:getStoredAuthResult - Retrieved auth result from Redis');
            span.setAttributes({
               'oidc.retrieval_success': true,
               'oidc.retrieval_key': key,
               'oidc.has_auth_result': true
            });
            span.setStatus({ code: SpanStatusCode.OK });
            return authResult;
         }

         log.warn({ userId, key }, 'auth-server:oidc-provider:getStoredAuthResult - No auth result found in Redis');
         span.setAttributes({
            'oidc.retrieval_success': false,
            'oidc.retrieval_key': key,
            'oidc.has_auth_result': false
         });
         span.setStatus({ code: SpanStatusCode.OK });
         return null;
      } catch (error) {
         log.error({ error: error.message, userId }, 'auth-server:oidc-provider:getStoredAuthResult - Failed to retrieve auth result from Redis');
         span.recordException(error);
         span.setAttributes({
            'oidc.retrieval_success': false,
            'oidc.retrieval_error': error.message
         });
         span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
         return null;
      } finally {
         span.end();
      }
   });
}

/**
 * Delete the stored auth result (auth:user:{userId}) from Redis.
 * Used during logout to clean up auth data. Safe to call multiple times (idempotent).
 */
export async function deleteStoredAuthResult(userId: string): Promise<void> {
   const tracer = trace.getTracer('oidc-provider', '1.0.0');
   return tracer.startActiveSpan('deleteStoredAuthResult', {
      attributes: { 'oidc.user_id': userId }
   }, async (span) => {
      try {
         const redis = await initializeRedis();
         const key = `auth:user:${userId}`;
         await redis.del(key);
         log.info(
            { functionName: 'deleteStoredAuthResult', userId, key },
            'auth-server:oidc-provider:deleteStoredAuthResult - Deleted auth result from Redis'
         );
         span.setAttributes({ 'oidc.delete_success': true, 'oidc.delete_key': key });
         span.setStatus({ code: SpanStatusCode.OK });
      } catch (error: any) {
         log.error(
            { functionName: 'deleteStoredAuthResult', error: error.message, userId },
            'auth-server:oidc-provider:deleteStoredAuthResult - Failed to delete auth result from Redis'
         );
         span.recordException(error);
         span.setAttributes({ 'oidc.delete_success': false, 'oidc.delete_error': error.message });
         span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
      } finally {
         span.end();
      }
   });
}

// ============================================================================
// OAUTH STATE STORAGE (CSRF protection during OAuth redirects)
// ============================================================================

export interface OAuthStateData {
   createdAt: number;
   interactionUid?: string;
   clientRedirectUri?: string;
}

export interface GoogleAuthCodeData {
   token: string;
   userId: string;
   email: string;
   name: string;
   picture: string;
   createdAt: number;
   googleAccessToken?: string;
   googleRefreshToken?: string;
}

const OAUTH_STATE_TTL_SECONDS = 600; // 10 minutes
const AUTH_CODE_TTL_SECONDS = 300; // 5 minutes
const APP_SLUG_TTL_SECONDS = 3600; // 1 hour

// ============================================================================
// APP SLUG STORAGE (persists app_slug across OIDC interaction steps)
// ============================================================================

/**
 * Store the app slug for a given OIDC interaction.
 * The app slug identifies the target application (e.g. "chat") and is passed
 * by client apps via the app_slug query parameter on the /authorize redirect.
 */
export async function storeAppSlug(sessionUid: string, appSlug: string): Promise<void> {
   try {
      const redis = await initializeRedis();
      const key = `oidc:app-slug:${sessionUid}`;
      await redis.set(key, appSlug, { ex: APP_SLUG_TTL_SECONDS });
      log.debug({ functionName: 'storeAppSlug', sessionUid }, 'auth-server:oidc-provider:storeAppSlug - Stored');
   } catch (error: any) {
      log.error({ functionName: 'storeAppSlug', sessionUid, error: error.message }, 'auth-server:oidc-provider:storeAppSlug - Failed');
   }
}

/**
 * Retrieve the app slug for a given OIDC interaction.
 */
export async function getAppSlug(sessionUid: string): Promise<string | null> {
   try {
      const redis = await initializeRedis();
      const key = `oidc:app-slug:${sessionUid}`;
      const appSlug = await redis.get<string>(key);
      if (appSlug) {
         log.debug({ functionName: 'getAppSlug', sessionUid }, 'auth-server:oidc-provider:getAppSlug - Found');
      }
      return appSlug;
   } catch (error: any) {
      log.error({ functionName: 'getAppSlug', sessionUid, error: error.message }, 'auth-server:oidc-provider:getAppSlug - Failed');
      return null;
   }
}

/**
 * Store OAuth state for CSRF protection during OAuth redirects.
 */
export async function storeOAuthState(stateId: string, data: OAuthStateData): Promise<void> {
   try {
      const redis = await initializeRedis();
      const key = `oauth:state:${stateId}`;
      await redis.set(key, data, { ex: OAUTH_STATE_TTL_SECONDS });
      log.debug({ 
         functionName: 'storeOAuthState',
         stateId, 
         hasInteractionUid: !!data.interactionUid 
      }, 'auth-server:oidc-provider:storeOAuthState - Stored');
   } catch (error: any) {
      log.error({ 
         functionName: 'storeOAuthState',
         stateId, 
         error: error.message 
      }, 'auth-server:oidc-provider:storeOAuthState - Failed');
      throw error;
   }
}

/**
 * Retrieve and delete OAuth state (one-time use).
 */
export async function consumeOAuthState(stateId: string): Promise<OAuthStateData | null> {
   try {
      const redis = await initializeRedis();
      const key = `oauth:state:${stateId}`;
      const data = await redis.get<OAuthStateData>(key);
      
      if (data) {
         await redis.del(key);
         log.debug({ 
            functionName: 'consumeOAuthState',
            stateId
         }, 'auth-server:oidc-provider:consumeOAuthState - Consumed');
         return data;
      }
      
      log.warn({ 
         functionName: 'consumeOAuthState',
         stateId 
      }, 'auth-server:oidc-provider:consumeOAuthState - Not found or expired');
      return null;
   } catch (error: any) {
      log.error({ 
         functionName: 'consumeOAuthState',
         stateId, 
         error: error.message 
      }, 'auth-server:oidc-provider:consumeOAuthState - Failed');
      return null;
   }
}

/**
 * Store Google auth code for token exchange.
 */
export async function storeGoogleAuthCode(code: string, data: GoogleAuthCodeData): Promise<void> {
   try {
      const redis = await initializeRedis();
      const key = `oauth:google-code:${code}`;
      await redis.set(key, data, { ex: AUTH_CODE_TTL_SECONDS });
      log.debug({ 
         functionName: 'storeGoogleAuthCode',
         userId: data.userId 
      }, 'auth-server:oidc-provider:storeGoogleAuthCode - Stored');
   } catch (error: any) {
      log.error({ 
         functionName: 'storeGoogleAuthCode',
         error: error.message 
      }, 'auth-server:oidc-provider:storeGoogleAuthCode - Failed');
      throw error;
   }
}

/**
 * Retrieve and delete Google auth code (one-time use).
 */
export async function consumeGoogleAuthCode(code: string): Promise<GoogleAuthCodeData | null> {
   try {
      const redis = await initializeRedis();
      const key = `oauth:google-code:${code}`;
      const data = await redis.get<GoogleAuthCodeData>(key);
      
      if (data) {
         await redis.del(key);
         log.debug({ 
            functionName: 'consumeGoogleAuthCode',
            userId: data.userId 
         }, 'auth-server:oidc-provider:consumeGoogleAuthCode - Consumed');
         return data;
      }
      
      log.warn({ 
         functionName: 'consumeGoogleAuthCode'
      }, 'auth-server:oidc-provider:consumeGoogleAuthCode - Not found or expired');
      return null;
   } catch (error: any) {
      log.error({ 
         functionName: 'consumeGoogleAuthCode',
         error: error.message 
      }, 'auth-server:oidc-provider:consumeGoogleAuthCode - Failed');
      return null;
   }
}

export async function createOidcProvider(): Promise<Provider> {
   const tracer = trace.getTracer('oidc-provider', '1.0.0');
   
   return tracer.startActiveSpan('createOidcProvider', {
      attributes: {
         'oidc.operation': 'create_provider',
         'oidc.provider_type': 'oidc'
      }
   }, async (span) => {
   const ISSUER = getOidcIssuer();

   // Connect to Redis and create adapter
   const redis = await UpstashAdapter.connect();

   const adapterFunction = (name: string) => {
      return new UpstashAdapter(name);
   };

   //====================================================================
   // Define OIDC Provider Configuration
   //====================================================================
   const config: Configuration = {

      features: {
         devInteractions: { enabled: false }, // Disabled - using custom interactions
         deviceFlow: { enabled: true }, // OAuth 2.0 device authorization for mz CLI (registry-cli client)
         registration: { 
            enabled: true,
            initialAccessToken: false, // Allow public registration without IAT for MCP clients
            idFactory: undefined, // Use default client ID generation
            secretFactory: undefined, // Use default secret generation (if needed)
            // Note: node-oidc-provider automatically validates that requested scopes
            // during authorization match the client's registered scopes
         },
         registrationManagement: { enabled: true },
         introspection: { enabled: false },
         resourceIndicators: {
            enabled: true,
            async defaultResource(ctx, client, requestedResource) {
               log.info({
                  functionName: 'defaultResource',
                  requestedResource,
                  clientId: client?.clientId
               }, 'auth-server:oidc-provider:defaultResource - Resource/audience from client request');
               if (requestedResource) return requestedResource;
               log.info({ functionName: 'defaultResource', fallback: ISSUER }, 'auth-server:oidc-provider:defaultResource - Using issuer as default audience');
               return ISSUER;
            },
            getResourceServerInfo(ctx, resourceIndicator, client) {
               const resolved = resourceIndicator || ISSUER;
               const supportedScopes =
                  'openid profile email offline_access registry:read registry:import registry:admin mcp:invoke mcp:read mcp:write';

               const accessTokenConfig = {
                  scope: supportedScopes,
                  audience: resolved,
                  accessTokenFormat: 'jwt',
                  jwt: { sign: { alg: 'RS256' } }
               };
               log.info({
                  functionName: 'getResourceServerInfo',
                  resourceIndicator,
                  audienceMinted: resolved,
                  clientId: client?.clientId
               }, 'auth-server:oidc-provider:getResourceServerInfo - Token will be minted with this audience');
               return accessTokenConfig;
            },
            useGrantedResource(ctx, model) {
               log.info({
                  model,
                  kind: model.kind,
                  scope: model.scope,
                  hasOpenId: model.scope?.includes('openid')
               }, '🔍 useGrantedResource - Should use granted resource without explicit request?');
               // Return true to allow JWT access tokens without explicit resource parameter
               return true;
            }
         },
         claimsParameter: { enabled: true },
         clientCredentials: { enabled: true },
         revocation: { enabled: true },
         backchannelLogout: { enabled: true },
         rpInitiatedLogout: {
            enabled: true,
            logoutSource: async function logoutSource(ctx, form) {
               // Show logout screen while system processes logout
               log.info({
                  action: 'logout_source',
                  clientId: ctx.oidc?.client?.clientId,
                  sessionId: ctx.oidc?.session?.id,
                  host: ctx.host
               }, 'auth-server:oidc-provider:logoutSource - Rendering logout page');

               try {
                  const html = await renderLogoutPage(ctx, form);
                  ctx.body = html;
               } catch (error) {
                  log.error({
                     error: error.message,
                     clientId: ctx.oidc?.client?.clientId
                  }, 'Failed to render logout page, using fallback');

                  // Fallback to simple HTML if rendering fails
                  ctx.body = `<!DOCTYPE html>
<html>
<head>
    <title>Logging out...</title>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
</head>
<body>
    <h1>Logging out...</h1>
    <p>Please wait while we sign you out.</p>
    ${form}
    <script>
        setTimeout(() => {
            const form = document.getElementById('op.logoutForm');
            if (form) {
                const logoutInput = document.createElement('input');
                logoutInput.type = 'hidden';
                logoutInput.name = 'logout';
                logoutInput.value = 'yes';
                form.appendChild(logoutInput);
                form.submit();
            }
        }, 1000);
    </script>
</body>
</html>`;
               }
            }
         }
      },

      // Discovery endpoints are enabled by default in node-oidc-provider
      // The OAuth authorization server endpoint should be available automatically

      responseTypes: ['code'],

      pkce: {
         required: (ctx) => {
            const client = ctx?.oidc?.client;
            if (!client) return true;
            return !client.clientSecret; // PKCE required for public clients only
         },
         methods: ['S256']
      },

      // Static clients - see static-clients.ts
      clients: getStaticClients(),

      // JWKS configuration loaded from environment variables
      jwks: getJwksConfig(),

      // Custom interaction handling with register prompt support
      interactions: {
         url: (ctx, interaction) => {
            log.info({
               prompt: interaction.prompt.name,
               uid: interaction.uid,
               timestamp: new Date().toISOString()
            }, 'OIDC interaction function called');

            // Persist app_slug from the authorize query parameter into Redis
            // keyed by the interaction UID so downstream route handlers can retrieve it.
            const appSlug = ctx.oidc?.params?.app_slug as string | undefined;
            if (appSlug) {
               storeAppSlug(interaction.uid, appSlug).catch(() => {});
               log.info({
                  prompt: interaction.prompt.name,
                  uid: interaction.uid,
                  appSlug
               }, 'auth-server:oidc-provider:url - Persisted app slug for interaction');
            }

            const interactionUrl = `/interaction/${interaction.uid}`;
            return interactionUrl;
         },
         // Custom interaction policy with register, select_organization, and select_org prompts
         policy: (() => {
            const basePolicy = interactionPolicy.base();
            // Policy order:
            // 0: register - Before auth, for new users
            // 1: select_organization - After register, for existing users with multiple organizations
            // 2: login    - Authenticate user (built-in)
            // 3: select_org - After login, for multi-org users
            // 4: consent  - After org selected (built-in)
            
            // Add register prompt before login (index 0)
            basePolicy.add(register(), 0);
            
            // Add select_organization prompt after register, before login (index 1)
            basePolicy.add(selectOrganization(), 1);
            
            // Add select_org prompt after login (index 3, since register=0, select_organization=1, login=2)
            basePolicy.add(selectOrg(), 3);
            
            log.info({ prompts: basePolicy.map(p => p.name) }, 'Interaction policy configured with custom prompts');
            return basePolicy;
         })(),
      },

      // JWT format configuration - using official node-oidc-provider API
      // Note: node-oidc-provider uses different configuration for JWT formats


      // Define which claims are returned for each scope
      // Scopes listed here are treated as OIDC scopes (appear in missingOIDCScope during consent).
      // registry:* scopes have no claims but must be here so the provider classifies them as OIDC
      // scopes rather than resource scopes when resourceIndicators is enabled.
      claims: {
         openid: ['sub', 'organization_id'],
         profile: ['name', 'given_name', 'family_name', 'picture'],
         email: ['email', 'email_verified'],
         phone: ['phone_number', 'phone_number_verified'],
         address: ['address'],
         'registry:admin': [],
         'registry:read': [],
         'registry:import': [],
         'mcp:invoke': [],
         'mcp:read': [],
         'mcp:write': [],
      },

      scopes: [
         'openid',
         'profile',
         'email',
         'address',
         'phone',
         'offline_access',
         'introspection',
         'token-exchange',
         'registry:read',
         'registry:import',
         'registry:admin',
         'mcp:invoke',
         'mcp:read',
         'mcp:write',
      ],

      ttl: (() => {
         const tokenTtl = getTokenTtlConfig();
         return {
            AccessToken: tokenTtl.accessToken,
            AuthorizationCode: tokenTtl.authorizationCode,
            IdToken: tokenTtl.idToken,
            RefreshToken: tokenTtl.refreshToken,
            Session: tokenTtl.session, 
            Interaction: tokenTtl.interaction,
            Grant: tokenTtl.refreshToken
         };
      })(),

      routes: {
         authorization: '/authorize',
         backchannel_authentication: '/backchannel',
         challenge: '/challenge',
         code_verification: '/device',
         device_authorization: '/device/auth',
         end_session: '/session/end',
         introspection: '/token/introspection',
         jwks: '/jwks',
         pushed_authorization_request: '/request',
         registration: '/reg',
         revocation: '/token/revocation',
         token: '/token',
         userinfo: '/me'
      },

      // Adapter configuration
      adapter: adapterFunction,
      extraParams: ['resource', 'audience', 'app_slug'],

      // Cookie configuration for secure sessions
      // IMPORTANT: keys are REQUIRED for signing cookies - without them, cookies fail
      // validation after cross-site redirects (e.g., Google OAuth) causing "session expired" errors
      cookies: {
         keys: getOidcCookieKeys(),
         long: {
            signed: true,
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production' || process.env.OIDC_COOKIES_SECURE === 'true',
            sameSite: 'lax' as const,
            maxAge: 14 * 24 * 60 * 60 * 1000, // 14 days
         },
         short: {
            signed: true,
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production' || process.env.OIDC_COOKIES_SECURE === 'true',
            sameSite: 'lax' as const,
            maxAge: 10 * 60 * 1000, // 10 minutes for interactions
         }
      },

      // DCR: persist organization + MCP app allow-list (used in JWT for MCP gateway, doc 35)
      extraClientMetadata: {
         properties: ['organization_id', 'allowed_apps'],
         validator(_ctx, key, value, _metadata) {
            if (key === 'organization_id') {
               if (value !== undefined && value !== null && typeof value !== 'string') {
                  throw new errors.InvalidClientMetadata('organization_id must be a string');
               }
            }
            if (key === 'allowed_apps') {
               if (value === undefined || value === null) return;
               if (!Array.isArray(value)) {
                  throw new errors.InvalidClientMetadata('allowed_apps must be an array of strings');
               }
               const bad = value.some((v) => typeof v !== 'string');
               if (bad) {
                  throw new errors.InvalidClientMetadata('allowed_apps entries must be strings');
               }
            }
         },
      },

      //
      // Integration Point: Retrieve account previously loaded by backend API in /authorize endpoint (/interaction/:uid/login)
      //  Function builds account profile for IdToken or userinfo endpoint
      //
      findAccount: async function(ctx, id) {
         log.debug({ id }, 'auth-server:oidc-provider:findAccount - Loading account from Redis');

         try {
            // Get the stored authResult for this user
            let authResult = await getStoredAuthResult(id);
            
            // If not found and we have a select_org result, try using userId from there
            if (!authResult) {
               const selectOrgResult = ctx.oidc?.result?.select_org;
               const selectOrgUserId = selectOrgResult?.userId;
               if (selectOrgUserId && selectOrgUserId !== id) {
                  log.debug({ id, selectOrgUserId }, 'auth-server:oidc-provider:findAccount - Retrying with select_org userId');
                  authResult = await getStoredAuthResult(selectOrgUserId);
               }
            }

            if (authResult && authResult.user) {

               const user = authResult.user;
               const organizationId = authResult.organizationId;

               log.debug({ 
                  id, 
                  user, 
                  organizationId, 
               }, 'auth-server:oidc-provider:findAccount - Retrieved account from Redis');


               // Use userId from authResult for sub (admin-ui OrganizationsForUser expects user_id)
               const userId = user.userId ?? id;
               return {
                  accountId: id,  // Must match the id passed in (userId - used as OIDC account identifier)
                  async claims(use, scope) {
                     const userClaims: any = {
                        sub: userId,
                        organization_id: organizationId,
                     };

                     // Add profile claims (includes name)
                     // Note: scope can be a string or array, handle both
                     const scopeString = typeof scope === 'string' ? scope : scope.join(' ');
                     if (scopeString.includes('profile')) {
                        userClaims.name = user.name;
                        userClaims.given_name = user.name ? user.name.split(' ')[0] : '';
                        userClaims.family_name = user.name ? user.name.split(' ').slice(1).join(' ') : '';
                        userClaims.picture = user.avatarURL || '';
                     }

                     // Add email claims
                     if (scopeString.includes('email')) {
                        userClaims.email = user?.email;
                        userClaims.email_verified = true;
                     }

                     // Add address claims if needed
                     if (scopeString.includes('address')) {
                        userClaims.address = {};
                     }

                     // Add phone claims if needed (OIDC standard phone scope)
                     if (scopeString.includes('phone')) {
                        userClaims.phone_number = user?.phone || '';
                        userClaims.phone_number_verified = true;
                     }

                     log.debug({
                        use,
                        scope: scopeString,
                        claimKeys: Object.keys(userClaims)
                     }, 'auth-server:oidc-provider:findAccount.claims - Generated user claims');

                     return userClaims;
                  }
               };
            }

            // No stored authResult available - this should not happen if session validation is working
            log.warn({ id }, 'auth-server:oidc-provider:findAccount - No stored authResult available, this should have been caught by session validation');
            
            // Throw InvalidAccount error to trigger proper OIDC error handling
            const error = new Error('Account data not found - please log in again');
            error.name = 'InvalidAccount';
            throw error;
         } catch (error) {
            // Re-throw InvalidAccount errors to be handled by error handlers
            if (error.name === 'InvalidAccount') {
               throw error;
            }
            log.error({ error: error.message, id }, 'auth-server:oidc-provider:findAccount - Failed to load account from Redis');
            
            // Throw InvalidAccount error to trigger proper OIDC error handling
            const invalidAccountError = new Error('Account data not found - please log in again');
            invalidAccountError.name = 'InvalidAccount';
            throw invalidAccountError;
         }
      },

      // Client credentials for M2M
      clientCredentials: async function(ctx, client, scopes) {
         log.info({ clientId: client.clientId, scopes }, 'Processing client credentials');

         const meta = (client.metadata?.() ?? {}) as Record<string, unknown>;
         const organizationId = (meta.organization_id as string) || 'default-organization';
         const allowedApps = normalizeAllowedAppsFromMetadata(meta);

         return {
            scope: scopes.join(' '),
            extra: {
               organization_id: organizationId,
               roles: (meta.roles as unknown[]) || [],
               features: (meta.features as unknown[]) || [],
               ...(allowedApps.length > 0 ? { allowed_apps: allowedApps } : {}),
            },
         };
      },

      // Extra claims for access tokens
      extraTokenClaims: async function(ctx, token) {
         log.info({
            tokenType: token.kind,
            hasSession: !!ctx.oidc.session,
            hasEntities: !!ctx.oidc.entities,
            hasAccount: !!ctx.oidc.entities?.Account,
            sessionAccountId: ctx.oidc.session?.accountId,
            entitiesAccountId: ctx.oidc.entities?.Account?.accountId
         }, 'auth-server:oidc-provider:extraTokenClaims - Function called');


         // Only add extra claims to access tokens
         if (token.kind !== 'AccessToken') {
            log.debug({ tokenType: token.kind }, 'auth-server:oidc-provider:extraTokenClaims - Skipping non-access token');
            return {};
         }

         // Get account data to include user-specific claims
         // Priority: select_org result > session accountId > login accountId
         // Note: sessionAccountId is the OIDC account identifier (userId), used as Redis key
         const selectOrgResult = ctx.oidc.result?.select_org;
         const selectOrgUserId = selectOrgResult?.userId;
         const sessionAccountId = selectOrgUserId || ctx.oidc.session?.accountId || ctx.oidc.entities?.Account?.accountId;

         log.info({ 
            sessionAccountId,
            selectOrgUserId,
            hasSelectOrgResult: !!selectOrgResult
         }, 'auth-server:oidc-provider:extraTokenClaims - Resolved sessionAccountId (OIDC account identifier/userId)');

         if (sessionAccountId) {
            const authResult = await getStoredAuthResult(sessionAccountId);

            log.info({
               userId: sessionAccountId,
               hasAuthResult: !!authResult,
               hasOrganizationId: !!(authResult?.organizationId),
            }, 'auth-server:oidc-provider:extraTokenClaims - Retrieved stored auth result');

            if (authResult && authResult.organizationId) {
               const user = authResult.user;
               const claims: any = {
                  organization_id: authResult.organizationId,
                  ...(user?.name && { name: user.name }),
                  ...(user?.email && { email: user.email }),
               };

               log.info({
                  userId: sessionAccountId,
                  organization_id: authResult.organizationId,
               }, 'auth-server:oidc-provider:extraTokenClaims - Adding organization claims from stored auth result');

               return claims;
            } else {
               log.warn({ 
                  userId: sessionAccountId, 
                  hasAuthResult: !!authResult, 
                  hasOrganizationId: !!(authResult?.organizationId) 
               }, 'auth-server:oidc-provider:extraTokenClaims - No stored auth result or organizationId found, using fallback');
            }
         }

         // Fallback for client credentials or when no account is found
         const clientId = ctx.oidc.client?.clientId;
         if (clientId) {
            const clientMetadata = ctx.oidc.client?.metadata();
            const organizationId = clientMetadata?.organization_id;

            log.info({
               clientId,
               organizationId,
               flow: 'client_credentials'
            }, 'auth-server:oidc-provider:extraTokenClaims - Using client metadata as fallback');

            if (organizationId) {
               const allowedApps = normalizeAllowedAppsFromMetadata(clientMetadata as Record<string, unknown>);
               return {
                  organization_id: organizationId,
                  ...(allowedApps.length > 0 ? { allowed_apps: allowedApps } : {}),
               };
            }
         }

         log.warn({ sessionAccountId, clientId }, 'auth-server:oidc-provider:extraTokenClaims - No account or client found, no extra claims added');
         return {};
      },

      // Extra claims for ID tokens
      // Note: User claims (name, email, etc.) are handled by findAccount.claims()
      // This is only for additional non-user-specific metadata
      extraIdTokenClaims: async function(ctx) {
         // organization_id is already included in findAccount.claims(), so no need to duplicate
         return {};
      },

      expiresWithSession: async function(ctx, code) {
         const shouldExpire = !code.scopes.has('offline_access');
         log.debug('oidc-provider.expiresWithSession:', {
           route: ctx.oidc.route,
           scopes: [...code.scopes],
           shouldExpire,
           hasOfflineAccess: code.scopes.has('offline_access')
         });
         return shouldExpire;
       },

      // Grant revocation policy
      revokeGrantPolicy: function(ctx) {
         console.log("Revoke grant policy check");
         log.info({ 
            route: ctx.oidc.route,
            sessionId: ctx.oidc.session?.uid,
            accountId: ctx.oidc.session?.accountId
         }, '🔍 Revoke grant policy check');
         
         return true;
         
         if (ctx.oidc.route === 'end_session') {
            log.info({
               route: ctx.oidc.route,
               sessionId: ctx.oidc.session?.uid,
               accountId: ctx.oidc.session?.accountId
            }, '🔍 Revoking grants during logout');
            return true; // Revoke grants during logout
         }
         if (ctx.oidc.route === 'revocation') {
            log.info({
               route: ctx.oidc.route,
               sessionId: ctx.oidc.session?.uid,
               accountId: ctx.oidc.session?.accountId
            }, '🔍 Revoking grants during token revocation');
            return true; // Revoke grants during token revocation
         }
         return false;
      },

   };


   //
   // Create OIDC Provider with config from above
   //
   const provider = new Provider(ISSUER, config);
   provider.proxy = true;

   // Log configured redirect URIs for debugging
   const configuredRedirectUris = getAllRedirectUris();
   log.info({
      issuer: ISSUER,
      clientId: getClientId(),
      redirectUrisCount: configuredRedirectUris.length,
      redirectUris: configuredRedirectUris
   }, 'auth-server:oidc-provider - OIDC Provider created with redirect URIs');

   // Register custom grant type handler for token exchange (RFC 8693)
   log.debug({}, '🔧 REGISTERING CUSTOM GRANT TYPE: urn:ietf:params:oauth:grant-type:token-exchange');

   // Define parameters for token exchange grant type
   const parameters = [
      "audience",
      "resource",
      "scope",
      "requested_token_type",
      "subject_token",
      "subject_token_type",
      "actor_token",
      "actor_token_type",
   ];
   const allowedDuplicateParameters = ["audience", "resource"];
   const grantType = "urn:ietf:params:oauth:grant-type:token-exchange";

   // Debug: Check what grant types are supported
   log.debug('🔧 Supported grant types:', provider.grantTypes);

   async function tokenExchangeHandler(ctx, next) {
      log.debug({}, '🔍 CUSTOM GRANT HANDLER CALLED - Token exchange grant handler called');

      const grantType = ctx.oidc?.params?.grant_type;
      log.debug('🔍 Grant type from ctx.oidc.params:', grantType);

      if (grantType === 'urn:ietf:params:oauth:grant-type:token-exchange') {
         log.debug({}, '🔍 Processing token exchange request');

         // Now that we've registered the parameters, ctx.oidc.params should contain them
         const params = ctx.oidc.params || {};
         log.debug('🔍 OIDC params:', JSON.stringify(params, null, 2));
         log.debug({ keys: Object.keys(params) }, '🔍 Params keys');
         log.debug({ hasSubjectToken: !!params.subject_token }, '🔍 Has subject_token in params');
         log.debug('🔍 subject_token value from params:', params.subject_token);

         // Validate required parameters from parsed params
         const subjectToken = params.subject_token;
         const subjectTokenType = params.subject_token_type;

         log.debug('🔍 Extracted subjectToken:', subjectToken);
         log.debug('🔍 Extracted subjectTokenType:', subjectTokenType);

         if (!subjectToken) {
            log.debug({}, '❌ Missing subject_token parameter');
            throw new Error('Missing subject_token parameter');
         }

         if (!subjectTokenType) {
            log.debug({}, '❌ Missing subject_token_type parameter');
            throw new Error('Missing subject_token_type parameter');
         }

         log.debug({}, '✅ Parameters validated, delegating to token exchange service');

         // Delegate to our token exchange service
         const { TokenExchangeService } = await import('../services/token-exchange-service.js');

         const tokenExchangeService = new TokenExchangeService(provider);

         const request = {
            grant_type: params.grant_type,
            subject_token: subjectToken,
            subject_token_type: subjectTokenType,
            resource: params.resource,
            requested_token_type: params.requested_token_type,
            audience: params.audience,
            scope: params.scope
         };

         log.debug('🔍 Calling token exchange service with request:', JSON.stringify(request, null, 2));

         const result = await tokenExchangeService.exchangeToken(request);

         log.debug('🔍 Token exchange service result:', JSON.stringify(result, null, 2));

         if ('error' in result) {
            log.debug({ error: result.error, errorDescription: result.error_description }, '❌ Token exchange failed');
            throw new Error(result.error_description || result.error);
         }

         log.debug({}, '✅ Token exchange successful, setting response body');

         // Set the response body according to OIDC provider patterns
         ctx.body = {
            access_token: result.access_token,
            token_type: result.token_type,
            expires_in: result.expires_in,
            scope: result.scope,
            issued_token_type: result.issued_token_type
         };

         // Don't call next() when we successfully process the token exchange
         return;
      }

      log.debug('⚠️ Grant type mismatch, calling next(). Grant type was:', grantType);
      return next();
   }

   provider.registerGrantType(grantType, tokenExchangeHandler, parameters, allowedDuplicateParameters);


   // Debug: Check if provider has the expected methods
   log.debug({
      hasCallback: typeof provider.callback === 'function',
      issuer: provider.issuer,
      hasConfiguration: !!provider.configuration,
      hasRoutes: !!provider.routes,
      configurationKeys: Object.keys(provider.configuration || {})
   }, 'OIDC Provider Debug');


      // Register all provider event handlers
      registerOidcProviderEvents(provider);
      
      span.setAttributes({
         'oidc.provider_created': true,
         'oidc.issuer': provider.issuer,
         'oidc.has_callback': typeof provider.callback === 'function',
         'oidc.has_configuration': !!provider.configuration,
         'oidc.has_routes': !!provider.routes
      });
      span.setStatus({ code: SpanStatusCode.OK });
      
      return provider;
   });
}