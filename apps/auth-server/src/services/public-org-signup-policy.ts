/**
 * Public organisation signup policy.
 *
 * Greenfield "create a new organisation" is allowed only while no organisations
 * exist (bootstrap the first tenant). After that, new users join via invite.
 *
 * Optional override: ALLOW_PUBLIC_ORG_SIGNUP=true|false
 *   - true  → always allow (testing / exceptional recovery)
 *   - false → always deny (even on an empty database)
 *   - unset → allow only when organisation count is 0
 */

import { sql } from 'drizzle-orm';
import { createLogger, LoggerType } from '../lib/logger.js';
import { getDb, resetDb } from '../db/client.js';
import { organizations } from '../db/schema.js';

const log = createLogger(
  'auth-server:services:public-org-signup-policy',
  LoggerType.NODEJS,
);

export const PUBLIC_ORG_SIGNUP_DISABLED_MESSAGE =
  'New organisation signup is closed. Please ask an administrator for an invitation.';

export const PUBLIC_ORG_SIGNUP_DISABLED_CODE = 'PUBLIC_ORG_SIGNUP_DISABLED' as const;

export class PublicOrgSignupDisabledError extends Error {
  readonly code = PUBLIC_ORG_SIGNUP_DISABLED_CODE;

  constructor(message = PUBLIC_ORG_SIGNUP_DISABLED_MESSAGE) {
    super(message);
    this.name = 'PublicOrgSignupDisabledError';
  }
}

function parseForceOverride(): boolean | null {
  const raw = (process.env.ALLOW_PUBLIC_ORG_SIGNUP ?? '').trim().toLowerCase();
  if (raw === 'true' || raw === '1') return true;
  if (raw === 'false' || raw === '0') return false;
  return null;
}

function isRetryableConnectionError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const code = 'code' in err ? String((err as { code: unknown }).code) : '';
  const message = err instanceof Error ? err.message : String(err);
  return (
    code === 'ECONNRESET' ||
    code === 'ECONNREFUSED' ||
    code === 'ETIMEDOUT' ||
    code === 'CONNECTION_CLOSED' ||
    message.includes('ECONNRESET')
  );
}

/** Count of organisations in the shared claims_manager database. */
export async function countOrganizations(): Promise<number> {
  const run = async () => {
    const db = getDb();
    const [row] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(organizations);
    return Number(row?.count ?? 0);
  };

  try {
    return await run();
  } catch (err) {
    if (!isRetryableConnectionError(err)) throw err;
    log.warn(
      {
        functionName: 'countOrganizations',
        error: err instanceof Error ? err.message : String(err),
      },
      'auth-server:services:public-org-signup-policy:countOrganizations - connection error, resetting client and retrying',
    );
    await resetDb('countOrganizations connection error');
    return run();
  }
}

/**
 * Whether creating a brand-new organisation via public signup is allowed.
 * Joining an existing organisation (invite / organizationId) is unaffected.
 */
export async function isPublicOrgSignupAllowed(): Promise<boolean> {
  const force = parseForceOverride();
  if (force !== null) {
    log.info(
      { functionName: 'isPublicOrgSignupAllowed', force },
      'auth-server:services:public-org-signup-policy:isPublicOrgSignupAllowed - Using ALLOW_PUBLIC_ORG_SIGNUP override',
    );
    return force;
  }

  const count = await countOrganizations();
  const allowed = count === 0;
  log.debug(
    { functionName: 'isPublicOrgSignupAllowed', organizationCount: count, allowed },
    'auth-server:services:public-org-signup-policy:isPublicOrgSignupAllowed - Evaluated org-count gate',
  );
  return allowed;
}

/**
 * Throw if a new organisation would be created while public signup is closed.
 * Intended for use inside the signup transaction (re-checks under the same tx).
 */
export async function assertPublicOrgSignupAllowed(
  countFn: () => Promise<number> = countOrganizations,
): Promise<void> {
  const force = parseForceOverride();
  if (force === true) return;
  if (force === false) {
    throw new PublicOrgSignupDisabledError();
  }
  const count = await countFn();
  if (count > 0) {
    throw new PublicOrgSignupDisabledError();
  }
}
