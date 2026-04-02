// definitions/implementations/workflows.ts
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
var LOG = "more0ai:workflows";
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
  const startAt = requireString(input, "start_at");
  const states = input.states;
  const inputSchema = input.input_schema;
  const outputSchema = input.output_schema;
  const tags = parseTags(input.tags);
  const version = parseVersion(input.version);
  if (!app || !name || !startAt || !states || typeof states !== "object") {
    return { error: `${LOG}:create - app, name, start_at, and states are required` };
  }
  try {
    const client = await getClient();
    const aslDefinition = { StartAt: startAt, States: states };
    const upsertParams = {
      app,
      name,
      type: "workflow",
      description,
      tags,
      version: { ...version, metadata: { asl: aslDefinition } },
      methods: [
        {
          name: "execute",
          description: `Execute the ${name} workflow`,
          semantics: "work",
          inputSchema: inputSchema ?? { type: "object" },
          outputSchema: outputSchema ?? { type: "object" },
          channels: ["sync"]
        }
      ]
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
      type: "workflow",
      app: requireString(input, "app") || void 0,
      tags: parseTags(input.tags).length > 0 ? parseTags(input.tags) : void 0,
      query: requireString(input, "query") || void 0
    });
    return {
      workflows: result.capabilities.map((c) => ({
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
    const metadata = {};
    const states = input.states;
    const startAt = requireString(input, "start_at");
    if (states && typeof states === "object") {
      metadata.asl = { StartAt: startAt || "Start", States: states };
    }
    const upsertParams = {
      app,
      name,
      type: "workflow",
      description,
      tags,
      version: { ...version, metadata: Object.keys(metadata).length > 0 ? metadata : void 0 },
      methods: current.methods.map((m) => ({
        name: m.name,
        description: m.description,
        semantics: m.semantics,
        inputSchema: m.inputSchema,
        outputSchema: m.outputSchema,
        channels: m.channels,
        tags: m.tags
      }))
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
async function deleteWorkflow(input, _context) {
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
  deleteWorkflow as delete,
  get,
  list,
  update
};
