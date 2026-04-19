import { NextRequest, NextResponse } from 'next/server';
import { authConfig } from '@/lib/auth-config';
import { verifyCookie } from '@/lib/auth-cookies';

const LOG_PREFIX = 'frontend:api:auth:callback';

const POST_LOGIN_REDIRECT_COOKIE = 'post_login_redirect_url';

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
    tokenRes = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${basicAuth}`,
        'x-more0-app-slug': authConfig.appSlug,
      },
      body: body.toString(),
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

  const postLoginRedirect =
    req.cookies.get(POST_LOGIN_REDIRECT_COOKIE)?.value?.trim() || '';
  const redirectTo =
    postLoginRedirect.startsWith('/') && !postLoginRedirect.startsWith('//')
      ? new URL(postLoginRedirect, authConfig.oidcPostLoginUri).href
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
