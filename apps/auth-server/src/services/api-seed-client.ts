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
 *   - API_INTERNAL_URL     Base URL of the api-server as reachable from
 *                          the auth-server container (e.g.
 *                          http://api-server:3001 inside compose, or
 *                          https://api.staging.branlamie.com externally).
 *   - API_INTERNAL_PREFIX  Optional API prefix, defaults to '/api/v1'.
 *   - INTERNAL_API_TOKEN   Shared secret for the x-internal-token header.
 */
import { createLogger, LoggerType } from '../lib/logger.js';
import { createTelemetryLogger } from '@morezero/telemetry';

const baseLogger = createLogger('auth-server:api-seed-client', LoggerType.NODEJS);
const log = createTelemetryLogger(baseLogger, 'api-seed-client', 'ApiSeedClient', 'auth-server');

const DEFAULT_PREFIX = '/api/v1';
const REQUEST_TIMEOUT_MS = 5_000;

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

  if (!token || !endpoint) {
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

  fetch(endpoint, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-internal-token': token,
    },
    body: JSON.stringify({ tenantId }),
    signal: controller.signal,
  })
    .then(async (res) => {
      const bodyText = await res.text().catch(() => '');
      if (res.ok) {
        log.info({
          functionName,
          tenantId,
          status: res.status,
          body: bodyText.slice(0, 200),
        }, 'auth-server:api-seed-client:triggerSeedTenant - dispatched');
      } else {
        log.warn({
          functionName,
          tenantId,
          status: res.status,
          body: bodyText.slice(0, 500),
        }, 'auth-server:api-seed-client:triggerSeedTenant - non-2xx response');
      }
    })
    .catch((err: unknown) => {
      const message = err instanceof Error ? err.message : String(err);
      log.warn({
        functionName,
        tenantId,
        error: message,
      }, 'auth-server:api-seed-client:triggerSeedTenant - request failed');
    })
    .finally(() => clearTimeout(timer));
}
