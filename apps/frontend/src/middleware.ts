import { NextRequest, NextResponse } from 'next/server';
import { authConfig } from '@/lib/auth-config';

const AUTH_COOKIE = authConfig.cookieNames.authToken;

const PUBLIC_API_PREFIXES = ['/api/auth', '/api/health', '/api/webhook'];
function isPublicApi(pathname: string): boolean {
  return PUBLIC_API_PREFIXES.some((p) => pathname.startsWith(p));
}

export function middleware(req: NextRequest) {
  const pathname = req.nextUrl.pathname;
  const hasAuthCookie = !!req.cookies.get(AUTH_COOKIE)?.value;

  if (pathname.startsWith('/api/')) {
    if (isPublicApi(pathname)) return NextResponse.next();
    if (!hasAuthCookie) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.next();
  }

  if (pathname === '/') return NextResponse.next();

  if (!hasAuthCookie) {
    const loginUrl = new URL('/api/auth/login', req.url);
    loginUrl.searchParams.set('returnTo', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
  ],
};
