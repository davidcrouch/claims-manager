type Input = Record<string, unknown>;
type Context = Record<string, unknown>;

let _client: Awaited<ReturnType<typeof _loadClient>> | null = null;
let _initPromise: Promise<Awaited<ReturnType<typeof _loadClient>>> | null = null;

async function _loadClient() {
  const { CapabilityClient } = await import("@more0ai/client");
  const client = new CapabilityClient({
    config: { registryUrl: process.env.REGISTRY_URL || "http://127.0.0.1:3201" },
  });
  await client.initialize();
  return client;
}

async function getClient() {
  if (_client) return _client;
  if (_initPromise) return _initPromise;
  _initPromise = _loadClient().then((c) => { _client = c; return c; });
  return _initPromise;
}

function parseTags(raw: unknown): string[] {
  return Array.isArray(raw) ? raw.map(String) : [];
}

function requireString(input: Input, key: string): string {
  const v = input[key];
  return typeof v === "string" ? v.trim() : "";
}

function optionalNumber(input: Input, key: string, fallback: number): number {
  const v = input[key];
  if (typeof v === "number" && !Number.isNaN(v)) return v;
  return fallback;
}

const LOG = "more0ai:registry";

export async function discover(input: Input, _context: Context) {
  try {
    const client = await getClient();
    const result = await client.discover({
      app: requireString(input, "app") || undefined,
      type: requireString(input, "type") || undefined,
      tags: parseTags(input.tags).length > 0 ? parseTags(input.tags) : undefined,
      query: requireString(input, "query") || undefined,
      page: input.page != null ? optionalNumber(input, "page", 1) : undefined,
      limit: input.limit != null ? optionalNumber(input, "limit", 20) : undefined,
    });
    return {
      capabilities: result.capabilities.map((c: any) => ({
        cap: c.cap,
        app: c.app,
        name: c.name,
        description: c.description,
        tags: c.tags,
        version: c.latestVersion,
      })),
      total: result.pagination.total,
      page: result.pagination.page,
      total_pages: result.pagination.totalPages,
    };
  } catch (err) {
    return { error: `${LOG}:discover - ${(err as Error).message}` };
  }
}

export async function health(_input: Input, _context: Context) {
  try {
    const client = await getClient();
    const result = await client.registryHealth();
    return {
      status: result.status,
      checks: result.checks,
      timestamp: result.timestamp,
    };
  } catch (err) {
    return { error: `${LOG}:health - ${(err as Error).message}` };
  }
}
