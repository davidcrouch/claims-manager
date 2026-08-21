import { NextRequest, NextResponse } from 'next/server';
import { authConfig } from '@/lib/auth-config';
import { verifyCookie } from '@/lib/auth-cookies';
import { getApiBaseUrl } from '@/lib/env';
import { cloudRunInvokerHeaders } from '@/lib/cloud-run-id-token';

const LOG_PREFIX = 'frontend:api:auth:callback';

const POST_LOGIN_REDIRECT_COOKIE = 'post_login_redirect_url';

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split('.');
    if (parts.length < 2 || !parts[1]) return null;
    return JSON.parse(
      Buffer.from(parts[1], 'base64url').toString('utf8'),
    ) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/** After login: ensure a contact exists for this user (non-fatal). */
async function ensureUserContactOnLogin(accessToken: string): Promise<void> {
  const payload = decodeJwtPayload(accessToken);
  const tenantId =
    (typeof payload?.organization_id === 'string'
      ? payload.organization_id
      : '') ||
    process.env.NEXT_PUBLIC_DEFAULT_TENANT_ID ||
    '';

  try {
    const res = await fetch(`${getApiBaseUrl()}/contacts/ensure-me`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        ...(tenantId ? { 'x-tenant-id': tenantId } : {}),
        ...(await cloudRunInvokerHeaders()),
      },
      body: '{}',
      signal: AbortSignal.timeout(8_000),
      cache: 'no-store',
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      console.warn(`${LOG_PREFIX} - ensure-me failed`, {
        status: res.status,
        body: text.slice(0, 300),
      });
      return;
    }
    console.info(`${LOG_PREFIX} - ensure-me ok`);
  } catch (err) {
    console.warn(`${LOG_PREFIX} - ensure-me error`, {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const errorParam = url.searchParams.get('error');
  if (errorParam) {
    const desc = url.searchParams.get('error_description') ?? errorParam;
    console.warn(`${LOG_PREFIX} - OIDC error`, { error: errorParam, description: desc });
    return NextResponse.redirect(
      `${authConfig.oidcPostLogoutUri}/?error=${encodeURIComponent(desc)}`,
    );
  }

  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  if (!code || !state) {
    return NextResponse.redirect(
      `${authConfig.oidcPostLogoutUri}/?error=${encodeURIComponent('Missing code or state')}`,
    );
  }

  const stateCookie = req.cookies.get(authConfig.cookieNames.oidcState)?.value;
  const verifierCookie = req.cookies.get(
    authConfig.cookieNames.oidcVerifier,
  )?.value;
  const redirectUriCookie = req.cookies.get(
    authConfig.cookieNames.oidcRedirectUri,
  )?.value;
  const savedState = stateCookie
    ? verifyCookie(stateCookie, authConfig.oidcCookieSecret)
    : null;
  const verifier = verifierCookie
    ? verifyCookie(verifierCookie, authConfig.oidcCookieSecret)
    : null;
  const redirectUri = redirectUriCookie
    ? verifyCookie(redirectUriCookie, authConfig.oidcCookieSecret)
    : null;

  if (!savedState || savedState !== state || !verifier) {
    console.warn(`${LOG_PREFIX} - state/verifier mismatch or missing`);
    return NextResponse.redirect(
      `${authConfig.oidcPostLogoutUri}/?error=${encodeURIComponent('Invalid state')}`,
    );
  }

  const effectiveRedirectUri = redirectUri ?? authConfig.oidcRedirectUri;
  console.debug(`${LOG_PREFIX} - exchanging code`, {
    redirect_uri: effectiveRedirectUri,
  });

  const tokenUrl = `${authConfig.authServerUrl}/token`;
  const bodyParams: Record<string, string> = {
    grant_type: 'authorization_code',
    code,
    redirect_uri: effectiveRedirectUri,
    code_verifier: verifier,
  };
  if (authConfig.oidcAudience) {
    bodyParams.resource = authConfig.oidcAudience;
    bodyParams.audience = authConfig.oidcAudience;
  }

  const body = new URLSearchParams(bodyParams);
  // RFC 6749 §2.3.1: the client_id and client_secret MUST be
  // application/x-www-form-urlencoded before being joined with ':' and
  // base64-encoded. node-oidc-provider URL-decodes the two halves on
  // receipt, so without this step any '+' or '/' in a base64 secret turns
  // into a space (or similar) server-side and authentication fails with
  // invalid_client.
  const basicAuth = Buffer.from(
    `${encodeURIComponent(authConfig.oidcClientId)}:${encodeURIComponent(
      authConfig.oidcClientSecret,
    )}`,
    'utf8',
  ).toString('base64');

  let tokenRes: Response;
  try {
    // Fail fast: a hung exchange (e.g. overloaded Next dev server) used to
    // wait ~80s and burn the auth code before /token ran.
    tokenRes = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${basicAuth}`,
        'x-more0-app-slug': authConfig.appSlug,
      },
      body: body.toString(),
      signal: AbortSignal.timeout(15_000),
    });
  } catch (err) {
    console.error(`${LOG_PREFIX} - token exchange request failed`, {
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.redirect(
      `${authConfig.oidcPostLogoutUri}/?error=${encodeURIComponent('Token exchange failed')}`,
    );
  }

  if (!tokenRes.ok) {
    const text = await tokenRes.text();
    console.error(`${LOG_PREFIX} - token exchange error`, {
      status: tokenRes.status,
      body: text,
    });
    return NextResponse.redirect(
      `${authConfig.oidcPostLogoutUri}/?error=${encodeURIComponent('Token exchange failed')}`,
    );
  }

  const tokenData = (await tokenRes.json()) as {
    access_token?: string;
    id_token?: string;
  };
  const accessToken = tokenData.access_token;

  if (!accessToken) {
    console.error(`${LOG_PREFIX} - no access_token in response`);
    return NextResponse.redirect(
      `${authConfig.oidcPostLogoutUri}/?error=${encodeURIComponent('No access token')}`,
    );
  }

  // Ensure org contact for this user before they land in the app.
  await ensureUserContactOnLogin(accessToken);

  const postLoginRedirect =
    req.cookies.get(POST_LOGIN_REDIRECT_COOKIE)?.value?.trim() || '';
  // Ignore auth entrypoints / loops (e.g. stale returnTo=/login from older redirects).
  const safePostLoginRedirect =
    postLoginRedirect.startsWith('/') &&
    !postLoginRedirect.startsWith('//') &&
    postLoginRedirect !== '/login' &&
    !postLoginRedirect.startsWith('/api/auth')
      ? postLoginRedirect
      : null;
  const redirectTo = safePostLoginRedirect
    ? new URL(safePostLoginRedirect, authConfig.oidcPostLoginUri).href
    : authConfig.oidcPostLoginUri;

  const res = NextResponse.redirect(redirectTo);
  res.cookies.set(authConfig.cookieNames.authToken, accessToken, {
    path: '/',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: authConfig.cookieMaxAge,
  });
  if (tokenData.id_token) {
    res.cookies.set(authConfig.cookieNames.oidcIdToken, tokenData.id_token, {
      path: '/',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: authConfig.cookieMaxAge,
    });
  }
  res.cookies.delete(authConfig.cookieNames.oidcState);
  res.cookies.delete(authConfig.cookieNames.oidcVerifier);
  res.cookies.delete(authConfig.cookieNames.oidcRedirectUri);
  res.cookies.delete(POST_LOGIN_REDIRECT_COOKIE);

  return res;
}
