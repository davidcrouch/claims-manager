// Primary: Cloud Run origin directly (bypasses Cloudflare Workers on same zone).
// The public path /api/v1/webhooks/crunchwork is intercepted by this Worker,
// so staging receives on the internal path instead.
const PRIMARY_URL =
  "https://provider-server-981956656190.australia-southeast1.run.app/api/v1/internal/webhooks/crunchwork";

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

export default {
  async fetch(
    request: Request,
    _env: unknown,
    ctx: ExecutionContext,
  ): Promise<Response> {
    try {
      const body = await request.arrayBuffer();
      const headers = forwardHeaders(request);

      const primaryPromise = fetch(PRIMARY_URL, {
        method: request.method,
        headers,
        body,
        redirect: "manual",
      });

      for (const url of SECONDARY_URLS) {
        const secondary = fetch(url, {
          method: request.method,
          headers,
          body,
          redirect: "manual",
        })
          .then(async (res) => {
            if (!res.ok) {
              console.error(
                `[WebhookProxy.fetch] secondary target non-OK: ${url} status=${res.status}`,
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
