/**
 * E2E client: dispatch an inbound_webhook_events row through the More0
 * `claims-manager-webhook.process-inbound-event` workflow via the HTTP
 * gateway. Mirrors the pattern in
 * `capabilities/apps/client-tests/stream-http-gateway/client.ts`.
 *
 * Prerequisites:
 *   - More0 HTTP gateway running (GATEWAY_URL, default http://localhost:3205)
 *   - Registry + workers up and the app/workflow/tools imported
 *   - The claims-manager API running and reachable at CLAIMS_MANAGER_BASE_URL
 *     with TOOL_SECRET matching MORE0_TOOL_SECRET
 *   - An existing inbound_webhook_events row ID to process (EVENT_ID)
 *
 * Run (host):
 *   $env:GATEWAY_URL="http://localhost:3205"
 *   $env:EVENT_ID="<uuid of inbound_webhook_events row>"
 *   pnpm --filter api exec tsx apps/api/more0/client-test/invoke-webhook-workflow.ts
 */

const LOG_PREFIX = 'claims-manager-webhook-client-test';

const GATEWAY_URL = process.env.GATEWAY_URL ?? 'http://localhost:3205';
const ORG_ID =
  process.env.MORE0_ORGANIZATION_ID ?? 'claims-manager-webhook';
const CAP =
  'claims-manager-webhook/workflow.claims-manager-webhook.process-inbound-event';
const METHOD = 'execute';

const EVENT_ID = process.env.EVENT_ID;

interface InvokeResponse {
  runId?: string;
  status?: string;
  data?: unknown;
  [key: string]: unknown;
}

async function invoke(params: {
  cap: string;
  method: string;
  params: Record<string, unknown>;
}): Promise<InvokeResponse> {
  const url = `${GATEWAY_URL}/api/v1/invoke`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'x-organization-id': ORG_ID,
    },
    body: JSON.stringify({
      cap: params.cap,
      method: params.method,
      params: params.params,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${LOG_PREFIX}:invoke — HTTP ${res.status}: ${text.slice(0, 500)}`);
  }

  return (await res.json()) as InvokeResponse;
}

async function main(): Promise<void> {
  if (!EVENT_ID) {
    throw new Error(
      `${LOG_PREFIX}:main — EVENT_ID env var is required (id of an inbound_webhook_events row)`,
    );
  }

  console.log(`${LOG_PREFIX}:main — GATEWAY_URL=${GATEWAY_URL} ORG=${ORG_ID}`);
  console.log(`${LOG_PREFIX}:main — CAP=${CAP} METHOD=${METHOD} EVENT_ID=${EVENT_ID}`);

  const result = await invoke({
    cap: CAP,
    method: METHOD,
    params: { eventId: EVENT_ID },
  });

  console.log(
    `${LOG_PREFIX}:main — response runId=${result.runId ?? 'n/a'} status=${result.status ?? 'n/a'}`,
  );
  console.log(`${LOG_PREFIX}:main — full response: ${JSON.stringify(result, null, 2)}`);
  console.log(`${LOG_PREFIX}:main — Done`);
}

main().catch((err) => {
  console.error(`${LOG_PREFIX}:main — Fatal:`, err);
  process.exit(1);
});
