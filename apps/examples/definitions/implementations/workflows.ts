type Input = Record<string, unknown>;
type Context = Record<string, unknown>;

interface VersionInput { major: number; minor: number; patch: number; }

let _client: Awaited<ReturnType<typeof _loadClient>> | null = null;
let _initPromise: Promise<Awaited<ReturnType<typeof _loadClient>>> | null = null;

async function _loadClient() {
   const { CapabilityClient } = await import("@more0ai/client");
   const client = new CapabilityClient({
      config: { registryUrl: process.env.REGISTRY_URL || "http://127.0.0.1:3201" },
   });
   await client.initialize();
   return client;
}

async function getClient() {
   if (_client) return _client;
   if (_initPromise) return _initPromise;
   _initPromise = _loadClient().then((c) => { _client = c; return c; });
   return _initPromise;
}

function parseVersion(raw: unknown): VersionInput {
   if (raw && typeof raw === "object") {
      const v = raw as Record<string, unknown>;
      return { major: Number(v.major) || 1, minor: Number(v.minor) || 0, patch: Number(v.patch) || 0 };
   }
   return { major: 1, minor: 0, patch: 0 };
}

function parseTags(raw: unknown): string[] {
   return Array.isArray(raw) ? raw.map(String) : [];
}

function requireString(input: Input, key: string): string {
   const v = input[key];
   return typeof v === "string" ? v.trim() : "";
}

/** Validates ASL shape: non-array object with string StartAt and object States. */
function parseWorkflowAsl(raw: unknown): Record<string, unknown> | null {
   if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
   const o = raw as Record<string, unknown>;
   const startAt = o.StartAt;
   const states = o.States;
   if (typeof startAt !== "string" || !startAt.trim()) return null;
   if (!states || typeof states !== "object" || Array.isArray(states)) return null;
   return o;
}

const LOG = "more0ai:workflows";

const REGISTRY_CAP = "more0ai/system.registry";

function getAccessToken(ctx: Context): string | undefined {
   const t = ctx?.accessToken;
   return typeof t === "string" && t.trim() ? t : undefined;
}

function getTenantId(ctx: Context): string | undefined {
   const t = ctx?.tenantId;
   return typeof t === "string" && t.trim() ? t : undefined;
}

function getRegistryCtx(ctx: Context): Record<string, string | undefined> {
   return { accessToken: getAccessToken(ctx), tenantId: getTenantId(ctx) };
}

/** Debug: log params passed from the agent/tool runtime; does not log accessToken. */
function logWorkflowParams(method: string, input: Input, ctx: Context) {
   const copy: Record<string, unknown> = { ...input };
   if ("asl" in copy && copy.asl !== undefined) {
      try {
         const raw = copy.asl;
         const s = typeof raw === "string" ? raw : JSON.stringify(raw);
         copy.asl =
            s.length > 4000 ? (`[truncated ${s.length} chars] ` + s.slice(0, 4000)) : raw;
      } catch {
         copy.asl = "[asl: could not serialize]";
      }
   }
   console.log(
      `${LOG}:${method}`,
      JSON.stringify({
         input: copy,
         context: { tenantId: getTenantId(ctx), hasAccessToken: Boolean(getAccessToken(ctx)) },
      }),
   );
}

export async function create(input: Input, _context: Context) {
   logWorkflowParams("create", input, _context);
   const app = requireString(input, "app");
   const name = requireString(input, "name");
   const description = requireString(input, "description");
   const aslDefinition = parseWorkflowAsl(input.asl);
   const inputSchema = input.input_schema as Record<string, unknown> | undefined;
   const outputSchema = input.output_schema as Record<string, unknown> | undefined;
   const tags = parseTags(input.tags);
   const version = parseVersion(input.version);

   if (!app || !name || !description || !aslDefinition) {
      return { error: `${LOG}:create - app, name, description, and asl (with StartAt and States) are required` };
   }

   try {
      const client = await getClient();

      const upsertParams = {
         app,
         name,
         type: "workflow",
         description,
         tags,
         targetRevision: "working" as const,
         version: { major: 0, minor: 0, patch: 0 },
         manifest: {
            implementation: {
               kind: "workflow-asl",
               entrypoint: "asl.json",
               execution: { kind: "workflow-engine", config: { adapter: "checkpoint-memory" } },
            },
         },
         files: [
            { path: "asl.json", content: JSON.stringify(aslDefinition, null, 2), contentType: "application/json" },
         ],
         methods: [
            {
               name: "execute",
               description: `Execute the ${name} workflow`,
               semantics: "work",
               inputSchema: inputSchema ?? { type: "object" },
               outputSchema: outputSchema ?? { type: "object" },
               channels: ["sync"],
            },
         ],
      };

      let result: { cap: string; version: string; action: string };
      const registryCtx = getRegistryCtx(_context);
      if (registryCtx.accessToken) {
         const res = await client.invoke(REGISTRY_CAP, { method: "upsert", params: upsertParams }, registryCtx);
         if (!res.ok) throw new Error(res.error?.message ?? "registry upsert failed");
         result = res.data as typeof result;
      } else {
         result = await client.upsert(upsertParams);
      }

      return { cap: result.cap, name, version: result.version, action: result.action };
   } catch (err) {
      return { error: `${LOG}:create - ${(err as Error).message}` };
   }
}

export async function get(input: Input, _context: Context) {
   logWorkflowParams("get", input, _context);
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
         methods: result.methods,
      };
   } catch (err) {
      return { error: `${LOG}:get - ${(err as Error).message}` };
   }
}

export async function list(input: Input, _context: Context) {
   logWorkflowParams("list", input, _context);
   try {
      const client = await getClient();
      const result = await client.discover({
         type: "workflow",
         app: requireString(input, "app") || undefined,
         tags: parseTags(input.tags).length > 0 ? parseTags(input.tags) : undefined,
         query: requireString(input, "query") || undefined,
      });
      return {
         workflows: result.capabilities.map((c: any) => ({
            cap: c.cap,
            name: c.name,
            description: c.description,
            tags: c.tags,
            version: c.latestVersion,
         })),
         total: result.pagination.total,
      };
   } catch (err) {
      return { error: `${LOG}:list - ${(err as Error).message}` };
   }
}

export async function update(input: Input, _context: Context) {
   logWorkflowParams("update", input, _context);
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

      const asl = parseWorkflowAsl(input.asl);

      const upsertParams: Record<string, unknown> = {
         app,
         name,
         type: "workflow",
         description,
         tags,
         version,
         manifest: {
            implementation: {
               kind: "workflow-asl",
               entrypoint: "asl.json",
               execution: { kind: "workflow-engine", config: { adapter: "checkpoint-memory" } },
            },
         },
         methods: current.methods.map((m: any) => ({
            name: m.name,
            description: m.description,
            semantics: m.semantics,
            inputSchema: m.inputSchema,
            outputSchema: m.outputSchema,
            channels: m.channels,
            tags: m.tags,
         })),
      };

      if (asl) {
         upsertParams.files = [
            { path: "asl.json", content: JSON.stringify(asl, null, 2), contentType: "application/json" },
         ];
      }

      let result: { cap: string; version: string; action: string };
      const registryCtx = getRegistryCtx(_context);
      if (registryCtx.accessToken) {
         const res = await client.invoke(REGISTRY_CAP, { method: "upsert", params: upsertParams }, registryCtx);
         if (!res.ok) throw new Error(res.error?.message ?? "registry upsert failed");
         result = res.data as typeof result;
      } else {
         result = await client.upsert(upsertParams);
      }

      return { cap: result.cap, name, version: result.version, action: result.action };
   } catch (err) {
      return { error: `${LOG}:update - ${(err as Error).message}` };
   }
}

async function deleteWorkflow(input: Input, _context: Context) {
   logWorkflowParams("delete", input, _context);
   const name = requireString(input, "name");
   const reason = requireString(input, "reason");
   if (!name || !reason) return { error: `${LOG}:delete - name and reason are required` };

   try {
      const client = await getClient();
      const registryCtx = getRegistryCtx(_context);
      let result: { success: boolean; affectedVersions: string[] };
      if (registryCtx.accessToken) {
         const res = await client.invoke(REGISTRY_CAP, { method: "deprecate", params: { cap: name, reason } }, registryCtx);
         if (!res.ok) throw new Error(res.error?.message ?? "registry deprecate failed");
         result = res.data as typeof result;
      } else {
         result = await client.deprecate({ cap: name, reason });
      }
      return { success: result.success, affected_versions: result.affectedVersions };
   } catch (err) {
      return { error: `${LOG}:delete - ${(err as Error).message}` };
   }
}

export { deleteWorkflow as delete };
