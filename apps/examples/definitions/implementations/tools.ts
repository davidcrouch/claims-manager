type Input = Record<string, unknown>;
type Context = Record<string, unknown>;

interface VersionInput { major: number; minor: number; patch: number; }

let _client: Awaited<ReturnType<typeof _loadClient>> | null = null;
let _initPromise: Promise<Awaited<ReturnType<typeof _loadClient>>> | null = null;

async function _loadClient() {
  const { CapabilityClient } = await import("@more0ai/client");
  const client = new CapabilityClient({
    config: {
      registryUrl: process.env.REGISTRY_URL || "http://127.0.0.1:3201",
      defaultTenantId: "more0ai",
    },
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

function parseVersion(raw: unknown): VersionInput {
  if (raw && typeof raw === "object") {
    const v = raw as Record<string, unknown>;
    return { major: Number(v.major) || 1, minor: Number(v.minor) || 0, patch: Number(v.patch) || 0 };
  }
  return { major: 1, minor: 0, patch: 0 };
}

function parseTags(raw: unknown): string[] {
  return Array.isArray(raw) ? raw.map(String) : [];
}

function requireString(input: Input, key: string): string {
  const v = input[key];
  return typeof v === "string" ? v.trim() : "";
}

const LOG = "more0ai:tools";

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

function mapMethodDefs(raw: unknown): Array<{
  name: string;
  description?: string;
  semantics?: string;
  inputSchema?: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
}> {
  if (!Array.isArray(raw)) return [];
  return raw.map((m: any) => ({
    name: String(m.name || ""),
    description: m.description ? String(m.description) : undefined,
    semantics: m.semantics ? String(m.semantics) : "work",
    inputSchema: m.input_schema ?? m.inputSchema ?? undefined,
    outputSchema: m.output_schema ?? m.outputSchema ?? undefined,
  }));
}

export async function create(input: Input, _context: Context) {
  const app = requireString(input, "app");
  const name = requireString(input, "name");
  const description = requireString(input, "description");
  const methods = mapMethodDefs(input.methods);
  const tags = parseTags(input.tags);
  const version = parseVersion(input.version);

  if (!app || !name || methods.length === 0) {
    return { error: `${LOG}:create - app, name, and at least one method are required` };
  }

  try {
    const client = await getClient();
    const upsertParams = {
      app,
      name,
      type: "tool",
      description,
      tags,
      version,
      methods: methods.map((m) => ({
        name: m.name,
        description: m.description,
        semantics: m.semantics,
        inputSchema: m.inputSchema,
        outputSchema: m.outputSchema,
        channels: ["sync"],
      })),
    };

    const registryCtx = getRegistryCtx(_context);
    const res = await client.invoke(REGISTRY_CAP, { method: "upsert", params: upsertParams }, registryCtx);
    if (!res.ok) throw new Error((res.error as any)?.message ?? "registry upsert failed");
    const result = res.data as { cap: string; version: string; action: string };

    return { cap: result.cap, name, version: result.version, action: result.action };
  } catch (err) {
    return { error: `${LOG}:create - ${(err as Error).message}` };
  }
}

export async function get(input: Input, _context: Context) {
  const name = requireString(input, "name");
  if (!name) return { error: `${LOG}:get - name is required` };

  try {
    const client = await getClient();
    const registryCtx = getRegistryCtx(_context);
    const res = await client.invoke(REGISTRY_CAP, { method: "describe", params: { cap: name } }, registryCtx);
    if (!res.ok) throw new Error((res.error as any)?.message ?? "registry describe failed");
    const result = res.data as Record<string, unknown>;
    return {
      cap: result.cap,
      name: result.name,
      description: result.description,
      version: result.version,
      tags: result.tags,
      methods: result.methods,
    };
  } catch (err) {
    return { error: `${LOG}:get - ${(err as Error).message}` };
  }
}

export async function list(input: Input, _context: Context) {
  try {
    const client = await getClient();
    const registryCtx = getRegistryCtx(_context);
    const discoverParams: Record<string, unknown> = { type: "tool" };
    const app = requireString(input, "app");
    if (app) discoverParams.app = app;
    const tags = parseTags(input.tags);
    if (tags.length > 0) discoverParams.tags = tags;
    const query = requireString(input, "query");
    if (query) discoverParams.query = query;

    const res = await client.invoke(REGISTRY_CAP, { method: "discover", params: discoverParams }, registryCtx);
    if (!res.ok) throw new Error((res.error as any)?.message ?? "registry discover failed");
    const result = res.data as { capabilities: any[]; pagination: { total: number } };
    return {
      tools: result.capabilities.map((c: any) => ({
        cap: c.cap,
        name: c.name,
        description: c.description,
        tags: c.tags,
        version: c.latestVersion,
      })),
      total: result.pagination.total,
    };
  } catch (err) {
    return { error: `${LOG}:list - ${(err as Error).message}` };
  }
}

export async function update(input: Input, _context: Context) {
  const app = requireString(input, "app");
  const name = requireString(input, "name");
  if (!app || !name) return { error: `${LOG}:update - app and name are required` };

  try {
    const client = await getClient();
    const registryCtx = getRegistryCtx(_context);

    const descRes = await client.invoke(REGISTRY_CAP, { method: "describe", params: { cap: `${app}/${name}` } }, registryCtx);
    if (!descRes.ok) throw new Error((descRes.error as any)?.message ?? "registry describe failed");
    const current = descRes.data as Record<string, any>;

    const description = requireString(input, "description") || current.description || "";
    const tags = parseTags(input.tags).length > 0 ? parseTags(input.tags) : current.tags;

    const methods = Array.isArray(input.methods) && input.methods.length > 0
      ? mapMethodDefs(input.methods).map((m) => ({
          name: m.name,
          description: m.description,
          semantics: m.semantics,
          inputSchema: m.inputSchema,
          outputSchema: m.outputSchema,
          channels: ["sync"] as string[],
        }))
      : (current.methods ?? []).map((m: any) => ({
          name: m.name,
          description: m.description,
          semantics: m.semantics,
          inputSchema: m.inputSchema,
          outputSchema: m.outputSchema,
          channels: m.channels,
          tags: m.tags,
        }));

    const vParts = (current.version || "1.0.0").split(".").map(Number);
    const version = { major: vParts[0] || 1, minor: vParts[1] || 0, patch: (vParts[2] || 0) + 1 };

    const upsertParams = {
      app,
      name,
      type: "tool",
      description,
      tags,
      version,
      methods,
    };

    const res = await client.invoke(REGISTRY_CAP, { method: "upsert", params: upsertParams }, registryCtx);
    if (!res.ok) throw new Error((res.error as any)?.message ?? "registry upsert failed");
    const result = res.data as { cap: string; version: string; action: string };

    return { cap: result.cap, name, version: result.version, action: result.action };
  } catch (err) {
    return { error: `${LOG}:update - ${(err as Error).message}` };
  }
}

async function deleteTool(input: Input, _context: Context) {
  const name = requireString(input, "name");
  const reason = requireString(input, "reason");
  if (!name || !reason) return { error: `${LOG}:delete - name and reason are required` };

  try {
    const client = await getClient();
    const registryCtx = getRegistryCtx(_context);
    const res = await client.invoke(REGISTRY_CAP, { method: "deprecate", params: { cap: name, reason } }, registryCtx);
    if (!res.ok) throw new Error((res.error as any)?.message ?? "registry deprecate failed");
    const result = res.data as { success: boolean; affectedVersions: string[] };
    return { success: result.success, affected_versions: result.affectedVersions };
  } catch (err) {
    return { error: `${LOG}:delete - ${(err as Error).message}` };
  }
}

export { deleteTool as delete };
