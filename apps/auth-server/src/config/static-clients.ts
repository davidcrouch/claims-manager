/**
 * Static OIDC client configurations for the auth server.
 * Claims-manager frontend is the only pre-registered client.
 */

/** Client ID for claims-manager frontend (Next.js app on port 5000). */
export const CLAIMS_MANAGER_UI_CLIENT_ID = 'claims-manager-ui';

/** Client secret for claims-manager frontend (Next.js app on port 5000). */
export const CLAIMS_MANAGER_UI_CLIENT_SECRET = 'cs_7f8a9b2c4d5e6f7g8h9i0j1k2l3m4n5o6p7q8r9s0t1u2v3w4x5y6z7a8b9c0d1e2f3g4h';

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
      client_secret: CLAIMS_MANAGER_UI_CLIENT_SECRET,
      redirect_uris: ['http://localhost:5000/api/auth/callback'],
      post_logout_redirect_uris: ['http://localhost:5000'],
      backchannel_logout_uri: 'http://localhost:5000/api/auth/backchannel_logout',
      backchannel_logout_session_required: true,
      grant_types: ['authorization_code', 'client_credentials', 'refresh_token'],
      response_types: ['code'],
      token_endpoint_auth_method: 'client_secret_basic',
      scope: 'openid profile email offline_access',
   },
];
