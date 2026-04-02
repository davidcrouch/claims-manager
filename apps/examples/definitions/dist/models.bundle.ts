// definitions/implementations/models.ts
var _client = null;
var _initPromise = null;
async function _loadClient() {
  const { CapabilityClient } = await import("@more0ai/client");
  const client = new CapabilityClient({
    config: {
      registryUrl: process.env.REGISTRY_URL || "http://127.0.0.1:3201",
      defaultTenantId: "more0ai"
    }
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
var LOG = "more0ai:models";
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
  const providerRef = requireString(input, "provider_ref");
  const modelId = requireString(input, "model_id");
  const temperature = optionalNumber(input, "temperature", 0.7);
  const maxTokens = optionalNumber(input, "max_tokens", 1024);
  const timeout = optionalNumber(input, "timeout", 60);
  const tags = parseTags(input.tags);
  const version = parseVersion(input.version);
  if (!app || !name || !providerRef || !modelId) {
    return { error: `${LOG}:create - app, name, provider_ref, and model_id are required` };
  }
  try {
    const client = await getClient();
    const upsertParams = {
      app,
      name,
      type: "model",
      description,
      tags,
      version,
      methods: [
        {
          name: "info",
          description: "Get model configuration and parameters",
          semantics: "informational",
          outputSchema: {
            type: "object",
            properties: {
              name: { type: "string" },
              providerRef: { type: "string" },
              modelId: { type: "string" },
              llm: { type: "string" },
              parameters: { type: "object" }
            }
          }
        }
      ]
    };
    const registryCtx = getRegistryCtx(_context);
    const res = await client.invoke(REGISTRY_CAP, { method: "upsert", params: upsertParams }, registryCtx);
    if (!res.ok) throw new Error(res.error?.message ?? "registry upsert failed");
    const result = res.data;
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
    const registryCtx = getRegistryCtx(_context);
    const res = await client.invoke(REGISTRY_CAP, { method: "describe", params: { cap: name } }, registryCtx);
    if (!res.ok) throw new Error(res.error?.message ?? "registry describe failed");
    const result = res.data;
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
    const registryCtx = getRegistryCtx(_context);
    const discoverParams = { type: "model" };
    const app = requireString(input, "app");
    if (app) discoverParams.app = app;
    const tags = parseTags(input.tags);
    if (tags.length > 0) discoverParams.tags = tags;
    const query = requireString(input, "query");
    if (query) discoverParams.query = query;
    const res = await client.invoke(REGISTRY_CAP, { method: "discover", params: discoverParams }, registryCtx);
    if (!res.ok) throw new Error(res.error?.message ?? "registry discover failed");
    const result = res.data;
    return {
      models: result.capabilities.map((c) => ({
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
    const registryCtx = getRegistryCtx(_context);
    const descRes = await client.invoke(REGISTRY_CAP, { method: "describe", params: { cap: `${app}/${name}` } }, registryCtx);
    if (!descRes.ok) throw new Error(descRes.error?.message ?? "registry describe failed");
    const current = descRes.data;
    const description = requireString(input, "description") || current.description || "";
    const tags = parseTags(input.tags).length > 0 ? parseTags(input.tags) : current.tags;
    const vParts = (current.version || "1.0.0").split(".").map(Number);
    const version = { major: vParts[0] || 1, minor: vParts[1] || 0, patch: (vParts[2] || 0) + 1 };
    const upsertParams = {
      app,
      name,
      type: "model",
      description,
      tags,
      version,
      methods: (current.methods ?? []).map((m) => ({
        name: m.name,
        description: m.description,
        semantics: m.semantics,
        inputSchema: m.inputSchema,
        outputSchema: m.outputSchema,
        channels: m.channels,
        tags: m.tags
      }))
    };
    const res = await client.invoke(REGISTRY_CAP, { method: "upsert", params: upsertParams }, registryCtx);
    if (!res.ok) throw new Error(res.error?.message ?? "registry upsert failed");
    const result = res.data;
    return { cap: result.cap, name, version: result.version, action: result.action };
  } catch (err) {
    return { error: `${LOG}:update - ${err.message}` };
  }
}
async function deleteModel(input, _context) {
  const name = requireString(input, "name");
  const reason = requireString(input, "reason");
  if (!name || !reason) return { error: `${LOG}:delete - name and reason are required` };
  try {
    const client = await getClient();
    const registryCtx = getRegistryCtx(_context);
    const res = await client.invoke(REGISTRY_CAP, { method: "deprecate", params: { cap: name, reason } }, registryCtx);
    if (!res.ok) throw new Error(res.error?.message ?? "registry deprecate failed");
    const result = res.data;
    return { success: result.success, affected_versions: result.affectedVersions };
  } catch (err) {
    return { error: `${LOG}:delete - ${err.message}` };
  }
}
export {
  create,
  deleteModel as delete,
  get,
  list,
  update
};
