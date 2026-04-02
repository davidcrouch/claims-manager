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

function requireString(input: Input, key: string): string {
  const v = input[key];
  return typeof v === "string" ? v.trim() : "";
}

function optionalNumber(input: Input, key: string, fallback: number): number {
  const v = input[key];
  if (typeof v === "number" && !Number.isNaN(v)) return v;
  return fallback;
}

const LOG = "more0ai:intent";

export async function search(input: Input, _context: Context) {
  const intent = requireString(input, "intent");
  if (!intent || intent.length < 3) {
    return { error: `${LOG}:search - intent is required and must be at least 3 characters` };
  }

  try {
    const client = await getClient();
    const result = await client.invoke("system.registry", {
      method: "intent-search",
      params: {
        intent,
        type: requireString(input, "type") || undefined,
        limit: input.limit != null ? optionalNumber(input, "limit", 6) : undefined,
      },
    });

    if (!result.ok) {
      return { error: result.error?.message || `${LOG}:search - intent search failed` };
    }

    const methods = result.data?.methods || [];
    return {
      tools_found: methods.length,
      tools: methods.map((m: any) => ({
        ref: m.ref,
        description: m.description || "",
        similarity: m.similarity,
      })),
      message: methods.length > 0
        ? `Found ${methods.length} relevant tool(s). They have been added to your available tools.`
        : "No relevant tools found for this intent. Try rephrasing or broadening your description.",
    };
  } catch (err) {
    return { error: `${LOG}:search - ${(err as Error).message}` };
  }
}

export async function health(input: Input, _context: Context) {
  try {
    const client = await getClient();
    const result = await client.invoke("system.registry", {
      method: "health",
      params: {},
    });
    return result.data || { status: "unknown" };
  } catch (err) {
    return { error: `${LOG}:health - ${(err as Error).message}` };
  }
}
