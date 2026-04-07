import { NextRequest, NextResponse } from 'next/server';
import { authConfig } from '@/lib/auth-config';

const LOG_PREFIX = 'frontend:api:auth:session';

function isJWTStructurallyValid(token: string): boolean {
  const parts = token.split('.');
  if (parts.length !== 3) return false;
  try {
    const payload = JSON.parse(
      Buffer.from(parts[1]!, 'base64url').toString('utf8'),
    ) as { exp?: number };
    if (
      payload.exp != null &&
      payload.exp > 0 &&
      Date.now() / 1000 > payload.exp
    ) {
      console.debug(`${LOG_PREFIX} - token expired`, { exp: payload.exp });
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

export async function GET(req: NextRequest) {
  const res = NextResponse.json({ authenticated: false });
  res.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.headers.set('Pragma', 'no-cache');
  res.headers.set('Expires', '0');

  const token = req.cookies.get(authConfig.cookieNames.authToken)?.value;

  if (!token || token.length === 0) {
    return res;
  }

  if (!isJWTStructurallyValid(token)) {
    res.cookies.set(authConfig.cookieNames.authToken, '', {
      path: '/',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: -1,
    });
    return res;
  }

  const ok = NextResponse.json({ authenticated: true });
  ok.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
  ok.headers.set('Pragma', 'no-cache');
  ok.headers.set('Expires', '0');
  return ok;
}
