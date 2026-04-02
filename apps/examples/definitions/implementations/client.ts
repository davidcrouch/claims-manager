// Lazy load @more0ai/client so implementations can be loaded in environments that don't have it (e.g. inline-ts runner).
// No top-level import — getClient() uses dynamic import on first use.
let _client: Awaited<ReturnType<typeof loadClient>> | null = null;
let _initPromise: Promise<Awaited<ReturnType<typeof loadClient>>> | null = null;

async function loadClient() {
  const { CapabilityClient } = await import("@more0ai/client");
  const client = new CapabilityClient({
    config: {
      registryUrl: process.env.REGISTRY_URL || "http://127.0.0.1:3201",
    },
  });
  await client.initialize();
  return client;
}

export async function getClient(): Promise<Awaited<ReturnType<typeof loadClient>>> {
  if (_client) return _client;
  if (_initPromise) return _initPromise;

  _initPromise = loadClient().then((client) => {
    _client = client;
    return client;
  });

  return _initPromise;
}

export type Input = Record<string, unknown>;
export type Context = Record<string, unknown>;

export interface VersionInput {
  major: number;
  minor: number;
  patch: number;
}

export function parseVersion(raw: unknown): VersionInput {
  if (raw && typeof raw === "object") {
    const v = raw as Record<string, unknown>;
    return {
      major: Number(v.major) || 1,
      minor: Number(v.minor) || 0,
      patch: Number(v.patch) || 0,
    };
  }
  return { major: 1, minor: 0, patch: 0 };
}

export function parseTags(raw: unknown): string[] {
  return Array.isArray(raw) ? raw.map(String) : [];
}

export function requireString(input: Input, key: string): string {
  const v = input[key];
  return typeof v === "string" ? v.trim() : "";
}

export function optionalNumber(input: Input, key: string, fallback: number): number {
  const v = input[key];
  if (typeof v === "number" && !Number.isNaN(v)) return v;
  return fallback;
}
