// definitions/implementations/intent.ts
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
function requireString(input, key) {
  const v = input[key];
  return typeof v === "string" ? v.trim() : "";
}
function optionalNumber(input, key, fallback) {
  const v = input[key];
  if (typeof v === "number" && !Number.isNaN(v)) return v;
  return fallback;
}
var LOG = "more0ai:intent";
async function search(input, _context) {
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
        type: requireString(input, "type") || void 0,
        limit: input.limit != null ? optionalNumber(input, "limit", 6) : void 0
      }
    });
    if (!result.ok) {
      return { error: result.error?.message || `${LOG}:search - intent search failed` };
    }
    const methods = result.data?.methods || [];
    return {
      tools_found: methods.length,
      tools: methods.map((m) => ({
        ref: m.ref,
        description: m.description || "",
        similarity: m.similarity
      })),
      message: methods.length > 0 ? `Found ${methods.length} relevant tool(s). They have been added to your available tools.` : "No relevant tools found for this intent. Try rephrasing or broadening your description."
    };
  } catch (err) {
    return { error: `${LOG}:search - ${err.message}` };
  }
}
async function health(input, _context) {
  try {
    const client = await getClient();
    const result = await client.invoke("system.registry", {
      method: "health",
      params: {}
    });
    return result.data || { status: "unknown" };
  } catch (err) {
    return { error: `${LOG}:health - ${err.message}` };
  }
}
export {
  health,
  search
};
