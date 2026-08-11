import { NextRequest, NextResponse } from 'next/server';
import { authConfig } from '@/lib/auth-config';

const AUTH_COOKIE = authConfig.cookieNames.authToken;

const PUBLIC_API_PREFIXES = ['/api/auth', '/api/health', '/api/webhook'];
function isPublicApi(pathname: string): boolean {
  return PUBLIC_API_PREFIXES.some((p) => pathname.startsWith(p));
}

/** Server Actions / RSC mutations are POST; redirecting them to login yields 405. */
function isNonNavigationalRequest(req: NextRequest): boolean {
  if (req.headers.has('next-action')) return true;
  const method = req.method.toUpperCase();
  return method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS';
}

function unauthorizedJson() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

/**
 * Keep this file as middleware.ts (not proxy.ts). Next 16.2 Turbopack 404s
 * valid app routes when src/proxy.ts is present (vercel/next.js#92921).
 */
export function middleware(req: NextRequest) {
  const pathname = req.nextUrl.pathname;
  const hasAuthCookie = !!req.cookies.get(AUTH_COOKIE)?.value;

  if (pathname.startsWith('/api/')) {
    if (isPublicApi(pathname)) return NextResponse.next();
    if (!hasAuthCookie) {
      return unauthorizedJson();
    }
    return NextResponse.next();
  }

  if (pathname === '/' || pathname.startsWith('/.well-known'))
    return NextResponse.next();

  // Legacy / mistaken /login links (auth-server used to send users here).
  if (pathname === '/login') {
    if (isNonNavigationalRequest(req)) {
      return unauthorizedJson();
    }
    const loginUrl = new URL('/api/auth/login', req.url);
    req.nextUrl.searchParams.forEach((value, key) => {
      loginUrl.searchParams.set(key, value);
    });
    return NextResponse.redirect(loginUrl);
  }

  if (!hasAuthCookie) {
    // Browser navigations: send to OIDC. Server Actions must not follow this redirect.
    if (isNonNavigationalRequest(req)) {
      return unauthorizedJson();
    }
    const loginUrl = new URL('/api/auth/login', req.url);
    loginUrl.searchParams.set('returnTo', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  // Exclude /api from the matcher: Next 16.2 Turbopack 404s App Router
  // route handlers when middleware/proxy matches them (vercel/next.js#92921).
  // Public and cookie-gated /api handlers enforce auth themselves where needed.
  matcher: [
    '/((?!api|_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
  ],
};
