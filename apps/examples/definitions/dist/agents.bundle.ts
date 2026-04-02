// definitions/implementations/agents.ts
var _client = null;
var _initPromise = null;
async function _loadClient() {
  const { CapabilityClient } = await import("@more0ai/client");
  const client = new CapabilityClient({
    config: { registryUrl: process.env.REGISTRY_URL || "http://127.0.0.1:3201" }
  });
  await client.initialize();
  return client;
}
async function getClient() {
  if (_client) return _client;
  if (_initPromise) return _initPromise;
  _initPromise = _loadClient().then((c) => {
    _client = c;
    return c;
  });
  return _initPromise;
}
function parseVersion(raw) {
  if (raw && typeof raw === "object") {
    const v = raw;
    return { major: Number(v.major) || 1, minor: Number(v.minor) || 0, patch: Number(v.patch) || 0 };
  }
  return { major: 1, minor: 0, patch: 0 };
}
function parseTags(raw) {
  return Array.isArray(raw) ? raw.map(String) : [];
}
function requireString(input, key) {
  const v = input[key];
  return typeof v === "string" ? v.trim() : "";
}
function optionalNumber(input, key, fallback) {
  const v = input[key];
  if (typeof v === "number" && !Number.isNaN(v)) return v;
  return fallback;
}
var LOG = "more0ai:agents";
var REGISTRY_CAP = "more0ai/system.registry";
function getAccessToken(ctx) {
  const t = ctx?.accessToken;
  return typeof t === "string" && t.trim() ? t : void 0;
}
function getTenantId(ctx) {
  const t = ctx?.tenantId;
  return typeof t === "string" && t.trim() ? t : void 0;
}
function getRegistryCtx(ctx) {
  return { accessToken: getAccessToken(ctx), tenantId: getTenantId(ctx) };
}
async function create(input, _context) {
  const app = requireString(input, "app");
  const name = requireString(input, "name");
  const description = requireString(input, "description");
  const promptRef = requireString(input, "prompt_ref");
  const modelRef = requireString(input, "model_ref");
  const tools = Array.isArray(input.tools) ? input.tools.map(String) : [];
  const toolChoice = requireString(input, "tool_choice") || "auto";
  const maxToolIterations = optionalNumber(input, "max_tool_iterations", 5);
  const temperature = input.temperature != null ? optionalNumber(input, "temperature", 0.7) : void 0;
  const tags = parseTags(input.tags);
  const version = parseVersion(input.version);
  if (!app || !name || !promptRef || !modelRef) {
    return { error: `${LOG}:create - app, name, prompt_ref, and model_ref are required` };
  }
  try {
    const client = await getClient();
    const agentMetadata = {
      prompt: promptRef,
      model: modelRef,
      tools,
      tool_loop_config: {
        max_iterations: maxToolIterations,
        max_concurrency: 1,
        tool_choice: toolChoice
      }
    };
    if (temperature != null) {
      agentMetadata.config = { temperature };
    }
    const upsertParams = {
      app,
      name,
      type: "agent",
      description,
      tags,
      version: { ...version, metadata: agentMetadata },
      methods: [
        {
          name: "execute",
          description: `Invoke the ${name} agent with a user message`,
          semantics: "work",
          inputSchema: {
            type: "object",
            properties: {
              userMessage: { type: "string", description: "User message or question" }
            }
          },
          outputSchema: {
            type: "object",
            properties: {
              content: { type: "string" },
              finish_reason: { type: "string" },
              usage: { type: "object" }
            }
          },
          channels: ["sync"]
        }
      ],
      setAsDefault: true
    };
    let result;
    const registryCtx = getRegistryCtx(_context);
    if (registryCtx.accessToken) {
      const res = await client.invoke(REGISTRY_CAP, { method: "upsert", params: upsertParams }, registryCtx);
      if (!res.ok) {
        throw new Error(res.error?.message ?? "registry upsert failed");
      }
      result = res.data;
    } else {
      result = await client.upsert(upsertParams);
    }
    return { cap: result.cap, name, version: result.version, action: result.action };
  } catch (err) {
    return { error: `${LOG}:create - ${err.message}` };
  }
}
async function get(input, _context) {
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
      methods: result.methods
    };
  } catch (err) {
    return { error: `${LOG}:get - ${err.message}` };
  }
}
async function list(input, _context) {
  try {
    const client = await getClient();
    const result = await client.discover({
      type: "agent",
      app: requireString(input, "app") || void 0,
      tags: parseTags(input.tags).length > 0 ? parseTags(input.tags) : void 0,
      query: requireString(input, "query") || void 0
    });
    return {
      agents: result.capabilities.map((c) => ({
        cap: c.cap,
        name: c.name,
        description: c.description,
        tags: c.tags,
        version: c.latestVersion
      })),
      total: result.pagination.total
    };
  } catch (err) {
    return { error: `${LOG}:list - ${err.message}` };
  }
}
async function update(input, _context) {
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
    const agentMetadata = {};
    const promptRef = requireString(input, "prompt_ref");
    const modelRef = requireString(input, "model_ref");
    if (promptRef) agentMetadata.prompt = promptRef;
    if (modelRef) agentMetadata.model = modelRef;
    if (Array.isArray(input.tools)) agentMetadata.tools = input.tools.map(String);
    const toolChoice = requireString(input, "tool_choice");
    if (toolChoice) {
      agentMetadata.tool_loop_config = {
        tool_choice: toolChoice,
        max_iterations: optionalNumber(input, "max_tool_iterations", 5),
        max_concurrency: 1
      };
    }
    if (input.temperature != null) {
      agentMetadata.config = { temperature: optionalNumber(input, "temperature", 0.7) };
    }
    const upsertParams = {
      app,
      name,
      type: "agent",
      description,
      tags,
      version: { ...version, metadata: Object.keys(agentMetadata).length > 0 ? agentMetadata : void 0 },
      methods: current.methods.map((m) => ({
        name: m.name,
        description: m.description,
        semantics: m.semantics,
        inputSchema: m.inputSchema,
        outputSchema: m.outputSchema,
        channels: m.channels,
        tags: m.tags
      })),
      setAsDefault: true
    };
    let result;
    const registryCtx = getRegistryCtx(_context);
    if (registryCtx.accessToken) {
      const res = await client.invoke(REGISTRY_CAP, { method: "upsert", params: upsertParams }, registryCtx);
      if (!res.ok) throw new Error(res.error?.message ?? "registry upsert failed");
      result = res.data;
    } else {
      result = await client.upsert(upsertParams);
    }
    return { cap: result.cap, name, version: result.version, action: result.action };
  } catch (err) {
    return { error: `${LOG}:update - ${err.message}` };
  }
}
async function deleteAgent(input, _context) {
  const name = requireString(input, "name");
  const reason = requireString(input, "reason");
  if (!name || !reason) return { error: `${LOG}:delete - name and reason are required` };
  try {
    const client = await getClient();
    const registryCtx = getRegistryCtx(_context);
    let result;
    if (registryCtx.accessToken) {
      const res = await client.invoke(REGISTRY_CAP, { method: "deprecate", params: { cap: name, reason } }, registryCtx);
      if (!res.ok) throw new Error(res.error?.message ?? "registry deprecate failed");
      result = res.data;
    } else {
      result = await client.deprecate({ cap: name, reason });
    }
    return { success: result.success, affected_versions: result.affectedVersions };
  } catch (err) {
    return { error: `${LOG}:delete - ${err.message}` };
  }
}
export {
  create,
  deleteAgent as delete,
  get,
  list,
  update
};
