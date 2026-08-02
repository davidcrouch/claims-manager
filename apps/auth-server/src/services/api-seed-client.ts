/**
 * Api-seed client
 *
 * Fire-and-forget helper for posting to api-server's
 * `POST /internal/seed-tenant` after a new organization is provisioned.
 *
 * Design rules:
 *   - NEVER block the signup response on this call.
 *   - NEVER throw out of here — a failure to seed must not fail signup.
 *   - Only triggers when SEED_NEW_TENANTS === 'true' AND the required
 *     config (INTERNAL_API_TOKEN, API_INTERNAL_URL) is present.
 *
 * Env contract:
 *   - SEED_NEW_TENANTS     "true" to enable (default off). Also enforced
 *                          on the api-server side for defence in depth.
 *                          When enabled, api-server always seeds catalog-dev;
 *                          sample-data is controlled by api-server's
 *                          SEED_SAMPLE_DATA flag (not this client).
 *   - API_INTERNAL_URL     Base URL of the api-server as reachable from
 *                          the auth-server container (e.g.
 *                          http://api-server:3001 inside compose, or
 *                          https://api-server-<projectnum>.<region>.run.app
 *                          on Cloud Run).
 *   - API_INTERNAL_PREFIX  Optional API prefix, defaults to '/api/v1'.
 *   - INTERNAL_API_TOKEN   Shared secret for the x-internal-token header.
 *
 * On Cloud Run, api-server is IAM-protected (`roles/run.invoker`). This
 * client fetches a Google identity token from the metadata server and
 * sends it as `Authorization: Bearer …` alongside `x-internal-token`.
 * Locally the metadata server is absent so only the shared secret is used.
 */
import { createLogger, LoggerType } from '../lib/logger.js';
import { createTelemetryLogger } from '@morezero/telemetry';

const baseLogger = createLogger('auth-server:api-seed-client', LoggerType.NODEJS);
const log = createTelemetryLogger(baseLogger, 'api-seed-client', 'ApiSeedClient', 'auth-server');

const DEFAULT_PREFIX = '/api/v1';
const REQUEST_TIMEOUT_MS = 5_000;
const METADATA_IDENTITY_URL =
  'http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/identity';

function isEnabled(): boolean {
  return (process.env.SEED_NEW_TENANTS ?? '').trim().toLowerCase() === 'true';
}

function resolveEndpoint(): string | null {
  const base = process.env.API_INTERNAL_URL?.trim();
  if (!base) return null;
  const prefix = (process.env.API_INTERNAL_PREFIX ?? DEFAULT_PREFIX).trim();
  const trimmedBase = base.replace(/\/+$/, '');
  const trimmedPrefix = prefix.replace(/^\/?/, '/').replace(/\/+$/, '');
  return `${trimmedBase}${trimmedPrefix}/internal/seed-tenant`;
}

function resolveAudience(): string | null {
  const base = process.env.API_INTERNAL_URL?.trim();
  if (!base) return null;
  return base.replace(/\/+$/, '');
}

/**
 * Fetch a Google-signed ID token for the target audience when running on GCP.
 * Returns null locally (or if metadata is unavailable) — callers still send
 * x-internal-token for app-level auth.
 */
async function fetchCloudRunIdToken(audience: string): Promise<string | null> {
  const functionName = 'fetchCloudRunIdToken';
  // K_SERVICE is set on Cloud Run; skip metadata probe locally.
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

/**
 * Dispatch a seed-tenant request in the background. Returns immediately;
 * the request completes (or fails) asynchronously with logs.
 */
export function triggerSeedTenant(params: { tenantId: string }): void {
  const functionName = 'triggerSeedTenant';
  const { tenantId } = params;

  if (!isEnabled()) {
    log.debug({ functionName, tenantId },
      'auth-server:api-seed-client:triggerSeedTenant - SEED_NEW_TENANTS not enabled, skipping');
    return;
  }

  const token = process.env.INTERNAL_API_TOKEN?.trim();
  const endpoint = resolveEndpoint();
  const audience = resolveAudience();

  if (!token || !endpoint || !audience) {
    log.warn({
      functionName,
      tenantId,
      hasToken: !!token,
      hasEndpoint: !!endpoint,
    }, 'auth-server:api-seed-client:triggerSeedTenant - missing INTERNAL_API_TOKEN or API_INTERNAL_URL, skipping');
    return;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  void (async () => {
    const headers: Record<string, string> = {
      'content-type': 'application/json',
      'x-internal-token': token,
    };

    const idToken = await fetchCloudRunIdToken(audience);
    if (idToken) {
      headers.Authorization = `Bearer ${idToken}`;
    } else if (process.env.K_SERVICE) {
      log.warn(
        { functionName, tenantId },
        'auth-server:api-seed-client:triggerSeedTenant - no Cloud Run ID token; IAM invoke will likely 403',
      );
    }

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({ tenantId }),
        signal: controller.signal,
      });
      const bodyText = await res.text().catch(() => '');
      if (res.ok) {
        log.info({
          functionName,
          tenantId,
          status: res.status,
          body: bodyText.slice(0, 200),
          usedIdToken: !!idToken,
        }, 'auth-server:api-seed-client:triggerSeedTenant - dispatched');
      } else {
        log.warn({
          functionName,
          tenantId,
          status: res.status,
          body: bodyText.slice(0, 500),
          usedIdToken: !!idToken,
        }, 'auth-server:api-seed-client:triggerSeedTenant - non-2xx response');
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      log.warn({
        functionName,
        tenantId,
        error: message,
      }, 'auth-server:api-seed-client:triggerSeedTenant - request failed');
    } finally {
      clearTimeout(timer);
    }
  })();
}
