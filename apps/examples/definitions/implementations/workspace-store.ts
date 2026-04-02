import * as fs from "node:fs/promises";
import * as path from "node:path";
import { getClient } from "./client.js";

const LOG = "more0ai:workspace-store";

export interface ReadResult {
  content: string;
  size: number;
  path: string;
  truncated: boolean;
}

export interface WriteResult {
  path: string;
  bytes_written: number;
}

export interface WorkspaceStore {
  read(params: { path: string; encoding?: BufferEncoding; maxBytes?: number }): Promise<ReadResult>;
  write(params: { path: string; content: string; encoding?: BufferEncoding; mode?: string }): Promise<WriteResult>;
}

const MAX_READ_BYTES = 10 * 1024 * 1024; // 10 MB hard ceiling

export class FsStore implements WorkspaceStore {
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

export function createStore(params: { storeType: string; config: Record<string, unknown> }): WorkspaceStore {
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

export async function resolveWorkspace(workspaceName: string): Promise<WorkspaceStore> {
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

export async function getStore(workspaceName: string): Promise<WorkspaceStore> {
  if (!workspaceName) {
    throw new Error(`${LOG}:getStore - workspace name is required`);
  }
  return resolveWorkspace(workspaceName);
}
