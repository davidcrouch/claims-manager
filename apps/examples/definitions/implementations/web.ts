// Helpers inlined so this file can run as the single entrypoint in the inline-ts runner (no ./client.js in exec dir).
type Input = Record<string, unknown>;
type Context = Record<string, unknown>;
function requireString(input: Input, key: string): string {
  const v = input[key];
  return typeof v === "string" ? v.trim() : "";
}
function optionalNumber(input: Input, key: string, fallback: number): number {
  const v = input[key];
  if (typeof v === "number" && !Number.isNaN(v)) return v;
  return fallback;
}

const LOG = "more0ai:web";
const DEFAULT_TIMEOUT_S = 30;
const MAX_TIMEOUT_S = 120;
const DEFAULT_MAX_RESPONSE = 1024 * 1024; // 1 MB
const MAX_RESPONSE_BYTES = 5 * 1024 * 1024; // 5 MB hard ceiling

export async function search(input: Input, _context: Context) {
  try {
    const query = requireString(input, "query");
    if (!query) {
      return { error: `${LOG}:search - 'query' is required` };
    }

    const numResults = Math.min(Math.max(optionalNumber(input, "num_results", 5), 1), 20);

    const searchApiUrl = process.env.SEARCH_API_URL;

    if (searchApiUrl) {
      return await searchWithCustomApi({ apiUrl: searchApiUrl, query, numResults });
    }

    return await searchWithDuckDuckGo({ query, numResults });
  } catch (err) {
    return { error: `${LOG}:search - ${(err as Error).message}` };
  }
}

async function searchWithDuckDuckGo(params: {
  query: string;
  numResults: number;
}) {
  const { query, numResults } = params;

  const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;
  const resp = await fetchWithTimeout({
    url,
    timeoutS: DEFAULT_TIMEOUT_S,
    fetchOpts: {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    },
  });
  const data = await resp.json();

  const results: Array<{ title: string; url: string; snippet: string }> = [];

  if (data.AbstractText && data.AbstractURL) {
    results.push({
      title: data.Heading || query,
      url: data.AbstractURL,
      snippet: data.AbstractText,
    });
  }

  if (Array.isArray(data.RelatedTopics)) {
    for (const topic of data.RelatedTopics) {
      if (results.length >= numResults) break;
      if (topic.FirstURL && topic.Text) {
        results.push({
          title: topic.Text.slice(0, 120),
          url: topic.FirstURL,
          snippet: topic.Text,
        });
      }
      if (Array.isArray(topic.Topics)) {
        for (const sub of topic.Topics) {
          if (results.length >= numResults) break;
          if (sub.FirstURL && sub.Text) {
            results.push({
              title: sub.Text.slice(0, 120),
              url: sub.FirstURL,
              snippet: sub.Text,
            });
          }
        }
      }
    }
  }

  return { results: results.slice(0, numResults), query, total: results.length };
}

async function searchWithCustomApi(params: {
  apiUrl: string;
  query: string;
  numResults: number;
}) {
  const { apiUrl, query, numResults } = params;

  const url = `${apiUrl}?q=${encodeURIComponent(query)}&format=json`;
  const resp = await fetchWithTimeout({ url, timeoutS: DEFAULT_TIMEOUT_S });
  const data = await resp.json();

  if (Array.isArray(data.results)) {
    const results = data.results.slice(0, numResults).map((r: any) => ({
      title: r.title || "",
      url: r.url || r.link || "",
      snippet: r.snippet || r.content || r.description || "",
    }));
    return { results, query, total: results.length };
  }

  return { results: [], query, total: 0 };
}

export async function fetch(input: Input, _context: Context) {
  try {
    const url = requireString(input, "url");
    if (!url) {
      return { error: `${LOG}:fetch - 'url' is required` };
    }

    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      return { error: `${LOG}:fetch - URL must start with http:// or https://` };
    }

    const method = (requireString(input, "method") || "GET").toUpperCase();
    const timeoutS = Math.min(Math.max(optionalNumber(input, "timeout", DEFAULT_TIMEOUT_S), 1), MAX_TIMEOUT_S);
    const maxResponseBytes = Math.min(
      Math.max(optionalNumber(input, "max_response_bytes", DEFAULT_MAX_RESPONSE), 0),
      MAX_RESPONSE_BYTES,
    );

    const headers: Record<string, string> = {};
    if (input.headers && typeof input.headers === "object" && !Array.isArray(input.headers)) {
      for (const [k, v] of Object.entries(input.headers as Record<string, unknown>)) {
        headers[k] = String(v);
      }
    }

    const bodyStr = requireString(input, "body") || undefined;

    const fetchOpts: RequestInit = { method, headers };
    if (bodyStr && ["POST", "PUT", "PATCH"].includes(method)) {
      fetchOpts.body = bodyStr;
    }

    const resp = await fetchWithTimeout({ url, timeoutS, fetchOpts });

    const contentType = resp.headers.get("content-type") || "";
    const respHeaders: Record<string, string> = {};
    resp.headers.forEach((v, k) => {
      respHeaders[k] = v;
    });

    const arrayBuf = await resp.arrayBuffer();
    let truncated = false;
    let body: string;

    if (arrayBuf.byteLength > maxResponseBytes) {
      body = new TextDecoder().decode(arrayBuf.slice(0, maxResponseBytes));
      truncated = true;
    } else {
      body = new TextDecoder().decode(arrayBuf);
    }

    return {
      status: resp.status,
      status_text: resp.statusText,
      headers: respHeaders,
      body,
      content_type: contentType,
      truncated,
    };
  } catch (err) {
    return { error: `${LOG}:fetch - ${(err as Error).message}` };
  }
}

async function fetchWithTimeout(params: {
  url: string;
  timeoutS: number;
  fetchOpts?: RequestInit;
}): Promise<Response> {
  const { url, timeoutS, fetchOpts = {} } = params;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutS * 1000);
  try {
    return await globalThis.fetch(url, { ...fetchOpts, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}
