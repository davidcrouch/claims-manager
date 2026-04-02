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

const LOG = "more0ai:apps";

const REGISTRY_CAP = "more0ai/system.registry";

function getAccessToken(ctx: Context): string | undefined {
  const t = ctx?.accessToken;
  return typeof t === "string" && t.trim() ? t : undefined;
}

function getTenantId(ctx: Context): string | undefined {
  const t = ctx?.tenantId;
  return typeof t === "string" && t.trim() ? t : undefined;
}

function getRegistryCtx(ctx: Context): Record<string, string | undefined> {
  return { accessToken: getAccessToken(ctx), tenantId: getTenantId(ctx) };
}

export async function create(input: Input, _context: Context) {
  const appKey = requireString(input, "app_key");
  const displayName = requireString(input, "display_name") || undefined;

  if (!appKey) {
    return { error: `${LOG}:create - app_key is required` };
  }

  try {
    const client = await getClient();
    const createParams = { app_key: appKey, display_name: displayName };
    const registryCtx = getRegistryCtx(_context);
    let result: { app_key: string; id: string };
    if (registryCtx.accessToken) {
      const res = await client.invoke(REGISTRY_CAP, { method: "createApp", params: createParams }, registryCtx);
      if (!res.ok) throw new Error(res.error?.message ?? "registry createApp failed");
      result = res.data as typeof result;
    } else {
      result = await client.createApp(createParams);
    }
    return { app_key: result.app_key, id: result.id };
  } catch (err) {
    return { error: `${LOG}:create - ${(err as Error).message}` };
  }
}

export async function list(_input: Input, _context: Context) {
  try {
    const client = await getClient();
    const result = await client.listApps();
    return {
      apps: result.applications.map((a: any) => ({
        app_key: a.app_key,
        name: a.name,
        status: a.status,
        created_at: a.created_at,
      })),
    };
  } catch (err) {
    return { error: `${LOG}:list - ${(err as Error).message}` };
  }
}
