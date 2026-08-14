// Primary: api-server via GCP HTTPS LB (grey-cloud DNS → LB → Cloud Run).
// The CF Worker intercepts providers-staging.branlamie.com/api/v1/webhooks/crunchwork
// (orange-cloud DNS) and forwards through the LB to api-server's webhook endpoint.
const PRIMARY_URL =
  "https://api-staging.branlamie.com/api/v1/webhooks/crunchwork";

// Secondary: dev tunnel for local dual-delivery during development.
const SECONDARY_URLS = [
  "https://api-dev.branlamie.com/api/v1/webhooks/crunchwork",
];

const HOP_BY_HOP = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailers",
  "transfer-encoding",
  "upgrade",
  "host",
  "cf-connecting-ip",
  "cf-ipcountry",
  "cf-ray",
  "cf-visitor",
  "cdn-loop",
]);

function forwardHeaders(request: Request): Headers {
  const headers = new Headers();
  for (const [key, value] of request.headers.entries()) {
    if (HOP_BY_HOP.has(key.toLowerCase())) continue;
    headers.set(key, value);
  }
  return headers;
}

function hasRequestBody(method: string): boolean {
  const m = method.toUpperCase();
  return m !== "GET" && m !== "HEAD";
}

export default {
  async fetch(
    request: Request,
    _env: unknown,
    ctx: ExecutionContext,
  ): Promise<Response> {
    try {
      const headers = forwardHeaders(request);
      const body = hasRequestBody(request.method)
        ? await request.arrayBuffer()
        : undefined;

      const init: RequestInit = {
        method: request.method,
        headers,
        redirect: "manual",
      };
      if (body !== undefined) {
        init.body = body;
      }

      const primaryPromise = fetch(PRIMARY_URL, init);

      for (const url of SECONDARY_URLS) {
        const secondary = fetch(url, init)
          .then(async (res) => {
            if (!res.ok) {
              console.error(
                `[WebhookProxy.fetch] secondary target non-OK: ${url} status=${res.status}`,
              );
            } else {
              console.log(
                `[WebhookProxy.fetch] secondary ok: ${url} status=${res.status}`,
              );
            }
          })
          .catch((err) =>
            console.error(
              `[WebhookProxy.fetch] secondary target failed: ${url}`,
              err,
            ),
          );
        ctx.waitUntil(secondary);
      }

      const response = await primaryPromise;
      return response;
    } catch (error) {
      console.error("[WebhookProxy.fetch] primary target failed", error);

      return new Response(
        JSON.stringify({
          success: false,
          message: "Webhook proxy failed",
        }),
        {
          status: 500,
          headers: {
            "Content-Type": "application/json",
          },
        },
      );
    }
  },
};
