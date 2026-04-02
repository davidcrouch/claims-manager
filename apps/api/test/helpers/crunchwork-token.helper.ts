import * as path from 'path';
import * as dotenv from 'dotenv';

// Load .env from apps/api when running e2e tests
dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

const AUTH_URL =
  process.env.CRUNCHWORK_AUTH_URL || process.env.CRUNCHWORK_HOSTNAME;
const CLIENT_ID = process.env.CRUNCHWORK_CLIENT_ID;
const CLIENT_SECRET = process.env.CRUNCHWORK_CLIENT_SECRET;

export interface CrunchworkTokenResult {
  accessToken: string;
  expiresIn: number;
}

/**
 * Fetches a Crunchwork OAuth2 access token using client credentials.
 * Uses Basic auth: base64(client_id:client_secret).
 *
 * @returns Promise with access_token and expires_in
 * @throws Error if credentials are missing or token request fails
 */
export async function getCrunchworkAccessToken(): Promise<CrunchworkTokenResult> {
  if (!CLIENT_ID || !CLIENT_SECRET || !AUTH_URL) {
    throw new Error(
      '[crunchwork-token.helper.getCrunchworkAccessToken] CRUNCHWORK_CLIENT_ID, CRUNCHWORK_CLIENT_SECRET, and CRUNCHWORK_AUTH_URL or CRUNCHWORK_HOSTNAME are required in .env',
    );
  }

  const credentials = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString(
    'base64',
  );

  const response = await fetch(AUTH_URL, {
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

const BASE_URL =
  process.env.CRUNCHWORK_BASE_URL ||
  'https://staging-iag.crunchwork.com/rest/insurance-rest';

export type GetCrunchworkJobsResult =
  | { ok: true; data: unknown }
  | { ok: false; status: number; body: string };

/**
 * Calls GET /jobs on the Crunchwork Insurance REST API.
 * Requires Bearer token and active-tenant-id header per API spec.
 *
 * @param params.accessToken - JWT from getCrunchworkAccessToken()
 * @param params.tenantId - active-tenant-id (e.g. CRUNCHWORK_INSURE_TENANT_ID)
 * @param params.queryParams - optional query params (page, limit, etc.)
 */
export async function getCrunchworkJob(params: {
  accessToken: string;
  tenantId: string;
  jobId: string;
}): Promise<GetCrunchworkJobsResult> {
  const url = new URL(`${BASE_URL}/jobs/${params.jobId}`);
  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${params.accessToken}`,
      'active-tenant-id': params.tenantId,
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
  accessToken: string;
  tenantId: string;
  queryParams?: Record<string, string>;
}): Promise<GetCrunchworkJobsResult> {
  const url = new URL(`${BASE_URL}/jobs`);
  if (params.queryParams) {
    Object.entries(params.queryParams).forEach(([k, v]) =>
      url.searchParams.set(k, v),
    );
  }

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${params.accessToken}`,
      'active-tenant-id': params.tenantId,
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
