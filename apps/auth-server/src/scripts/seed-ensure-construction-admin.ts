/**
 * Seed Ensure Construction platform admin.
 *
 * Idempotent: upserts org (by slug), user, password identity, org membership,
 * and `platform_admin` role assignment.
 *
 * Prerequisites: shared `claims_manager` DB (same as API Ensure Construction seed).
 * Password: set ENSURE_PLATFORM_ADMIN_PASSWORD (required). Email defaults to dave@more0.com.au.
 *
 * Usage:
 *   ENSURE_PLATFORM_ADMIN_PASSWORD='…' pnpm --filter @morezero/auth-server run db:seed-ensure-admin:dev
 *   Or after RBAC seed when the password env is set (seed-rbac invokes this).
 */
import 'dotenv/config';
import { fileURLToPath } from 'node:url';
import * as bcrypt from 'bcrypt';
import { and, eq } from 'drizzle-orm';
import { createLogger, LoggerType } from '../lib/logger.js';
import { getDb } from '../db/client.js';
import {
  organizations,
  organizationUsers,
  userIdentities,
} from '../db/schema.js';
import { createUsersRepository } from '../db/repositories/users-repository.js';
import { createUserIdentitiesRepository } from '../db/repositories/user-identities-repository.js';
import { createOrganizationsRepository } from '../db/repositories/organizations-repository.js';
import { assignUserRoles } from '../db/services/user-role-assignments.js';
import type { AccessContext } from '../schemas/index.js';

const log = createLogger(
  'auth-server:scripts:seed-ensure-construction-admin',
  LoggerType.NODEJS,
);

/** Keep in sync with apps/api/.../ensure-construction.seed.ts */
const ENSURE_CONSTRUCTION_NAME = 'Ensure Construction Pty Ltd';
const ENSURE_CONSTRUCTION_SLUG = 'ensure-construction';
const ENSURE_CONSTRUCTION_ORG_CODE = 'ensure-construction';

const DEFAULT_ADMIN_EMAIL = 'dave@more0.com.au';
const DEFAULT_ADMIN_NAME = 'Dave';
const BCRYPT_SALT_ROUNDS = 12;
const SYSTEM_USER_ID = '00000000-0000-0000-0000-000000000000';

export interface SeedEnsureAdminResult {
  organizationId: string;
  userId: string;
  createdOrg: boolean;
  createdUser: boolean;
  passwordUpdated: boolean;
  membershipReady: boolean;
}

function resolveCredentials(): { email: string; password: string; name: string } {
  const email = (
    process.env.ENSURE_PLATFORM_ADMIN_EMAIL ?? DEFAULT_ADMIN_EMAIL
  )
    .trim()
    .toLowerCase();
  const password = (process.env.ENSURE_PLATFORM_ADMIN_PASSWORD ?? '').trim();
  const name = (process.env.ENSURE_PLATFORM_ADMIN_NAME ?? DEFAULT_ADMIN_NAME).trim();
  if (!email) {
    throw new Error(
      'auth-server:scripts:seed-ensure-construction-admin - ENSURE_PLATFORM_ADMIN_EMAIL is empty',
    );
  }
  if (!password) {
    throw new Error(
      'auth-server:scripts:seed-ensure-construction-admin - ENSURE_PLATFORM_ADMIN_PASSWORD is required',
    );
  }
  return { email, password, name };
}

export async function seedEnsureConstructionPlatformAdmin(): Promise<SeedEnsureAdminResult> {
  const { email, password, name } = resolveCredentials();
  const db = getDb();
  const systemContext: AccessContext = {
    organizationId: 'public',
    userId: SYSTEM_USER_ID,
  };
  const usersRepo = createUsersRepository(() => db, undefined);
  const identitiesRepo = createUserIdentitiesRepository(() => db, undefined);
  const orgsRepo = createOrganizationsRepository(() => db, undefined);

  let createdOrg = false;
  let [org] = await db
    .select({ id: organizations.id, name: organizations.name })
    .from(organizations)
    .where(eq(organizations.slug, ENSURE_CONSTRUCTION_SLUG))
    .limit(1);

  if (!org) {
    const inserted = await orgsRepo.create(systemContext, {
      name: ENSURE_CONSTRUCTION_NAME,
      slug: ENSURE_CONSTRUCTION_SLUG,
      description: '',
      orgCode: ENSURE_CONSTRUCTION_ORG_CODE,
      config: { url: null },
    });
    org = { id: inserted.id, name: inserted.name };
    createdOrg = true;
    log.info(
      { organizationId: org.id },
      'auth-server:scripts:seed-ensure-construction-admin - Created Ensure Construction organization',
    );
  } else {
    log.info(
      { organizationId: org.id, name: org.name },
      'auth-server:scripts:seed-ensure-construction-admin - Ensure Construction organization found',
    );
  }

  let createdUser = false;
  let user = await usersRepo.getByEmail(systemContext, email);
  if (!user) {
    user = await usersRepo.create(systemContext, {
      name,
      email,
      status: 'Active',
      object: 'user',
      config: { seededAs: 'ensure-construction-platform-admin' },
    });
    createdUser = true;
    log.info(
      { userId: user.id, email },
      'auth-server:scripts:seed-ensure-construction-admin - Created platform admin user',
    );
  } else {
    log.info(
      { userId: user.id, email },
      'auth-server:scripts:seed-ensure-construction-admin - Platform admin user already exists',
    );
  }

  const userId = user.id;
  const passwordHash = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
  const existingIdentity = await identitiesRepo.getByProviderAndProviderUserId(
    systemContext,
    'password',
    email,
  );

  let passwordUpdated = false;
  if (!existingIdentity) {
    await identitiesRepo.create(systemContext, {
      userId,
      provider: 'password',
      providerUserId: email,
      displayName: name,
      avatarUrl: null,
      rawProfile: {
        passwordHash,
        passwordSetAt: new Date().toISOString(),
        seededAt: new Date().toISOString(),
        seededAs: 'ensure-construction-platform-admin',
      },
      accessToken: null,
      refreshToken: null,
      tokenExpiresAt: null,
    });
    passwordUpdated = true;
    log.info(
      { userId, email },
      'auth-server:scripts:seed-ensure-construction-admin - Created password identity',
    );
  } else {
    await db
      .update(userIdentities)
      .set({
        rawProfile: {
          passwordHash,
          passwordSetAt: new Date().toISOString(),
          seededAt: new Date().toISOString(),
          seededAs: 'ensure-construction-platform-admin',
        },
        updatedAt: new Date(),
      } as Partial<typeof userIdentities.$inferInsert>)
      .where(eq(userIdentities.id, existingIdentity.id));
    passwordUpdated = true;
    log.info(
      { userId, email, identityId: existingIdentity.id },
      'auth-server:scripts:seed-ensure-construction-admin - Updated password identity',
    );
  }

  const [membership] = await db
    .select({ id: organizationUsers.id })
    .from(organizationUsers)
    .where(
      and(
        eq(organizationUsers.userId, userId),
        eq(organizationUsers.organizationId, org.id),
      ),
    )
    .limit(1);

  let membershipReady = true;
  if (!membership) {
    const now = new Date().toISOString();
    await db.insert(organizationUsers).values({
      userId,
      organizationId: org.id,
      role: 'admin',
      status: 'Active',
      object: 'organization_user',
      created: now,
      modified: now,
      createdBy: SYSTEM_USER_ID,
      modifiedBy: SYSTEM_USER_ID,
    });
    log.info(
      { userId, organizationId: org.id },
      'auth-server:scripts:seed-ensure-construction-admin - Created org membership',
    );
  } else {
    log.info(
      { userId, organizationId: org.id, membershipId: membership.id },
      'auth-server:scripts:seed-ensure-construction-admin - Org membership already present',
    );
  }

  await assignUserRoles(db, userId, org.id, ['platform_admin', 'admin']);
  log.info(
    { userId, organizationId: org.id, roles: ['platform_admin', 'admin'] },
    'auth-server:scripts:seed-ensure-construction-admin - Assigned platform_admin + admin roles',
  );

  return {
    organizationId: org.id,
    userId,
    createdOrg,
    createdUser,
    passwordUpdated,
    membershipReady,
  };
}

async function main() {
  console.log('='.repeat(60));
  console.log('Seed: Ensure Construction platform admin');
  console.log('='.repeat(60));
  try {
    const result = await seedEnsureConstructionPlatformAdmin();
    console.log(
      JSON.stringify(
        {
          organizationId: result.organizationId,
          userId: result.userId,
          createdOrg: result.createdOrg,
          createdUser: result.createdUser,
          passwordUpdated: result.passwordUpdated,
          membershipReady: result.membershipReady,
        },
        null,
        2,
      ),
    );
    process.exit(0);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('Seed failed:', message);
    log.error(
      { error: message },
      'auth-server:scripts:seed-ensure-construction-admin - Seed failed',
    );
    process.exit(1);
  }
}

const entryArg = (process.argv[1] ?? '').replace(/\\/g, '/');
const selfPath = fileURLToPath(import.meta.url).replace(/\\/g, '/');
const isMain =
  entryArg.length > 0 &&
  (entryArg === selfPath ||
    entryArg.endsWith('/seed-ensure-construction-admin.ts') ||
    entryArg.endsWith('/seed-ensure-construction-admin.js'));

if (isMain) {
  main();
}
