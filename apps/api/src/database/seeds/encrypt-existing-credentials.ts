/**
 * One-shot: re-encrypt plaintext `credentials` / `webhook_secret` in
 * `integration_connections`. Rows created via the (old) UI path stored these
 * values unencrypted; the resolver and HMAC verifier expect `enc:`-prefixed
 * ciphertext produced by `CredentialsCipher`.
 *
 * Safe to re-run: rows already containing encrypted values are skipped.
 *
 * Run with: `pnpm --filter api exec ts-node src/database/seeds/encrypt-existing-credentials.ts`
 */
import 'dotenv/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { eq } from 'drizzle-orm';
import * as crypto from 'crypto';
import * as schema from '../schema';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const PREFIX = 'enc:';

function buildDatabaseUrl(rawUrl: string): string {
  const match = rawUrl.match(/^postgres(?:ql)?:\/\/([^@]+)@([^/]+)(\/.*)?$/);
  if (!match) return rawUrl;
  const [, credentials, hostPart, path] = match;
  const colonIndex = credentials.indexOf(':');
  if (colonIndex === -1) return rawUrl;
  const user = credentials.slice(0, colonIndex);
  const password = credentials.slice(colonIndex + 1);
  return `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${hostPart}${path ?? ''}`;
}

function encryptValue(plaintext: string, key: Buffer): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });
  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return `${PREFIX}${Buffer.concat([iv, authTag, encrypted]).toString('base64')}`;
}

function isEncrypted(value: unknown): boolean {
  return typeof value === 'string' && value.startsWith(PREFIX);
}

async function run(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('encrypt-existing-credentials — DATABASE_URL is required');
    process.exit(1);
  }

  const rawKey = process.env.CREDENTIALS_ENCRYPTION_KEY;
  if (!rawKey) {
    console.error(
      'encrypt-existing-credentials — CREDENTIALS_ENCRYPTION_KEY is required',
    );
    process.exit(1);
  }
  const key = crypto.createHash('sha256').update(rawKey).digest();

  const pool = new Pool({ connectionString: buildDatabaseUrl(databaseUrl) });
  const db = drizzle({ client: pool, schema });

  const rows = await db.select().from(schema.integrationConnections);
  console.log(
    `encrypt-existing-credentials — scanning ${rows.length} connection(s)`,
  );

  for (const row of rows) {
    const updates: {
      credentials?: string;
      webhookSecret?: string;
    } = {};

    const creds = row.credentials as unknown;
    if (creds && !isEncrypted(creds) && typeof creds === 'object') {
      updates.credentials = encryptValue(JSON.stringify(creds), key);
    }

    if (row.webhookSecret && !isEncrypted(row.webhookSecret)) {
      updates.webhookSecret = encryptValue(row.webhookSecret, key);
    }

    if (Object.keys(updates).length === 0) {
      console.log(`  ${row.id} — already encrypted, skipping`);
      continue;
    }

    await db
      .update(schema.integrationConnections)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(schema.integrationConnections.id, row.id));

    console.log(
      `  ${row.id} — updated: ${Object.keys(updates).join(', ')}`,
    );
  }

  await pool.end();
  console.log('encrypt-existing-credentials — done');
}

run().catch((err) => {
  console.error('encrypt-existing-credentials — failed:', err);
  process.exit(1);
});
