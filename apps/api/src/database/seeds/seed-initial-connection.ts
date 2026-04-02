import 'dotenv/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { eq } from 'drizzle-orm';
import * as crypto from 'crypto';
import * as schema from '../schema';

function buildDatabaseUrl(rawUrl: string): string {
  try {
    const match = rawUrl.match(/^postgres(?:ql)?:\/\/([^@]+)@([^/]+)(\/.*)?$/);
    if (!match) return rawUrl;
    const [, credentials, hostPart, path] = match;
    const colonIndex = credentials.indexOf(':');
    if (colonIndex === -1) return rawUrl;
    const user = credentials.slice(0, colonIndex);
    const password = credentials.slice(colonIndex + 1);
    return `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${hostPart}${path ?? ''}`;
  } catch {
    return rawUrl;
  }
}

function encryptValue(plaintext: string, encryptionKey: string): string {
  const key = crypto.createHash('sha256').update(encryptionKey).digest();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv, { authTagLength: 16 });
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `enc:${Buffer.concat([iv, authTag, encrypted]).toString('base64')}`;
}

async function seedInitialConnection() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('seed-initial-connection — DATABASE_URL is required');
    process.exit(1);
  }

  const encryptionKey = process.env.CREDENTIALS_ENCRYPTION_KEY;
  if (!encryptionKey) {
    console.error('seed-initial-connection — CREDENTIALS_ENCRYPTION_KEY is required');
    process.exit(1);
  }

  const pool = new Pool({ connectionString: buildDatabaseUrl(databaseUrl) });
  const db = drizzle({ client: pool, schema });

  const baseUrl =
    process.env.CRUNCHWORK_BASE_URL ||
    'https://staging-iag.crunchwork.com/rest/insurance-rest';
  const authUrl = process.env.CRUNCHWORK_AUTH_URL || process.env.CRUNCHWORK_HOSTNAME || '';
  const clientId = process.env.CRUNCHWORK_CLIENT_ID || '';
  const clientSecret = process.env.CRUNCHWORK_CLIENT_SECRET || '';
  const hmacKey = process.env.CRUNCHWORK_HMAC_KEY || '';
  const activeTenantId = process.env.CRUNCHWORK_VENDOR_TENANT_ID || process.env.CRUNCHWORK_INSURE_TENANT_ID || '';
  const clientIdentifier = process.env.CRUNCHWORK_CLIENT_IDENTIFIER || '';
  const tenantId = process.env.SEED_TENANT_ID || 'default';

  const credentialsValue = encryptValue(JSON.stringify({ clientId, clientSecret }), encryptionKey);
  const webhookSecretValue = encryptValue(hmacKey, encryptionKey);

  console.log('seed-initial-connection — ensuring integration_providers has crunchwork row');
  const [existingProvider] = await db
    .select()
    .from(schema.integrationProviders)
    .where(eq(schema.integrationProviders.code, 'crunchwork'))
    .limit(1);

  let providerId: string;
  if (existingProvider) {
    providerId = existingProvider.id;
    console.log(`seed-initial-connection — provider exists: ${providerId}`);
  } else {
    const [created] = await db
      .insert(schema.integrationProviders)
      .values({ code: 'crunchwork', name: 'Crunchwork' })
      .returning();
    providerId = created!.id;
    console.log(`seed-initial-connection — provider created: ${providerId}`);
  }

  console.log('seed-initial-connection — upserting integration_connections');
  const [existingConnection] = await db
    .select()
    .from(schema.integrationConnections)
    .where(eq(schema.integrationConnections.tenantId, tenantId))
    .limit(1);

  if (existingConnection) {
    console.log(`seed-initial-connection — connection exists: ${existingConnection.id}, updating`);
    await db
      .update(schema.integrationConnections)
      .set({
        providerTenantId: activeTenantId,
        clientIdentifier,
        baseUrl,
        authUrl,
        credentials: credentialsValue,
        webhookSecret: webhookSecretValue,
        isActive: true,
        updatedAt: new Date(),
      })
      .where(eq(schema.integrationConnections.id, existingConnection.id));
  } else {
    const [created] = await db
      .insert(schema.integrationConnections)
      .values({
        tenantId,
        providerId,
        environment: 'staging',
        baseUrl,
        authUrl,
        clientIdentifier,
        providerTenantId: activeTenantId,
        credentials: credentialsValue,
        webhookSecret: webhookSecretValue,
        config: {},
        isActive: true,
      })
      .returning();
    console.log(`seed-initial-connection — connection created: ${created!.id}`);
  }

  await pool.end();
  console.log('seed-initial-connection — done');
}

seedInitialConnection().catch((err) => {
  console.error('seed-initial-connection — failed:', err);
  process.exit(1);
});
