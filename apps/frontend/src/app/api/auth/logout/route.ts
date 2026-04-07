import { NextRequest, NextResponse } from 'next/server';
import { authConfig } from '@/lib/auth-config';

const cookieOptions = {
  path: '/',
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  maxAge: 0,
};

export async function GET(req: NextRequest) {
  const idTokenHint = req.cookies.get(
    authConfig.cookieNames.oidcIdToken,
  )?.value;
  const params: Record<string, string> = {
    client_id: authConfig.oidcClientId,
    post_logout_redirect_uri: authConfig.oidcPostLogoutUri,
  };
  if (idTokenHint) {
    params.id_token_hint = idTokenHint;
  }
  const res = NextResponse.redirect(
    `${authConfig.authServerUrl}/session/end?${new URLSearchParams(params).toString()}`,
  );
  res.cookies.set(authConfig.cookieNames.authToken, '', cookieOptions);
  res.cookies.set(authConfig.cookieNames.oidcIdToken, '', cookieOptions);
  return res;
}
