/**
 * Environment-driven OIDC client registry for the auth server.
 *
 * Client "templates" define stable identity (client_id, grant_types, scopes,
 * token_endpoint_auth_method). All per-environment values (redirect URIs,
 * post-logout URIs, backchannel URI, secret) are sourced from environment
 * variables via ./env-validation.ts.
 *
 * Localhost defaults are used ONLY when NODE_ENV !== 'production'. In
 * production, missing values for interactive clients throw at startup rather
 * than silently registering an empty redirect_uris list (which surfaces later
 * as the opaque `invalid_redirect_uri` error during /authorize).
 */

import {
   getAllRedirectUris,
   getClientId,
   getClientSecret,
   getPostLogoutRedirectUrl,
   isProduction,
} from './env-validation.js';

const LOG_PREFIX = 'auth-server:static-clients';

/** Client ID for claims-manager frontend (Next.js app on port 5000). */
export const CLAIMS_MANAGER_UI_CLIENT_ID = 'claims-manager-ui';

export interface StaticClientConfig {
   client_id: string;
   client_secret?: string;
   redirect_uris: string[];
   post_logout_redirect_uris?: string[];
   backchannel_logout_uri?: string;
   backchannel_logout_session_required?: boolean;
   grant_types: string[];
   response_types: string[];
   token_endpoint_auth_method: string;
   scope: string;
}

// ---------------------------------------------------------------------------
// Client templates: stable identity that does not change across environments
// ---------------------------------------------------------------------------

interface ClientTemplate {
   client_id: string;
   grant_types: string[];
   response_types: string[];
   token_endpoint_auth_method: string;
   scope: string;
   /** Whether a client_secret is required (false for public/device-flow clients). */
   requires_secret: boolean;
   /** Resolve redirect URIs from env. Return [] to trigger the production-missing check. */
   resolveRedirectUris: () => string[];
   /** Resolve post-logout URIs from env. Return undefined to omit the key. */
   resolvePostLogoutUris: () => string[] | undefined;
   /** Resolve backchannel logout URI from env. Return undefined to omit the key. */
   resolveBackchannelLogoutUri: () => string | undefined;
   backchannel_logout_session_required?: boolean;
   /** Localhost defaults used ONLY when NODE_ENV !== 'production'. */
   dev_defaults: {
      redirect_uris: string[];
      post_logout_redirect_uris?: string[];
      backchannel_logout_uri?: string;
   };
}

const CLIENT_TEMPLATES: ClientTemplate[] = [
   {
      client_id: CLAIMS_MANAGER_UI_CLIENT_ID,
      grant_types: ['authorization_code', 'client_credentials', 'refresh_token'],
      response_types: ['code'],
      token_endpoint_auth_method: 'client_secret_basic',
      scope: 'openid profile email offline_access',
      requires_secret: true,
      backchannel_logout_session_required: true,
      // In prod these come from OIDC_CLIENT_CALLBACK_URI + OIDC_ADDITIONAL_REDIRECT_URIS.
      resolveRedirectUris: () => {
         try {
            return getAllRedirectUris();
         } catch {
            return [];
         }
      },
      // Single post-logout URI from OIDC_POST_LOGOUT_URI.
      resolvePostLogoutUris: () => {
         try {
            return [getPostLogoutRedirectUrl()];
         } catch {
            return undefined;
         }
      },
      // Optional dedicated env var; if not set, derive from post-logout origin.
      resolveBackchannelLogoutUri: () => {
         const explicit = process.env.OIDC_BACKCHANNEL_LOGOUT_URI?.trim();
         if (explicit) return explicit;
         try {
            const origin = new URL(getPostLogoutRedirectUrl()).origin;
            return `${origin}/api/auth/backchannel_logout`;
         } catch {
            return undefined;
         }
      },
      dev_defaults: {
         redirect_uris: ['http://localhost:5000/api/auth/callback'],
         post_logout_redirect_uris: ['http://localhost:5000'],
         backchannel_logout_uri: 'http://localhost:5000/api/auth/backchannel_logout',
      },
   },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function resolveRedirectUris(template: ClientTemplate): string[] {
   const fromEnv = template.resolveRedirectUris();
   if (fromEnv.length > 0) {
      // Dedupe while preserving order.
      return Array.from(new Set(fromEnv));
   }

   const isInteractive = template.grant_types.includes('authorization_code');
   if (isProduction() && isInteractive) {
      throw new Error(
         `${LOG_PREFIX} - No redirect URIs configured for client '${template.client_id}' ` +
         `in production. Set OIDC_CLIENT_CALLBACK_URI (and optionally ` +
         `OIDC_ADDITIONAL_REDIRECT_URIS) via the environment.`
      );
   }

   return template.dev_defaults.redirect_uris;
}

function resolvePostLogoutUris(template: ClientTemplate): string[] | undefined {
   const fromEnv = template.resolvePostLogoutUris();
   if (fromEnv && fromEnv.length > 0) return fromEnv;

   if (!isProduction() && template.dev_defaults.post_logout_redirect_uris) {
      return template.dev_defaults.post_logout_redirect_uris;
   }

   return undefined;
}

function resolveBackchannelLogoutUri(template: ClientTemplate): string | undefined {
   const fromEnv = template.resolveBackchannelLogoutUri();
   if (fromEnv) return fromEnv;

   if (!isProduction()) return template.dev_defaults.backchannel_logout_uri;

   return undefined;
}

function resolveClientId(template: ClientTemplate): string {
   // OIDC_CLIENT_ID (from env-validation) overrides the template for the
   // primary claims-manager-ui client. Preserves the existing env contract.
   if (template.client_id === CLAIMS_MANAGER_UI_CLIENT_ID) {
      try {
         return getClientId();
      } catch {
         return template.client_id;
      }
   }
   return template.client_id;
}

function resolveClientSecret(template: ClientTemplate, clientId: string): string | undefined {
   if (!template.requires_secret) return undefined;

   try {
      return getClientSecret();
   } catch (err: any) {
      if (isProduction()) {
         throw new Error(
            `${LOG_PREFIX} - OIDC_CLIENT_SECRET is required for client '${clientId}' ` +
            `in production (${err.message}).`
         );
      }
      const devDefault = `dev-only-${clientId}-secret-replace-me`;
      console.warn(
         `${LOG_PREFIX}:resolveClientSecret - OIDC_CLIENT_SECRET not set, using insecure dev default for client '${clientId}'`
      );
      return devDefault;
   }
}

function buildClientFromTemplate(template: ClientTemplate): StaticClientConfig {
   const clientId = resolveClientId(template);

   const config: StaticClientConfig = {
      client_id: clientId,
      redirect_uris: resolveRedirectUris(template),
      grant_types: template.grant_types,
      response_types: template.response_types,
      token_endpoint_auth_method: template.token_endpoint_auth_method,
      scope: template.scope,
   };

   const secret = resolveClientSecret(template, clientId);
   if (secret) config.client_secret = secret;

   const postLogout = resolvePostLogoutUris(template);
   if (postLogout && postLogout.length > 0) {
      config.post_logout_redirect_uris = postLogout;
   }

   const backchannelUri = resolveBackchannelLogoutUri(template);
   if (backchannelUri) {
      config.backchannel_logout_uri = backchannelUri;
      if (template.backchannel_logout_session_required) {
         config.backchannel_logout_session_required = true;
      }
   }

   return config;
}

// ---------------------------------------------------------------------------
// Builder
// ---------------------------------------------------------------------------

/** Build the full static client list from templates + environment. */
export function buildStaticClients(): StaticClientConfig[] {
   const clients = CLIENT_TEMPLATES.map(buildClientFromTemplate);
   console.info(
      {
         clientCount: clients.length,
         clients: clients.map(c => ({
            client_id: c.client_id,
            redirect_uris: c.redirect_uris,
            post_logout_redirect_uris: c.post_logout_redirect_uris,
         })),
      },
      `${LOG_PREFIX}:buildStaticClients - Static OIDC clients built from environment`
   );
   return clients;
}

let _staticClients: StaticClientConfig[] | null = null;

/**
 * Lazily-built client list. Deferred so that dotenv has loaded before
 * environment variables are read. First call builds and caches; subsequent
 * calls return the cached result.
 */
export function getStaticClients(): StaticClientConfig[] {
   if (!_staticClients) {
      _staticClients = buildStaticClients();
   }
   return _staticClients;
}

/** Reset the cached client list (intended for tests). */
export function resetStaticClientsCache(): void {
   _staticClients = null;
}
