// Temporarily prefer local/dev so Crunchwork gets the tunnel response.
// Staging fan-out paused — restore providers-staging as PRIMARY when ready.
const PRIMARY_URL = "https://api-dev.branlamie.com/api/webhook";
const SECONDARY_URLS: string[] = [];
// const SECONDARY_URLS = ["https://providers-staging.branlamie.com/api/webhook"];

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
