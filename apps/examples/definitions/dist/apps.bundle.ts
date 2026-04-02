// definitions/implementations/apps.ts
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
var LOG = "more0ai:apps";
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
  const appKey = requireString(input, "app_key");
  const displayName = requireString(input, "display_name") || void 0;
  if (!appKey) {
    return { error: `${LOG}:create - app_key is required` };
  }
  try {
    const client = await getClient();
    const createParams = { app_key: appKey, display_name: displayName };
    const registryCtx = getRegistryCtx(_context);
    let result;
    if (registryCtx.accessToken) {
      const res = await client.invoke(REGISTRY_CAP, { method: "createApp", params: createParams }, registryCtx);
      if (!res.ok) throw new Error(res.error?.message ?? "registry createApp failed");
      result = res.data;
    } else {
      result = await client.createApp(createParams);
    }
    return { app_key: result.app_key, id: result.id };
  } catch (err) {
    return { error: `${LOG}:create - ${err.message}` };
  }
}
async function list(_input, _context) {
  try {
    const client = await getClient();
    const result = await client.listApps();
    return {
      apps: result.applications.map((a) => ({
        app_key: a.app_key,
        name: a.name,
        status: a.status,
        created_at: a.created_at
      }))
    };
  } catch (err) {
    return { error: `${LOG}:list - ${err.message}` };
  }
}
export {
  create,
  list
};
