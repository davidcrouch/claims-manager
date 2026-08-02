import { Logger } from '@nestjs/common';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

const logger = new Logger('CredentialTransit');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const ENCODING = 'base64';
const DEV_PREFIX = 'dev:';

function deriveKey(rawKey: string): Buffer {
  return createHash('sha256').update(rawKey).digest();
}

function getEncryptionKey(): Buffer | null {
  const rawKey = process.env.CREDENTIALS_ENCRYPTION_KEY;
  if (!rawKey || rawKey.length === 0) {
    return null;
  }
  return deriveKey(rawKey);
}

function isDevEncoded(value: string): boolean {
  return value.startsWith(DEV_PREFIX);
}

/**
 * AES-256-GCM encrypt for credential transit.
 * Uses CREDENTIALS_ENCRYPTION_KEY when set; otherwise base64 (dev).
 */
export function encryptForTransit(plaintext: string): string {
  const key = getEncryptionKey();
  if (!key) {
    logger.debug(
      '[CredentialTransit.encryptForTransit] no encryption key — using dev base64',
    );
    return `${DEV_PREFIX}${Buffer.from(plaintext, 'utf8').toString(ENCODING)}`;
  }

  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });

  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return Buffer.concat([iv, authTag, encrypted]).toString(ENCODING);
}

/**
 * Decrypt a transit-encrypted credential payload.
 */
export function decryptFromTransit(encoded: string): string {
  if (isDevEncoded(encoded)) {
    logger.debug(
      '[CredentialTransit.decryptFromTransit] dev base64 decode',
    );
    return Buffer.from(encoded.slice(DEV_PREFIX.length), ENCODING).toString(
      'utf8',
    );
  }

  const key = getEncryptionKey();
  if (!key) {
    logger.warn(
      '[CredentialTransit.decryptFromTransit] encrypted payload but CREDENTIALS_ENCRYPTION_KEY unset',
    );
    throw new Error(
      'CredentialTransit.decryptFromTransit — CREDENTIALS_ENCRYPTION_KEY is required to decrypt',
    );
  }

  const raw = Buffer.from(encoded, ENCODING);
  const iv = raw.subarray(0, IV_LENGTH);
  const authTag = raw.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const ciphertext = raw.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

  const decipher = createDecipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });
  decipher.setAuthTag(authTag);

  return Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]).toString('utf8');
}

/**
 * Encrypt a JSON credential object for transit.
 */
export function encryptJsonForTransit(payload: Record<string, unknown>): string {
  return encryptForTransit(JSON.stringify(payload));
}

/**
 * Decrypt a transit-encrypted JSON credential object.
 */
export function decryptJsonFromTransit(
  encoded: string,
): Record<string, unknown> {
  const plaintext = decryptFromTransit(encoded);
  return JSON.parse(plaintext) as Record<string, unknown>;
}

// ── GCP Secret Manager credential storage ──

const GCP_SM_PROJECT = process.env.GCP_SECRET_MANAGER_PROJECT;

async function getSecretManagerClient() {
  const { SecretManagerServiceClient } = await import(
    '@google-cloud/secret-manager'
  );
  return new SecretManagerServiceClient();
}

/**
 * Store a credential in GCP Secret Manager (when configured) or fall back to
 * local AES-256-GCM encryption. Returns a reference string to persist in the DB.
 */
export async function storeCredentialSecret(
  name: string,
  value: string,
): Promise<string> {
  if (!GCP_SM_PROJECT) {
    logger.debug(
      '[CredentialTransit.storeCredentialSecret] no GCP project — using local encryption',
    );
    return encryptForTransit(value);
  }

  const client = await getSecretManagerClient();
  const secretId = `mcp-cred-${name}`;
  const parent = `projects/${GCP_SM_PROJECT}`;

  try {
    await client.createSecret({
      parent,
      secretId,
      secret: { replication: { automatic: {} } },
    });
  } catch (err: any) {
    if (err.code !== 6) throw err; // 6 = ALREADY_EXISTS
  }

  await client.addSecretVersion({
    parent: `${parent}/secrets/${secretId}`,
    payload: { data: Buffer.from(value, 'utf8') },
  });

  logger.log(
    '[CredentialTransit.storeCredentialSecret] stored in Secret Manager',
  );
  return `gsm:${secretId}`;
}

/**
 * Load a credential from GCP Secret Manager or decrypt a locally-encrypted value.
 * Handles both `gsm:` references and raw encrypted blobs transparently.
 */
export async function loadCredentialSecret(name: string): Promise<string> {
  if (!GCP_SM_PROJECT) {
    return decryptFromTransit(name);
  }

  const secretId = name.startsWith('gsm:')
    ? name.slice(4)
    : `mcp-cred-${name}`;
  const client = await getSecretManagerClient();
  const [version] = await client.accessSecretVersion({
    name: `projects/${GCP_SM_PROJECT}/secrets/${secretId}/versions/latest`,
  });

  return version.payload?.data?.toString() ?? '';
}

/**
 * Delete a credential secret from GCP Secret Manager.
 * No-op when using local encryption (nothing external to clean up).
 */
export async function deleteCredentialSecret(name: string): Promise<void> {
  if (!GCP_SM_PROJECT) {
    return;
  }

  const secretId = name.startsWith('gsm:')
    ? name.slice(4)
    : `mcp-cred-${name}`;
  const client = await getSecretManagerClient();
  try {
    await client.deleteSecret({
      name: `projects/${GCP_SM_PROJECT}/secrets/${secretId}`,
    });
  } catch (err: any) {
    if (err.code !== 5) throw err; // 5 = NOT_FOUND
  }
}
