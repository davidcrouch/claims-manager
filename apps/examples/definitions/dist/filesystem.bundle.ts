// definitions/implementations/filesystem.ts
import * as fs from "node:fs/promises";
import * as path from "node:path";
function requireString(input, key) {
  const v = input[key];
  return typeof v === "string" ? v.trim() : "";
}
function optionalNumber(input, key, fallback) {
  const v = input[key];
  if (typeof v === "number" && !Number.isNaN(v)) return v;
  return fallback;
}
var LOG = "more0ai:filesystem";
var MAX_READ_BYTES = 10 * 1024 * 1024;
var FsStore = class {
  root;
  constructor(root) {
    this.root = path.resolve(root);
  }
  resolveSafe(userPath) {
    const resolved = path.resolve(this.root, userPath);
    const normalizedRoot = this.root.replace(/\\/g, "/");
    const normalizedResolved = resolved.replace(/\\/g, "/");
    if (!normalizedResolved.startsWith(normalizedRoot)) {
      throw new Error(
        `Path traversal detected: "${userPath}" resolves outside workspace root "${this.root}"`
      );
    }
    return resolved;
  }
  async read(params) {
    const encoding = params.encoding || "utf-8";
    const maxBytes = Math.min(Math.max(params.maxBytes ?? MAX_READ_BYTES, 0), MAX_READ_BYTES);
    const resolved = this.resolveSafe(params.path);
    const stat2 = await fs.stat(resolved);
    if (!stat2.isFile()) {
      throw new Error(`'${params.path}' is not a regular file`);
    }
    let content;
    let truncated = false;
    if (stat2.size > maxBytes) {
      const handle = await fs.open(resolved, "r");
      try {
        const buf = Buffer.alloc(maxBytes);
        await handle.read(buf, 0, maxBytes, 0);
        content = buf.toString(encoding);
        truncated = true;
      } finally {
        await handle.close();
      }
    } else {
      content = await fs.readFile(resolved, { encoding });
    }
    return { content, size: stat2.size, path: params.path, truncated };
  }
  async write(params) {
    const encoding = params.encoding || "utf-8";
    const resolved = this.resolveSafe(params.path);
    await fs.mkdir(path.dirname(resolved), { recursive: true });
    if (params.mode === "append") {
      await fs.appendFile(resolved, params.content, { encoding });
    } else {
      await fs.writeFile(resolved, params.content, { encoding });
    }
    const bytesWritten = Buffer.byteLength(params.content, encoding);
    return { path: params.path, bytes_written: bytesWritten };
  }
};
function createStore(params) {
  const { storeType, config } = params;
  switch (storeType) {
    case "fs": {
      const root = String(config.root || "");
      if (!root) {
        throw new Error(`${LOG}:createStore - fs workspace requires config.root`);
      }
      return new FsStore(root);
    }
    default:
      throw new Error(`${LOG}:createStore - unsupported store_type: ${storeType}`);
  }
}
var storeCache = /* @__PURE__ */ new Map();
var _client = null;
var _clientPromise = null;
async function loadClient() {
  const { CapabilityClient } = await import("@more0ai/client");
  const client = new CapabilityClient({
    config: { registryUrl: process.env.REGISTRY_URL || "http://127.0.0.1:3201" }
  });
  await client.initialize();
  return client;
}
async function getClient() {
  if (_client) return _client;
  if (_clientPromise) return _clientPromise;
  _clientPromise = loadClient();
  _client = await _clientPromise;
  return _client;
}
async function resolveWorkspace(workspaceName) {
  const cached = storeCache.get(workspaceName);
  if (cached) return cached;
  const client = await getClient();
  const result = await client.invoke(workspaceName, { method: "info", params: {} });
  if (!result.ok) {
    const msg = result.error?.message || "unknown error";
    throw new Error(`${LOG}:resolveWorkspace - failed to resolve '${workspaceName}': ${msg}`);
  }
  const data = result.data;
  const storeType = String(data.store_type || "");
  const config = data.config || {};
  const store = createStore({ storeType, config });
  storeCache.set(workspaceName, store);
  return store;
}
async function getStore(workspaceName) {
  if (!workspaceName) {
    throw new Error(`${LOG}:getStore - workspace name is required`);
  }
  return resolveWorkspace(workspaceName);
}
async function read(input, _context) {
  try {
    const workspace = requireString(input, "workspace");
    if (!workspace) {
      return { error: `${LOG}:read - 'workspace' is required` };
    }
    const filePath = requireString(input, "path");
    if (!filePath) {
      return { error: `${LOG}:read - 'path' is required` };
    }
    const encoding = requireString(input, "encoding") || "utf-8";
    const maxBytes = optionalNumber(input, "max_bytes", 10 * 1024 * 1024);
    const store = await getStore(workspace);
    const result = await store.read({ path: filePath, encoding, maxBytes });
    return {
      content: result.content,
      size: result.size,
      path: result.path,
      truncated: result.truncated
    };
  } catch (err) {
    return { error: `${LOG}:read - ${err.message}` };
  }
}
async function write(input, _context) {
  try {
    const workspace = requireString(input, "workspace");
    if (!workspace) {
      return { error: `${LOG}:write - 'workspace' is required` };
    }
    const filePath = requireString(input, "path");
    if (!filePath) {
      return { error: `${LOG}:write - 'path' is required` };
    }
    const content = requireString(input, "content");
    const encoding = requireString(input, "encoding") || "utf-8";
    const mode = requireString(input, "mode") || "overwrite";
    const store = await getStore(workspace);
    const result = await store.write({ path: filePath, content, encoding, mode });
    return { path: result.path, bytes_written: result.bytes_written };
  } catch (err) {
    return { error: `${LOG}:write - ${err.message}` };
  }
}
export {
  read,
  write
};
