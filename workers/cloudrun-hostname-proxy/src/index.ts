/**
 * Proxies branlamie.com staging hostnames to Cloud Run *.run.app origins.
 *
 * Needed because australia-southeast1 does not support Cloud Run domain
 * mappings, and Cloudflare Free does not allow Origin Rule Host overrides.
 * fetch() to the run.app URL sets Host correctly for Cloud Run.
 */

const ORIGIN_BY_HOST: Record<string, string> = {
  "app-staging.branlamie.com":
    "frontend-981956656190.australia-southeast1.run.app",
  "auth-staging.branlamie.com":
    "auth-server-981956656190.australia-southeast1.run.app",
  "providers-staging.branlamie.com":
    "provider-server-981956656190.australia-southeast1.run.app",
};

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

function buildTargetUrl(requestUrl: URL, originHost: string): URL {
  const target = new URL(requestUrl.toString());
  target.protocol = "https:";
  target.hostname = originHost;
  target.port = "";
  return target;
}

function rewriteLocation(
  location: string,
  originHost: string,
  publicHost: string,
  targetBase: URL,
): string {
  try {
    const loc = new URL(location, targetBase);
    if (loc.hostname === originHost) {
      loc.hostname = publicHost;
      return loc.toString();
    }
  } catch {
    // leave as-is
  }
  return location;
}

export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const originHost = ORIGIN_BY_HOST[url.hostname];

    if (!originHost) {
      console.error(
        `[CloudRunHostnameProxy.fetch] unknown host=${url.hostname}`,
      );
      return new Response("Unknown hostname", { status: 404 });
    }

    const target = buildTargetUrl(url, originHost);
    const headers = new Headers();
    for (const [key, value] of request.headers.entries()) {
      if (HOP_BY_HOP.has(key.toLowerCase())) continue;
      headers.set(key, value);
    }
    headers.set("x-forwarded-host", url.hostname);
    headers.set("x-original-host", url.hostname);
    headers.set("x-forwarded-proto", "https");

    const init: RequestInit = {
      method: request.method,
      headers,
      redirect: "manual",
    };

    if (request.method !== "GET" && request.method !== "HEAD") {
      init.body = request.body;
      // Required when streaming a request body in Workers.
      (init as RequestInit & { duplex?: string }).duplex = "half";
    }

    try {
      const upstream = await fetch(target.toString(), init);
      const outHeaders = new Headers(upstream.headers);
      const location = outHeaders.get("location");
      if (location) {
        outHeaders.set(
          "location",
          rewriteLocation(location, originHost, url.hostname, target),
        );
      }

      return new Response(upstream.body, {
        status: upstream.status,
        statusText: upstream.statusText,
        headers: outHeaders,
      });
    } catch (error) {
      console.error(
        `[CloudRunHostnameProxy.fetch] upstream failed host=${url.hostname} origin=${originHost}`,
        error,
      );
      return new Response("Bad gateway", { status: 502 });
    }
  },
};
