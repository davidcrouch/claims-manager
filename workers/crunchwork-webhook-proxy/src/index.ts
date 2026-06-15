const PRIMARY_URL = "https://api.staging.branlamie.com/api/webhook";
const SECONDARY_URLS = ["https://api-dev.branlamie.com/api/webhook"];

export default {
  async fetch(request: Request): Promise<Response> {
    try {
      const body = await request.arrayBuffer();
      const headers = new Headers(request.headers);

      const primaryPromise = fetch(PRIMARY_URL, {
        method: request.method,
        headers,
        body,
        redirect: "manual",
      });

      for (const url of SECONDARY_URLS) {
        fetch(url, {
          method: request.method,
          headers,
          body,
          redirect: "manual",
        }).catch((err) =>
          console.error(`[WebhookProxy.fetch] secondary target failed: ${url}`, err),
        );
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
