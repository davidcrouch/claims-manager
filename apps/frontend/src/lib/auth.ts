/**
 * Server-side auth utilities for claims-manager frontend.
 * Uses OIDC auth-server JWTs verified via JWKS.
 * Do not import from client components.
 */

import 'server-only';
import { cookies } from 'next/headers';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import type { NextRequest } from 'next/server';
import { authConfig } from '@/lib/auth-config';

const LOG_PREFIX = 'frontend:lib:auth';

const JWKS_URL = `${authConfig.oidcIssuer}/jwks`;
const JWKS = createRemoteJWKSet(new URL(JWKS_URL));
const ISSUER = authConfig.oidcIssuer;
const AUDIENCES = authConfig.oidcAcceptedJwtAudiences;

export interface AuthIdentity {
  sub: string;
  email?: string;
  name?: string;
  given_name?: string;
  family_name?: string;
  picture?: string;
  organization_id?: string;
  is_machine?: boolean;
  is_admin?: boolean;
  roles?: string[];
}

export interface Session {
  authenticated: boolean;
  identity: AuthIdentity | null;
}

function payloadToIdentity(payload: Record<string, unknown>): AuthIdentity {
  return {
    sub: payload.sub as string,
    email: payload.email as string | undefined,
    name: (payload.name ?? payload.preferred_username) as string | undefined,
    given_name: payload.given_name as string | undefined,
    family_name: payload.family_name as string | undefined,
    picture: payload.picture as string | undefined,
    organization_id: payload.organization_id as string | undefined,
    is_machine: payload.is_machine as boolean | undefined,
    is_admin: payload.is_admin as boolean | undefined,
    roles: payload.roles as string[] | undefined,
  };
}

async function verifyToken(token: string): Promise<AuthIdentity | null> {
  try {
    const { payload } = await jwtVerify(token, JWKS, {
      issuer: ISSUER,
      audience: AUDIENCES,
    });
    return payloadToIdentity(payload as Record<string, unknown>);
  } catch (err) {
    console.warn(
      `${LOG_PREFIX}:verifyToken - JWT verification failed:`,
      err instanceof Error ? err.message : String(err),
    );
    return null;
  }
}

function isJWTStructurallyValid(token: string): boolean {
  const parts = token.split('.');
  if (parts.length !== 3) return false;
  try {
    const payload = JSON.parse(
      Buffer.from(parts[1]!, 'base64url').toString('utf8'),
    ) as { exp?: number };
    return !(
      payload.exp != null &&
      payload.exp > 0 &&
      Date.now() / 1000 > payload.exp
    );
  } catch {
    return false;
  }
}

/**
 * Get session from Next.js cookies (Server Components, Server Actions).
 */
export async function getSession(): Promise<Session> {
  const cookieStore = await cookies();
  const token = cookieStore.get(authConfig.cookieNames.authToken)?.value;

  if (!token || !isJWTStructurallyValid(token)) {
    return { authenticated: false, identity: null };
  }

  const identity = await verifyToken(token);
  return {
    authenticated: !!identity,
    identity,
  };
}

/**
 * Get session from a Request (Route Handlers).
 */
export async function getSessionFromRequest(
  req: Request | NextRequest,
): Promise<Session> {
  const reqCookies = 'cookies' in req ? req.cookies : null;
  const token =
    reqCookies?.get(authConfig.cookieNames.authToken)?.value ??
    req.headers
      .get('authorization')
      ?.replace(/^Bearer\s+/i, '')
      .trim();

  if (!token || !isJWTStructurallyValid(token)) {
    return { authenticated: false, identity: null };
  }

  const identity = await verifyToken(token);
  return {
    authenticated: !!identity,
    identity,
  };
}

/**
 * Get the raw access token from cookies.
 */
export async function getAccessToken(): Promise<string | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(authConfig.cookieNames.authToken)?.value;

  if (!token || !isJWTStructurallyValid(token)) {
    return null;
  }
  return token;
}
