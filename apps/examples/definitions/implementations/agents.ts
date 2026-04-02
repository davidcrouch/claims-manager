type Input = Record<string, unknown>;
type Context = Record<string, unknown>;

interface VersionInput { major: number; minor: number; patch: number; }

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

function optionalNumber(input: Input, key: string, fallback: number): number {
  const v = input[key];
  if (typeof v === "number" && !Number.isNaN(v)) return v;
  return fallback;
}

const LOG = "more0ai:agents";

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
  const app = requireString(input, "app");
  const name = requireString(input, "name");
  const description = requireString(input, "description");
  const promptRef = requireString(input, "prompt_ref");
  const modelRef = requireString(input, "model_ref");
  const tools = Array.isArray(input.tools) ? input.tools.map(String) : [];
  const toolChoice = requireString(input, "tool_choice") || "auto";
  const maxToolIterations = optionalNumber(input, "max_tool_iterations", 5);
  const temperature = input.temperature != null ? optionalNumber(input, "temperature", 0.7) : undefined;
  const tags = parseTags(input.tags);
  const version = parseVersion(input.version);

  if (!app || !name || !promptRef || !modelRef) {
    return { error: `${LOG}:create - app, name, prompt_ref, and model_ref are required` };
  }

  try {
    const client = await getClient();

    const agentManifest: Record<string, unknown> = {
      prompt: promptRef,
      model: modelRef,
      tools,
      tool_loop_config: {
        max_iterations: maxToolIterations,
        max_concurrency: 1,
        tool_choice: toolChoice,
      },
    };
    if (temperature != null) {
      agentManifest.config = { temperature };
    }

    const upsertParams = {
      app,
      name,
      type: "agent",
      description,
      tags,
      version,
      manifest: agentManifest,
      methods: [
        {
          name: "execute",
          description: `Invoke the ${name} agent with a user message`,
          semantics: "work",
          inputSchema: {
            type: "object",
            properties: {
              userMessage: { type: "string", description: "User message or question" },
            },
          },
          outputSchema: {
            type: "object",
            properties: {
              content: { type: "string" },
              finish_reason: { type: "string" },
              usage: { type: "object" },
            },
          },
          channels: ["sync"],
        },
      ],
      setAsDefault: true,
    };

    let result: { cap: string; version: string; action: string };
    const registryCtx = getRegistryCtx(_context);
    if (registryCtx.accessToken) {
      const res = await client.invoke(REGISTRY_CAP, { method: "upsert", params: upsertParams }, registryCtx);
      if (!res.ok) {
        throw new Error(res.error?.message ?? "registry upsert failed");
      }
      result = res.data as typeof result;
    } else {
      result = await client.upsert(upsertParams);
    }

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
    const result = await client.describe(name);
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
    const result = await client.discover({
      type: "agent",
      app: requireString(input, "app") || undefined,
      tags: parseTags(input.tags).length > 0 ? parseTags(input.tags) : undefined,
      query: requireString(input, "query") || undefined,
    });
    return {
      agents: result.capabilities.map((c: any) => ({
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
    const current = await client.describe(name);

    const description = requireString(input, "description") || current.description || "";
    const tags = parseTags(input.tags).length > 0 ? parseTags(input.tags) : current.tags;

    const vParts = current.version.split(".").map(Number);
    const version = { major: vParts[0] || 1, minor: vParts[1] || 0, patch: (vParts[2] || 0) + 1 };

    const agentManifest: Record<string, unknown> = {};
    const promptRef = requireString(input, "prompt_ref");
    const modelRef = requireString(input, "model_ref");
    if (promptRef) agentManifest.prompt = promptRef;
    if (modelRef) agentManifest.model = modelRef;
    if (Array.isArray(input.tools)) agentManifest.tools = input.tools.map(String);
    const toolChoice = requireString(input, "tool_choice");
    if (toolChoice) {
      agentManifest.tool_loop_config = {
        tool_choice: toolChoice,
        max_iterations: optionalNumber(input, "max_tool_iterations", 5),
        max_concurrency: 1,
      };
    }
    if (input.temperature != null) {
      agentManifest.config = { temperature: optionalNumber(input, "temperature", 0.7) };
    }

    const upsertParams = {
      app,
      name,
      type: "agent",
      description,
      tags,
      version,
      manifest: Object.keys(agentManifest).length > 0 ? agentManifest : undefined,
      methods: current.methods.map((m: any) => ({
        name: m.name,
        description: m.description,
        semantics: m.semantics,
        inputSchema: m.inputSchema,
        outputSchema: m.outputSchema,
        channels: m.channels,
        tags: m.tags,
      })),
      setAsDefault: true,
    };

    let result: { cap: string; version: string; action: string };
    const registryCtx = getRegistryCtx(_context);
    if (registryCtx.accessToken) {
      const res = await client.invoke(REGISTRY_CAP, { method: "upsert", params: upsertParams }, registryCtx);
      if (!res.ok) throw new Error(res.error?.message ?? "registry upsert failed");
      result = res.data as typeof result;
    } else {
      result = await client.upsert(upsertParams);
    }

    return { cap: result.cap, name, version: result.version, action: result.action };
  } catch (err) {
    return { error: `${LOG}:update - ${(err as Error).message}` };
  }
}

async function deleteAgent(input: Input, _context: Context) {
  const name = requireString(input, "name");
  const reason = requireString(input, "reason");
  if (!name || !reason) return { error: `${LOG}:delete - name and reason are required` };

  try {
    const client = await getClient();
    const registryCtx = getRegistryCtx(_context);
    let result: { success: boolean; affectedVersions: string[] };
    if (registryCtx.accessToken) {
      const res = await client.invoke(REGISTRY_CAP, { method: "deprecate", params: { cap: name, reason } }, registryCtx);
      if (!res.ok) throw new Error(res.error?.message ?? "registry deprecate failed");
      result = res.data as typeof result;
    } else {
      result = await client.deprecate({ cap: name, reason });
    }
    return { success: result.success, affected_versions: result.affectedVersions };
  } catch (err) {
    return { error: `${LOG}:delete - ${(err as Error).message}` };
  }
}

export { deleteAgent as delete };
