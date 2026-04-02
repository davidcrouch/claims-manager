// Self-contained for inline-ts runner: no local imports (only node:*); @more0ai/client loaded dynamically when needed.
import * as fs from "node:fs/promises";
import * as path from "node:path";

type Input = Record<string, unknown>;
type Context = Record<string, unknown>;

function requireString(input: Input, key: string): string {
  const v = input[key];
  return typeof v === "string" ? v.trim() : "";
}

function optionalNumber(input: Input, key: string, fallback: number): number {
  const v = input[key];
  if (typeof v === "number" && !Number.isNaN(v)) return v;
  return fallback;
}

const LOG = "more0ai:filesystem";
const MAX_READ_BYTES = 10 * 1024 * 1024; // 10 MB hard ceiling

// ── Inlined workspace store (no ./workspace-store.js) ───────────────────────

interface ReadResult {
  content: string;
  size: number;
  path: string;
  truncated: boolean;
}

interface WriteResult {
  path: string;
  bytes_written: number;
}

interface WorkspaceStore {
  read(params: { path: string; encoding?: BufferEncoding; maxBytes?: number }): Promise<ReadResult>;
  write(params: { path: string; content: string; encoding?: BufferEncoding; mode?: string }): Promise<WriteResult>;
}

class FsStore implements WorkspaceStore {
  private root: string;

  constructor(root: string) {
    this.root = path.resolve(root);
  }

  private resolveSafe(userPath: string): string {
    const resolved = path.resolve(this.root, userPath);
    const normalizedRoot = this.root.replace(/\\/g, "/");
    const normalizedResolved = resolved.replace(/\\/g, "/");
    if (!normalizedResolved.startsWith(normalizedRoot)) {
      throw new Error(
        `Path traversal detected: "${userPath}" resolves outside workspace root "${this.root}"`,
      );
    }
    return resolved;
  }

  async read(params: { path: string; encoding?: BufferEncoding; maxBytes?: number }): Promise<ReadResult> {
    const encoding = params.encoding || "utf-8";
    const maxBytes = Math.min(Math.max(params.maxBytes ?? MAX_READ_BYTES, 0), MAX_READ_BYTES);
    const resolved = this.resolveSafe(params.path);

    const stat = await fs.stat(resolved);
    if (!stat.isFile()) {
      throw new Error(`'${params.path}' is not a regular file`);
    }

    let content: string;
    let truncated = false;

    if (stat.size > maxBytes) {
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

    return { content, size: stat.size, path: params.path, truncated };
  }

  async write(params: { path: string; content: string; encoding?: BufferEncoding; mode?: string }): Promise<WriteResult> {
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
}

function createStore(params: { storeType: string; config: Record<string, unknown> }): WorkspaceStore {
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

const storeCache = new Map<string, WorkspaceStore>();

let _client: Awaited<ReturnType<typeof loadClient>> | null = null;
let _clientPromise: Promise<Awaited<ReturnType<typeof loadClient>>> | null = null;

async function loadClient() {
  const { CapabilityClient } = await import("@more0ai/client");
  const client = new CapabilityClient({
    config: { registryUrl: process.env.REGISTRY_URL || "http://127.0.0.1:3201" },
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

async function resolveWorkspace(workspaceName: string): Promise<WorkspaceStore> {
  const cached = storeCache.get(workspaceName);
  if (cached) return cached;

  const client = await getClient();
  const result = await client.invoke(workspaceName, { method: "info", params: {} });

  if (!result.ok) {
    const msg = result.error?.message || "unknown error";
    throw new Error(`${LOG}:resolveWorkspace - failed to resolve '${workspaceName}': ${msg}`);
  }

  const data = result.data as Record<string, unknown>;
  const storeType = String(data.store_type || "");
  const config = (data.config as Record<string, unknown>) || {};

  const store = createStore({ storeType, config });
  storeCache.set(workspaceName, store);
  return store;
}

async function getStore(workspaceName: string): Promise<WorkspaceStore> {
  if (!workspaceName) {
    throw new Error(`${LOG}:getStore - workspace name is required`);
  }
  return resolveWorkspace(workspaceName);
}

// ── Tool methods ────────────────────────────────────────────────────────────

export async function read(input: Input, _context: Context) {
  try {
    const workspace = requireString(input, "workspace");
    if (!workspace) {
      return { error: `${LOG}:read - 'workspace' is required` };
    }
    const filePath = requireString(input, "path");
    if (!filePath) {
      return { error: `${LOG}:read - 'path' is required` };
    }

    const encoding = (requireString(input, "encoding") || "utf-8") as BufferEncoding;
    const maxBytes = optionalNumber(input, "max_bytes", 10 * 1024 * 1024);

    const store = await getStore(workspace);
    const result = await store.read({ path: filePath, encoding, maxBytes });

    return {
      content: result.content,
      size: result.size,
      path: result.path,
      truncated: result.truncated,
    };
  } catch (err) {
    return { error: `${LOG}:read - ${(err as Error).message}` };
  }
}

export async function write(input: Input, _context: Context) {
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
    const encoding = (requireString(input, "encoding") || "utf-8") as BufferEncoding;
    const mode = requireString(input, "mode") || "overwrite";

    const store = await getStore(workspace);
    const result = await store.write({ path: filePath, content, encoding, mode });

    return { path: result.path, bytes_written: result.bytes_written };
  } catch (err) {
    return { error: `${LOG}:write - ${(err as Error).message}` };
  }
}
