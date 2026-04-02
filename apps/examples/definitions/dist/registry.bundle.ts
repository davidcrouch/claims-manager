// definitions/implementations/registry.ts
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
var LOG = "more0ai:registry";
async function discover(input, _context) {
  try {
    const client = await getClient();
    const result = await client.discover({
      app: requireString(input, "app") || void 0,
      type: requireString(input, "type") || void 0,
      tags: parseTags(input.tags).length > 0 ? parseTags(input.tags) : void 0,
      query: requireString(input, "query") || void 0,
      page: input.page != null ? optionalNumber(input, "page", 1) : void 0,
      limit: input.limit != null ? optionalNumber(input, "limit", 20) : void 0
    });
    return {
      capabilities: result.capabilities.map((c) => ({
        cap: c.cap,
        app: c.app,
        name: c.name,
        description: c.description,
        tags: c.tags,
        version: c.latestVersion
      })),
      total: result.pagination.total,
      page: result.pagination.page,
      total_pages: result.pagination.totalPages
    };
  } catch (err) {
    return { error: `${LOG}:discover - ${err.message}` };
  }
}
async function health(_input, _context) {
  try {
    const client = await getClient();
    const result = await client.registryHealth();
    return {
      status: result.status,
      checks: result.checks,
      timestamp: result.timestamp
    };
  } catch (err) {
    return { error: `${LOG}:health - ${err.message}` };
  }
}
export {
  discover,
  health
};
