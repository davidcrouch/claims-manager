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
 * Sandbox tool: entity-mapper
 * Calls POST /api/v1/webhook-tools/mappers/:entityType on the claims-manager API.
 */
export async function execute(
  input: Input,
  context: Context,
): Promise<Record<string, unknown>> {
  const logPrefix = 'entity-mapper.execute';
  const externalObjectId = input['externalObjectId'];
  const tenantId = input['tenantId'];
  const connectionId = input['connectionId'];
  const entityType = input['entityType'];
  if (
    !isString(externalObjectId) ||
    !isString(tenantId) ||
    !isString(connectionId) ||
    !isString(entityType)
  ) {
    return {
      error: `${logPrefix} — invalid input: externalObjectId, tenantId, connectionId, entityType required`,
    };
  }

  const baseUrl = readEnv(context, 'CLAIMS_MANAGER_BASE_URL');
  const secret = readEnv(context, 'TOOL_SECRET');
  if (!baseUrl || !secret) {
    return {
      error: `${logPrefix} — missing context: CLAIMS_MANAGER_BASE_URL and TOOL_SECRET are required`,
    };
  }

  const url = `${baseUrl.replace(/\/$/, '')}/api/v1/webhook-tools/mappers/${encodeURIComponent(entityType)}`;
  const processingLogId = input['processingLogId'];
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Tool-Secret': secret },
    body: JSON.stringify({
      externalObjectId,
      tenantId,
      connectionId,
      processingLogId: isString(processingLogId) ? processingLogId : undefined,
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    return { error: `${logPrefix} — HTTP ${res.status}: ${body.slice(0, 500)}` };
  }
  return (await res.json()) as Record<string, unknown>;
}
