/**
 * Static OIDC client configurations for the auth server.
 * Supports multiple applications (chat-ui, app-site, registry-cli, etc.)
 * and M2M clients (registry-import, capabilities-worker).
 */

/** Client ID for claims-manager frontend (Next.js app on port 5000). */
export const CLAIMS_MANAGER_UI_CLIENT_ID = 'claims-manager-ui';

/** Client ID for chat UI (Next.js app). */
export const CHAT_UI_CLIENT_ID = 'chat-ui';

/** Client ID for morezero app site. */
export const MOREZERO_APP_SITE_CLIENT_ID = 'morezero-app-site';

/** Client ID for mz CLI device-flow login; used to apply default app context when app_slug is missing. */
export const REGISTRY_CLI_CLIENT_ID = 'registry-cli';

/** M2M client for automated registry import in Docker compose (client_credentials grant). */
export const REGISTRY_IMPORT_CLIENT_ID = 'registry-import';

/** M2M client for capabilities-worker registration/heartbeat with registry (client_credentials grant). */
export const CAPABILITIES_WORKER_CLIENT_ID = 'capabilities-worker';

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

/**
 * Static OIDC clients used by the provider.
 * redirect_uris include primary callback URL per application.
 */
export const STATIC_CLIENTS: StaticClientConfig[] = [
   {
      client_id: CLAIMS_MANAGER_UI_CLIENT_ID,
      client_secret: 'cs_7f8a9b2c4d5e6f7g8h9i0j1k2l3m4n5o6p7q8r9s0t1u2v3w4x5y6z7a8b9c0d1e2f3g4h',
      redirect_uris: ['http://localhost:5000/api/auth/callback'],
      post_logout_redirect_uris: ['http://localhost:5000'],
      backchannel_logout_uri: 'http://localhost:5000/api/auth/backchannel_logout',
      backchannel_logout_session_required: true,
      grant_types: ['authorization_code', 'client_credentials', 'refresh_token'],
      response_types: ['code'],
      token_endpoint_auth_method: 'client_secret_basic',
      scope: 'openid profile email offline_access',
   },
   {
      client_id: CHAT_UI_CLIENT_ID,
      client_secret: 'cs_7f8a9b2c4d5e6f7g8h9i0j1k2l3m4n5o6p7q8r9s0t1u2v3w4x5y6z7a8b9c0d1e2f3g4h',
      redirect_uris: ['http://localhost:3203/api/auth/callback'],
      post_logout_redirect_uris: ['http://localhost:3203'],
      backchannel_logout_uri: 'http://localhost:3203/backchannel_logout',
      backchannel_logout_session_required: true,
      grant_types: ['authorization_code', 'client_credentials', 'refresh_token'],
      response_types: ['code'],
      token_endpoint_auth_method: 'client_secret_basic',
      scope: 'openid profile email offline_access registry:admin',
   },
   {
      client_id: MOREZERO_APP_SITE_CLIENT_ID,
      client_secret: 'cs_7f8a9b2c4d5e6f7g8h9i0j1k2l3m4n5o6p7q8r9s0t1u2v3w4x5y6z7a8b9c0d1e2f3g4h',
      redirect_uris: ['http://localhost:3207/api/auth/callback'],
      post_logout_redirect_uris: ['http://localhost:3207', 'http://localhost:3208'],
      backchannel_logout_uri: 'http://localhost:3207/api/auth/backchannel_logout',
      backchannel_logout_session_required: true,
      grant_types: ['authorization_code', 'client_credentials', 'refresh_token'],
      response_types: ['code'],
      token_endpoint_auth_method: 'client_secret_basic',
      scope: 'openid profile email offline_access',
   },
   {
      client_id: REGISTRY_CLI_CLIENT_ID,
      redirect_uris: ['http://localhost/callback'],
      grant_types: ['refresh_token', 'urn:ietf:params:oauth:grant-type:device_code'],
      response_types: [],
      token_endpoint_auth_method: 'none',
      scope: 'openid profile email offline_access registry:import registry:admin registry:read',
   },
   {
      client_id: REGISTRY_IMPORT_CLIENT_ID,
      client_secret: 'cs_reg_import_m2m_9a8b7c6d5e4f3g2h1i0j',
      redirect_uris: [],
      grant_types: ['client_credentials'],
      response_types: [],
      token_endpoint_auth_method: 'client_secret_basic',
      scope: 'registry:import registry:admin registry:read',
   },
   {
      client_id: CAPABILITIES_WORKER_CLIENT_ID,
      client_secret: 'cs_cap_worker_m2m_2h3i4j5k6l7m8n9o0p1q2r',
      redirect_uris: [],
      grant_types: ['client_credentials'],
      response_types: [],
      token_endpoint_auth_method: 'client_secret_basic',
      scope: 'registry:read registry:admin',
   },
];
