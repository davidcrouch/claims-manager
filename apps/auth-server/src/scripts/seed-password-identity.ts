/**
 * Seed Script: Add password identity for an existing user (e.g. admin)
 *
 * Login requires a user_identities row with provider='password' and
 * provider_subject=email. Users that exist only in the users table
 * (e.g. from seed) have no password identity, so login fails until one is created.
 *
 * Usage:
 *   Set ADMIN_EMAIL and ADMIN_PASSWORD, then from repo root:
 *   pnpm tsx apps/auth-server/src/scripts/seed-password-identity.ts [--dry-run]
 *
 *   Or with env file:
 *   ADMIN_EMAIL=admin@more0.ai ADMIN_PASSWORD=yourpassword pnpm tsx apps/auth-server/src/scripts/seed-password-identity.ts
 *
 * Options:
 *   --dry-run    Preview without inserting
 */

import 'dotenv/config';
import * as bcrypt from 'bcrypt';
import { createLogger, LoggerType } from '../lib/logger.js';
import { getDb } from '../db/client.js';
import { createUsersRepository } from '../db/repositories/users-repository.js';
import { createUserIdentitiesRepository } from '../db/repositories/user-identities-repository.js';
import type { AccessContext } from '../schemas/index.js';

const log = createLogger('auth-server:scripts:seed-password-identity', LoggerType.NODEJS);

const BCRYPT_SALT_ROUNDS = 12;

function getRequiredEnv(name: string): string {
  const v = process.env[name];
  if (!v?.trim()) {
    log.error({ envVar: name }, 'auth-server:scripts:seed-password-identity - Required env not set');
    throw new Error(`Required environment variable ${name} is not set`);
  }
  return v.trim();
}

async function seedPasswordIdentity(params: { dryRun: boolean }): Promise<{ created: boolean; identityId?: string }> {
  const { dryRun } = params;
  const email = getRequiredEnv('ADMIN_EMAIL');
  const password = getRequiredEnv('ADMIN_PASSWORD');

  log.info(
    { email, dryRun },
    'auth-server:scripts:seed-password-identity - Seeding password identity for existing user'
  );

  const db = getDb();
  const usersRepo = createUsersRepository(() => db, undefined);
  const userIdentitiesRepo = createUserIdentitiesRepository(() => db, undefined);
  const systemContext: AccessContext = { organizationId: 'public', userId: '00000000-0000-0000-0000-000000000000' };

  const user = await usersRepo.getByEmail(systemContext, email);
  if (!user) {
    log.error({ email }, 'auth-server:scripts:seed-password-identity - User not found');
    throw new Error(`User not found for email: ${email}`);
  }

  const existing = await userIdentitiesRepo.getByProviderAndProviderUserId(
    systemContext,
    'password',
    email
  );
  if (existing) {
    log.info(
      { email, identityId: existing.id },
      'auth-server:scripts:seed-password-identity - Password identity already exists'
    );
    return { created: false };
  }

  if (dryRun) {
    log.info(
      { email, userId: (user as { id: string }).id },
      'auth-server:scripts:seed-password-identity - [DRY RUN] Would create password identity'
    );
    return { created: false };
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
  const created = await userIdentitiesRepo.create(systemContext, {
    userId: (user as { id: string }).id,
    provider: 'password',
    providerUserId: email,
    displayName: (user as { name?: string }).name ?? email,
    avatarUrl: null,
    rawProfile: {
      passwordHash,
      passwordSetAt: new Date().toISOString(),
      seededAt: new Date().toISOString(),
    },
    accessToken: null,
    refreshToken: null,
    tokenExpiresAt: null,
  });

  log.info(
    { email, identityId: created.id },
    'auth-server:scripts:seed-password-identity - Created password identity'
  );
  return { created: true, identityId: created.id };
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');

  console.log('='.repeat(60));
  console.log('Seed: password identity for existing user');
  console.log('='.repeat(60));
  console.log(`Mode: ${dryRun ? 'DRY RUN (no changes)' : 'LIVE'}`);
  console.log('');

  try {
    const result = await seedPasswordIdentity({ dryRun });
    console.log(
      result.created
        ? `Created password identity id: ${result.identityId}. You can now log in with ADMIN_EMAIL and ADMIN_PASSWORD.`
        : 'No change (identity already exists or dry run).'
    );
    console.log('');
    process.exit(0);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Seed failed:', message);
    log.error({ error: message }, 'auth-server:scripts:seed-password-identity - Seed failed');
    process.exit(1);
  }
}

main();
