import * as path from 'path';
import * as crypto from 'crypto';
import * as dotenv from 'dotenv';
import { Pool } from 'pg';

dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const PREFIX = 'enc:';

export interface CrunchworkConnection {
  id: string;
  authUrl: string;
  baseUrl: string;
  clientId: string;
  clientSecret: string;
  providerTenantId: string;
  clientIdentifier: string | null;
  webhookSecret: string | null;
}

function buildDatabaseUrl(rawUrl: string): string {
  const match = rawUrl.match(/^postgres(?:ql)?:\/\/([^@]+)@([^/]+)(\/.*)?$/);
  if (!match) return rawUrl;
  const [, credentials, hostPart, pathPart] = match;
  const colonIndex = credentials.indexOf(':');
  if (colonIndex === -1) return rawUrl;
  const user = credentials.slice(0, colonIndex);
  const password = credentials.slice(colonIndex + 1);
  return `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${hostPart}${pathPart ?? ''}`;
}

function decryptValue(params: { ciphertext: string; key: Buffer }): string {
  if (!params.ciphertext.startsWith(PREFIX)) {
    throw new Error(
      '[crunchwork-token.helper.decryptValue] value missing enc: prefix — DB value is not encrypted',
    );
  }
  const raw = Buffer.from(params.ciphertext.slice(PREFIX.length), 'base64');
  const iv = raw.subarray(0, IV_LENGTH);
  const authTag = raw.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const encrypted = raw.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
  const decipher = crypto.createDecipheriv(ALGORITHM, params.key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString(
    'utf8',
  );
}

/**
 * Loads the active Crunchwork connection from the `integration_connections`
 * table and decrypts its credentials. Connection info is sourced ONLY from the
 * database — no provider env vars are read.
 *
 * Required env (infrastructure, not provider config):
 *   - DATABASE_URL
 *   - CREDENTIALS_ENCRYPTION_KEY
 */
export async function loadCrunchworkConnection(
  params: { connectionId?: string } = {},
): Promise<CrunchworkConnection> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error(
      '[crunchwork-token.helper.loadCrunchworkConnection] DATABASE_URL required',
    );
  }
  const rawKey = process.env.CREDENTIALS_ENCRYPTION_KEY;
  if (!rawKey) {
    throw new Error(
      '[crunchwork-token.helper.loadCrunchworkConnection] CREDENTIALS_ENCRYPTION_KEY required',
    );
  }
  const key = crypto.createHash('sha256').update(rawKey).digest();

  const pool = new Pool({ connectionString: buildDatabaseUrl(databaseUrl) });
  try {
    const sql = params.connectionId
      ? `SELECT ic.id, ic.auth_url, ic.base_url, ic.credentials, ic.provider_tenant_id, ic.client_identifier, ic.webhook_secret
         FROM integration_connections ic
         WHERE ic.id = $1 AND ic.is_active = true
         LIMIT 1`
      : `SELECT ic.id, ic.auth_url, ic.base_url, ic.credentials, ic.provider_tenant_id, ic.client_identifier, ic.webhook_secret
         FROM integration_connections ic
         JOIN integration_providers ip ON ip.id = ic.provider_id
         WHERE ip.code = 'crunchwork' AND ic.is_active = true
         ORDER BY ic.updated_at DESC
         LIMIT 1`;
    const result = await pool.query(
      sql,
      params.connectionId ? [params.connectionId] : [],
    );
    if (result.rowCount === 0) {
      throw new Error(
        '[crunchwork-token.helper.loadCrunchworkConnection] no active Crunchwork connection found in integration_connections',
      );
    }
    const row = result.rows[0] as {
      id: string;
      auth_url: string | null;
      base_url: string;
      credentials: unknown;
      provider_tenant_id: string | null;
      client_identifier: string | null;
      webhook_secret: string | null;
    };

    let credsJson: Record<string, string>;
    if (typeof row.credentials === 'string') {
      credsJson = JSON.parse(
        decryptValue({ ciphertext: row.credentials, key }),
      ) as Record<string, string>;
    } else if (row.credentials && typeof row.credentials === 'object') {
      throw new Error(
        '[crunchwork-token.helper.loadCrunchworkConnection] credentials stored as plaintext JSON — run encrypt-existing-credentials.ts',
      );
    } else {
      throw new Error(
        '[crunchwork-token.helper.loadCrunchworkConnection] credentials missing',
      );
    }

    const clientId = credsJson.clientId;
    const clientSecret = credsJson.clientSecret;
    if (!clientId || !clientSecret) {
      throw new Error(
        '[crunchwork-token.helper.loadCrunchworkConnection] credentials missing clientId/clientSecret',
      );
    }
    if (!row.auth_url) {
      throw new Error(
        '[crunchwork-token.helper.loadCrunchworkConnection] connection missing auth_url',
      );
    }
    if (!row.provider_tenant_id) {
      throw new Error(
        '[crunchwork-token.helper.loadCrunchworkConnection] connection missing provider_tenant_id',
      );
    }

    return {
      id: row.id,
      authUrl: row.auth_url,
      baseUrl: row.base_url,
      clientId,
      clientSecret,
      providerTenantId: row.provider_tenant_id,
      clientIdentifier: row.client_identifier,
      webhookSecret: row.webhook_secret,
    };
  } finally {
    await pool.end();
  }
}

export interface CrunchworkTokenResult {
  accessToken: string;
  expiresIn: number;
}

/**
 * Fetches a Crunchwork OAuth2 access token using client credentials from the
 * provided connection (loaded from the DB).
 */
export async function getCrunchworkAccessToken(
  connection: CrunchworkConnection,
): Promise<CrunchworkTokenResult> {
  const credentials = Buffer.from(
    `${connection.clientId}:${connection.clientSecret}`,
  ).toString('base64');

  const response = await fetch(connection.authUrl, {
    method: 'GET',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `[crunchwork-token.helper.getCrunchworkAccessToken] Token request failed: ${response.status} ${response.statusText} - ${body}`,
    );
  }

  const data = (await response.json()) as {
    access_token: string;
    expires_in: number;
  };

  if (!data.access_token) {
    throw new Error(
      '[crunchwork-token.helper.getCrunchworkAccessToken] No access_token in response',
    );
  }

  return {
    accessToken: data.access_token,
    expiresIn: data.expires_in ?? 0,
  };
}

export type GetCrunchworkJobsResult =
  | { ok: true; data: unknown }
  | { ok: false; status: number; body: string };

export async function getCrunchworkJob(params: {
  connection: CrunchworkConnection;
  accessToken: string;
  jobId: string;
}): Promise<GetCrunchworkJobsResult> {
  const url = new URL(`${params.connection.baseUrl}/jobs/${params.jobId}`);
  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${params.accessToken}`,
      'active-tenant-id': params.connection.providerTenantId,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      body: await response.text(),
    };
  }

  return { ok: true, data: await response.json() };
}

export async function getCrunchworkJobs(params: {
  connection: CrunchworkConnection;
  accessToken: string;
  queryParams?: Record<string, string>;
}): Promise<GetCrunchworkJobsResult> {
  const url = new URL(`${params.connection.baseUrl}/jobs`);
  if (params.queryParams) {
    Object.entries(params.queryParams).forEach(([k, v]) =>
      url.searchParams.set(k, v),
    );
  }

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${params.accessToken}`,
      'active-tenant-id': params.connection.providerTenantId,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      body: await response.text(),
    };
  }

  return { ok: true, data: await response.json() };
}
