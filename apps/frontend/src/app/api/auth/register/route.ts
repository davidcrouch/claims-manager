import { NextRequest, NextResponse } from 'next/server';
import { randomBytes, createHash } from 'node:crypto';
import { authConfig } from '@/lib/auth-config';
import { signCookie } from '@/lib/auth-cookies';

const LOG_PREFIX = 'frontend:api:auth:register';

const POST_LOGIN_REDIRECT_COOKIE = 'post_login_redirect_url';

function randomBase64Url(len: number): string {
  return randomBytes(len).toString('base64url');
}

function s256Challenge(verifier: string): string {
  return createHash('sha256').update(verifier, 'utf8').digest('base64url');
}

function setCookie(
  name: string,
  value: string,
  maxAge: number,
  res: NextResponse,
) {
  res.cookies.set(name, value, {
    path: '/',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge,
  });
}

function resolveRedirectUri(req: NextRequest): string {
  const host =
    req.headers.get('x-forwarded-host') ?? req.headers.get('host') ?? '';
  if (!host) return authConfig.oidcRedirectUri;
  const scheme =
    req.headers.get('x-forwarded-proto') ??
    (req.url.startsWith('https') ? 'https' : 'http');
  return `${scheme}://${host}/api/auth/callback`;
}

export async function GET(req: NextRequest) {
  try {
    const interaction = req.nextUrl.searchParams.get('interaction');
    if (interaction) {
      const registerUrl = `${authConfig.authServerUrl}/register?interaction=${encodeURIComponent(interaction)}`;
      console.debug(`${LOG_PREFIX} - redirecting to provider register`, {
        interaction,
      });
      return NextResponse.redirect(registerUrl);
    }

    const returnTo = req.nextUrl.searchParams.get('returnTo')?.trim();
    const safeReturnTo =
      returnTo &&
      returnTo.startsWith('/') &&
      !returnTo.startsWith('//') &&
      !returnTo.startsWith('/.well-known')
        ? returnTo
        : null;

    const state = randomBase64Url(32);
    const verifier = randomBase64Url(64);
    const challenge = s256Challenge(verifier);
    const redirectUri = resolveRedirectUri(req);

    const params: Record<string, string> = {
      response_type: 'code',
      client_id: authConfig.oidcClientId,
      redirect_uri: redirectUri,
      scope: authConfig.oidcScopes.join(' '),
      state,
      code_challenge: challenge,
      code_challenge_method: 'S256',
      app_slug: authConfig.appSlug,
      prompt: 'register',
    };
    if (authConfig.oidcAudience) {
      params.resource = authConfig.oidcAudience;
      params.audience = authConfig.oidcAudience;
    }

    console.info(`${LOG_PREFIX} - redirecting to authorize`, {
      redirect_uri: redirectUri,
      audience: params.audience,
      prompt: params.prompt,
    });

    const res = NextResponse.redirect(
      `${authConfig.authServerUrl}/authorize?${new URLSearchParams(params).toString()}`,
    );

    setCookie(
      authConfig.cookieNames.oidcState,
      signCookie(state, authConfig.oidcCookieSecret),
      authConfig.stateCookieMaxAge,
      res,
    );
    setCookie(
      authConfig.cookieNames.oidcVerifier,
      signCookie(verifier, authConfig.oidcCookieSecret),
      authConfig.stateCookieMaxAge,
      res,
    );
    setCookie(
      authConfig.cookieNames.oidcRedirectUri,
      signCookie(redirectUri, authConfig.oidcCookieSecret),
      authConfig.stateCookieMaxAge,
      res,
    );

    if (safeReturnTo) {
      res.cookies.set(POST_LOGIN_REDIRECT_COOKIE, safeReturnTo, {
        path: '/',
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: authConfig.stateCookieMaxAge,
      });
    }

    return res;
  } catch (error) {
    console.error(`${LOG_PREFIX} - register redirect failed`, {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Registration failed' }, { status: 500 });
  }
}
