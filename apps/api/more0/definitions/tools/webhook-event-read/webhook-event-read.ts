type Input = Record<string, unknown>;
type Context = Record<string, unknown>;

function readEnv(context: Context, key: string): string {
  const fromCtx = context[key];
  if (typeof fromCtx === 'string' && fromCtx.length > 0) return fromCtx;
  const fromEnv = (globalThis as { process?: { env?: Record<string, string | undefined> } })
    .process?.env?.[key];
  if (typeof fromEnv === 'string' && fromEnv.length > 0) return fromEnv;
  return '';
}

function isString(x: unknown): x is string {
  return typeof x === 'string' && x.length > 0;
}

/**
 * Sandbox tool: webhook-event-read
 *
 * Runs inside the More0 inline-ts sandbox. It calls the claims-manager API
 * endpoint POST /api/v1/webhook-tools/events/read with the event id.
 *
 * Expected `context` values (provided by the More0 runtime / app config):
 *   - CLAIMS_MANAGER_BASE_URL : base URL of the claims-manager API
 *   - TOOL_SECRET             : shared secret for X-Tool-Secret header
 */
export async function execute(
  input: Input,
  context: Context,
): Promise<Record<string, unknown>> {
  const logPrefix = 'webhook-event-read.execute';
  const eventId = input['eventId'];
  if (!isString(eventId)) {
    return { error: `${logPrefix} — invalid input: 'eventId' must be a non-empty string` };
  }

  const baseUrl = readEnv(context, 'CLAIMS_MANAGER_BASE_URL');
  const secret = readEnv(context, 'TOOL_SECRET');
  if (!baseUrl || !secret) {
    return {
      error: `${logPrefix} — missing context: CLAIMS_MANAGER_BASE_URL and TOOL_SECRET are required`,
    };
  }

  const url = `${baseUrl.replace(/\/$/, '')}/api/v1/webhook-tools/events/read`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Tool-Secret': secret,
    },
    body: JSON.stringify({ eventId }),
  });

  if (!res.ok) {
    const body = await res.text();
    return {
      error: `${logPrefix} — HTTP ${res.status}: ${body.slice(0, 500)}`,
    };
  }

  return (await res.json()) as Record<string, unknown>;
}
