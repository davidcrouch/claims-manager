/**
 * Api-seed client
 *
 * Fire-and-forget helpers for posting to api-server internal routes after
 * org provisioning / user signup.
 *
 * Design rules:
 *   - NEVER block the signup response on these calls.
 *   - NEVER throw out of here — a failure must not fail signup.
 *
 * Env contract:
 *   - SEED_NEW_TENANTS     "true" to enable tenant seeding (default off).
 *   - API_INTERNAL_URL     Base URL of the api-server as reachable from
 *                          the auth-server container.
 *   - API_INTERNAL_PREFIX  Optional API prefix, defaults to '/api/v1'.
 *   - INTERNAL_API_TOKEN   Shared secret for the x-internal-token header.
 */
import { createLogger, LoggerType } from '../lib/logger.js';
import { createTelemetryLogger } from '@morezero/telemetry';

const baseLogger = createLogger('auth-server:api-seed-client', LoggerType.NODEJS);
const log = createTelemetryLogger(baseLogger, 'api-seed-client', 'ApiSeedClient', 'auth-server');

const DEFAULT_PREFIX = '/api/v1';
const REQUEST_TIMEOUT_MS = 180_000;
const ENSURE_CONTACT_TIMEOUT_MS = 15_000;
const METADATA_IDENTITY_URL =
  'http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/identity';

function isSeedEnabled(): boolean {
  return (process.env.SEED_NEW_TENANTS ?? '').trim().toLowerCase() === 'true';
}

function resolveBase(): { endpointBase: string; audience: string; token: string } | null {
  const base = process.env.API_INTERNAL_URL?.trim();
  const token = process.env.INTERNAL_API_TOKEN?.trim();
  if (!base || !token) return null;
  const prefix = (process.env.API_INTERNAL_PREFIX ?? DEFAULT_PREFIX).trim();
  const trimmedBase = base.replace(/\/+$/, '');
  const trimmedPrefix = prefix.replace(/^\/?/, '/').replace(/\/+$/, '');
  return {
    endpointBase: `${trimmedBase}${trimmedPrefix}`,
    audience: trimmedBase,
    token,
  };
}

async function fetchCloudRunIdToken(audience: string): Promise<string | null> {
  const functionName = 'fetchCloudRunIdToken';
  if (!process.env.K_SERVICE) {
    return null;
  }

  try {
    const url = `${METADATA_IDENTITY_URL}?audience=${encodeURIComponent(audience)}`;
    const res = await fetch(url, {
      headers: { 'Metadata-Flavor': 'Google' },
      signal: AbortSignal.timeout(2_000),
    });
    if (!res.ok) {
      log.warn(
        { functionName, status: res.status, audience },
        'auth-server:api-seed-client:fetchCloudRunIdToken - metadata identity non-2xx',
      );
      return null;
    }
    const token = (await res.text()).trim();
    return token || null;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    log.warn(
      { functionName, audience, error: message },
      'auth-server:api-seed-client:fetchCloudRunIdToken - metadata identity failed',
    );
    return null;
  }
}

async function postInternal(
  path: string,
  body: Record<string, unknown>,
  timeoutMs: number,
  logLabel: string,
): Promise<void> {
  const functionName = logLabel;
  const resolved = resolveBase();
  if (!resolved) {
    log.warn(
      { functionName },
      'auth-server:api-seed-client - missing INTERNAL_API_TOKEN or API_INTERNAL_URL, skipping',
    );
    return;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    'x-internal-token': resolved.token,
  };

  try {
    const idToken = await fetchCloudRunIdToken(resolved.audience);
    if (idToken) {
      headers.Authorization = `Bearer ${idToken}`;
    } else if (process.env.K_SERVICE) {
      log.warn(
        { functionName },
        'auth-server:api-seed-client - no Cloud Run ID token; IAM invoke will likely 403',
      );
    }

    const res = await fetch(`${resolved.endpointBase}${path}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const bodyText = await res.text().catch(() => '');
    if (res.ok) {
      log.info(
        {
          functionName,
          status: res.status,
          body: bodyText.slice(0, 200),
          usedIdToken: !!idToken,
        },
        `auth-server:api-seed-client:${logLabel} - ok`,
      );
    } else {
      log.warn(
        {
          functionName,
          status: res.status,
          body: bodyText.slice(0, 500),
          usedIdToken: !!idToken,
        },
        `auth-server:api-seed-client:${logLabel} - non-2xx`,
      );
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    log.warn(
      { functionName, error: message },
      `auth-server:api-seed-client:${logLabel} - request failed`,
    );
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Dispatch a seed-tenant request in the background. Returns immediately;
 * the request completes (or fails) asynchronously with logs.
 */
export function triggerSeedTenant(params: { tenantId: string }): void {
  const functionName = 'triggerSeedTenant';
  const { tenantId } = params;

  if (!isSeedEnabled()) {
    log.debug(
      { functionName, tenantId },
      'auth-server:api-seed-client:triggerSeedTenant - SEED_NEW_TENANTS not enabled, skipping',
    );
    return;
  }

  void postInternal(
    '/internal/seed-tenant',
    { tenantId },
    REQUEST_TIMEOUT_MS,
    'triggerSeedTenant',
  );
}

/**
 * Ensure a claims-manager contact exists for a user (signup / invite accept).
 * Fire-and-forget; never blocks auth flows.
 */
export function triggerEnsureUserContact(params: {
  tenantId: string;
  email: string;
  firstName?: string;
  lastName?: string;
  name?: string;
}): void {
  const functionName = 'triggerEnsureUserContact';
  const email = params.email?.trim().toLowerCase();
  if (!email || !params.tenantId) {
    log.warn(
      { functionName, tenantId: params.tenantId },
      'auth-server:api-seed-client:triggerEnsureUserContact - missing email or tenantId',
    );
    return;
  }

  void postInternal(
    '/internal/ensure-user-contact',
    {
      tenantId: params.tenantId,
      email,
      firstName: params.firstName,
      lastName: params.lastName,
      name: params.name,
    },
    ENSURE_CONTACT_TIMEOUT_MS,
    'triggerEnsureUserContact',
  );
}
