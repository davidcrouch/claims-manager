/**
 * OIDC auth config for claims-manager frontend.
 * Loaded from env (server-side only; do not expose secrets to client).
 */

const AUTH_SERVER_URL = process.env.AUTH_SERVER_URL || 'http://localhost:3280';
const OIDC_ISSUER = process.env.OIDC_ISSUER || AUTH_SERVER_URL;
const OIDC_CLIENT_ID = process.env.OIDC_CLIENT_ID || 'claims-manager-ui';
const OIDC_CLIENT_SECRET = process.env.OIDC_CLIENT_SECRET || '';
const OIDC_REDIRECT_URI =
  process.env.OIDC_REDIRECT_URI || 'http://localhost:5000/api/auth/callback';
const OIDC_POST_LOGIN_URI =
  process.env.OIDC_POST_LOGIN_URI || 'http://localhost:5000/dashboard';
const OIDC_POST_LOGOUT_URI =
  process.env.OIDC_POST_LOGOUT_URI || 'http://localhost:5000';
const OIDC_COOKIE_SECRET =
  process.env.OIDC_COOKIE_SECRET ||
  '0000000000000000000000000000000000000000000000000000000000000000';
const OIDC_SCOPES = (process.env.OIDC_SCOPES || 'openid,profile,email')
  .split(',')
  .map((s) => s.trim());
const OIDC_AUDIENCE = process.env.OIDC_AUDIENCE || OIDC_POST_LOGIN_URI;
const OIDC_ACCEPTED_AUDIENCES = process.env.OIDC_ACCEPTED_AUDIENCES
  ? process.env.OIDC_ACCEPTED_AUDIENCES.split(',')
      .map((s) => s.trim())
      .filter(Boolean)
  : [];

export const authConfig = {
  authServerUrl: AUTH_SERVER_URL,
  oidcIssuer: OIDC_ISSUER,
  oidcClientId: OIDC_CLIENT_ID,
  oidcClientSecret: OIDC_CLIENT_SECRET,
  oidcRedirectUri: OIDC_REDIRECT_URI,
  oidcPostLoginUri: OIDC_POST_LOGIN_URI,
  oidcPostLogoutUri: OIDC_POST_LOGOUT_URI,
  oidcCookieSecret: OIDC_COOKIE_SECRET,
  oidcScopes: OIDC_SCOPES,
  oidcAudience: OIDC_AUDIENCE,
  oidcAcceptedAudiences: OIDC_ACCEPTED_AUDIENCES,
  get oidcAcceptedJwtAudiences() {
    return [
      OIDC_CLIENT_ID,
      OIDC_AUDIENCE,
      OIDC_ISSUER,
      ...OIDC_ACCEPTED_AUDIENCES,
    ].filter(Boolean);
  },
  appSlug: process.env.MORE0_APP_SLUG || 'claims-manager',
  cookieNames: {
    authToken: 'cm_auth_token',
    oidcIdToken: 'cm_oidc_id_token',
    oidcState: 'cm_oidc_state',
    oidcVerifier: 'cm_oidc_verifier',
    oidcRedirectUri: 'cm_oidc_redirect_uri',
  },
  cookieMaxAge: 86400,
  stateCookieMaxAge: 600,
} as const;
