/**
 * Bootstrap seed: Ensure Construction Pty Ltd + Crunchwork staging connection.
 *
 * Replaces the former demo claims/jobs sample-data seed. Idempotent:
 *   - org is keyed on slug `ensure-construction`
 *   - connection is keyed on (tenantId, providerCode, environment)
 *
 * Credentials are encrypted with CREDENTIALS_ENCRYPTION_KEY (same AES-256-GCM
 * scheme as CredentialsCipher). The seed fails if that key is missing.
 *
 * Callers:
 *   - CLI (`pnpm --filter api run db:seed`) — always
 *   - api-server `POST /internal/seed-tenant` — connection only, when the
 *     tenant is Ensure Construction
 *
 * Platform admin user/password for this org is seeded on the auth-server side
 * (`pnpm --filter @morezero/auth-server run db:seed-ensure-admin:dev`) when
 * ENSURE_PLATFORM_ADMIN_PASSWORD is set — same shared claims_manager database.
 */
import * as crypto from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import type { Seed, SeedContext, SeedLogger, SeedResult } from '../lib/runner';
import type { SeedDb } from '../lib/db';
import * as schema from '../../schema';

export const ENSURE_CONSTRUCTION_NAME = 'Ensure Construction Pty Ltd';
export const ENSURE_CONSTRUCTION_SLUG = 'ensure-construction';
export const ENSURE_CONSTRUCTION_ORG_CODE = 'ensure-construction';

const LOG = '[seeds/ensure-construction]';
const SYSTEM_USER_ID = '00000000-0000-0000-0000-000000000000';

const CRUNCHWORK_STAGING = {
  name: 'Crunchwork (staging)',
  providerCode: 'crunchwork',
  environment: 'staging',
  baseUrl: 'https://staging-iag.crunchwork.com',
  baseApi: 'https://staging-iag.crunchwork.com/rest/insurance-rest/',
  authUrl:
    'https://staging-iag.crunchwork.com/auth/token?grant_type=client_credentials',
  clientIdentifier: 'iag',
  providerTenantId: '1b179daa-ea62-47ef-9dc6-68c72812d3b6',
  clientId: 'a09fb782-134c-4cbb-9b73-6e0fbf6efdba',
  clientSecret: 'a09fb782-134c-4cbb-9b73-6e0fbf6efdba',
  insureTenantId: '0870aded-0099-4800-ada2-41c6cfaed915',
  hmacKey: 'aae2e882-c7dc-4b71-a8c5-dbc3222e4ffb',
} as const;

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const ENC_PREFIX = 'enc:';

function getEncryptionKey(): Buffer {
  const raw = (process.env.CREDENTIALS_ENCRYPTION_KEY ?? '').trim();
  if (!raw) {
    throw new Error(
      `${LOG} CREDENTIALS_ENCRYPTION_KEY is required to encrypt connection credentials`,
    );
  }
  return crypto.createHash('sha256').update(raw).digest();
}

function encryptPlaintext(plaintext: string, key: Buffer): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });
  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return `${ENC_PREFIX}${Buffer.concat([iv, authTag, encrypted]).toString('base64')}`;
}

export function isEnsureConstructionOrg(params: {
  name?: string | null;
  slug?: string | null;
}): boolean {
  const name = (params.name ?? '').trim().toLowerCase();
  const slug = (params.slug ?? '').trim().toLowerCase();
  return (
    slug === ENSURE_CONSTRUCTION_SLUG ||
    name === ENSURE_CONSTRUCTION_NAME.toLowerCase()
  );
}

async function findEnsureConstruction(params: {
  db: SeedDb;
}): Promise<{ id: string; name: string; slug: string } | null> {
  const [bySlug] = await params.db
    .select({
      id: schema.organizations.id,
      name: schema.organizations.name,
      slug: schema.organizations.slug,
    })
    .from(schema.organizations)
    .where(eq(schema.organizations.slug, ENSURE_CONSTRUCTION_SLUG))
    .limit(1);
  if (bySlug) return bySlug;

  const [byName] = await params.db
    .select({
      id: schema.organizations.id,
      name: schema.organizations.name,
      slug: schema.organizations.slug,
    })
    .from(schema.organizations)
    .where(eq(schema.organizations.name, ENSURE_CONSTRUCTION_NAME))
    .limit(1);
  return byName ?? null;
}

export async function seedEnsureConstructionOrg(params: {
  db: SeedDb;
  logger?: SeedLogger;
}): Promise<{ tenantId: string; inserted: number; skipped: number }> {
  const logger: SeedLogger = params.logger ?? {
    info: (msg) => console.log(`${LOG} ${msg}`),
    warn: (msg) => console.warn(`${LOG} ${msg}`),
    error: (msg) => console.error(`${LOG} ${msg}`),
  };

  const existing = await findEnsureConstruction({ db: params.db });
  if (existing) {
    logger.info(`org already present name="${existing.name}" id=${existing.id}`);
    return { tenantId: existing.id, inserted: 0, skipped: 1 };
  }

  const now = new Date().toISOString();
  const [row] = await params.db
    .insert(schema.organizations)
    .values({
      name: ENSURE_CONSTRUCTION_NAME,
      slug: ENSURE_CONSTRUCTION_SLUG,
      legalName: ENSURE_CONSTRUCTION_NAME,
      tradingName: 'Ensure Construction',
      description: '',
      orgCode: ENSURE_CONSTRUCTION_ORG_CODE,
      config: { url: null },
      status: 'Active',
      object: 'organization',
      created: now,
      modified: now,
      createdBy: SYSTEM_USER_ID,
      modifiedBy: SYSTEM_USER_ID,
    })
    .returning({ id: schema.organizations.id });

  if (!row) {
    throw new Error(`${LOG} failed to insert organization`);
  }

  logger.info(`created org name="${ENSURE_CONSTRUCTION_NAME}" id=${row.id}`);
  return { tenantId: row.id, inserted: 1, skipped: 0 };
}

export async function seedCrunchworkStagingConnection(params: {
  db: SeedDb;
  tenantId: string;
  logger?: SeedLogger;
}): Promise<{ inserted: number; skipped: number }> {
  const logger: SeedLogger = params.logger ?? {
    info: (msg) => console.log(`${LOG} ${msg}`),
    warn: (msg) => console.warn(`${LOG} ${msg}`),
    error: (msg) => console.error(`${LOG} ${msg}`),
  };

  const [existing] = await params.db
    .select({ id: schema.integrationConnections.id })
    .from(schema.integrationConnections)
    .where(
      and(
        eq(schema.integrationConnections.tenantId, params.tenantId),
        eq(
          schema.integrationConnections.providerCode,
          CRUNCHWORK_STAGING.providerCode,
        ),
        eq(
          schema.integrationConnections.environment,
          CRUNCHWORK_STAGING.environment,
        ),
      ),
    )
    .limit(1);

  if (existing) {
    logger.info(
      `crunchwork staging connection already present id=${existing.id}`,
    );
    return { inserted: 0, skipped: 1 };
  }

  const key = getEncryptionKey();
  const credentials = encryptPlaintext(
    JSON.stringify({
      clientId: CRUNCHWORK_STAGING.clientId,
      clientSecret: CRUNCHWORK_STAGING.clientSecret,
    }),
    key,
  );
  const webhookSecret = encryptPlaintext(CRUNCHWORK_STAGING.hmacKey, key);

  const [row] = await params.db
    .insert(schema.integrationConnections)
    .values({
      tenantId: params.tenantId,
      providerCode: CRUNCHWORK_STAGING.providerCode,
      name: CRUNCHWORK_STAGING.name,
      environment: CRUNCHWORK_STAGING.environment,
      authType: 'client_credentials',
      baseUrl: CRUNCHWORK_STAGING.baseUrl,
      baseApi: CRUNCHWORK_STAGING.baseApi,
      authUrl: CRUNCHWORK_STAGING.authUrl,
      clientIdentifier: CRUNCHWORK_STAGING.clientIdentifier,
      providerTenantId: CRUNCHWORK_STAGING.providerTenantId,
      credentials,
      webhookSecret,
      config: { insureTenantId: CRUNCHWORK_STAGING.insureTenantId },
      isActive: true,
    })
    .returning({ id: schema.integrationConnections.id });

  logger.info(
    `created crunchwork staging connection id=${row?.id ?? 'unknown'} tenant=${params.tenantId}`,
  );
  return { inserted: 1, skipped: 0 };
}

export async function seedEnsureConstructionBootstrap(params: {
  db: SeedDb;
  logger?: SeedLogger;
}): Promise<SeedResult> {
  const org = await seedEnsureConstructionOrg(params);
  const conn = await seedCrunchworkStagingConnection({
    db: params.db,
    tenantId: org.tenantId,
    logger: params.logger,
  });
  return {
    inserted: org.inserted + conn.inserted,
    updated: 0,
    skipped: org.skipped + conn.skipped,
    notes: `tenant=${org.tenantId}; org; crunchwork-staging`,
  };
}

async function run(ctx: SeedContext): Promise<SeedResult> {
  return seedEnsureConstructionBootstrap({ db: ctx.db, logger: ctx.logger });
}

const seed: Seed = {
  name: 'ensure-construction',
  description:
    'Ensure Construction Pty Ltd organisation + Crunchwork staging connection',
  run,
};

export default seed;
