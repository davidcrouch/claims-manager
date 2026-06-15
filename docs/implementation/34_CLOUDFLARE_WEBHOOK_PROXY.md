# 34 — Cloudflare Worker Webhook Proxy (Crunchwork → EnsureOS)

**Date:** 2026-06-14
**Status:** Implementation Plan
**Depends on:** None (standalone infrastructure; does not touch NestJS or Next.js apps)
**Origin:** Need for a Cloudflare Worker at `ensure-test.more0.dev/api/webhook` that transparently proxies Crunchwork webhook payloads to EnsureOS staging at `app-staging.branlamie.com/api/webhook`.

---

## 0. Purpose

Implement a Cloudflare Worker that acts as a transparent reverse proxy for Crunchwork webhook traffic. The Worker receives HTTP requests at `https://ensure-test.more0.dev/api/webhook` and forwards them — method, headers, body, and all — to `https://app-staging.branlamie.com/api/webhook`, returning the downstream response verbatim. No HTTP redirects, no body transformation, no route inspection.

This is the first stage of a future **More0 webhook routing architecture** where a single Cloudflare entry point fans out to multiple SaaS backends. For now the routing is hard-coded to one target.

**Goals:**

1. **Transparent proxy** — the caller cannot distinguish the Worker from the downstream origin.
2. **Independent deployment** — the Worker lives in its own directory with its own `package.json`; it shares no runtime with the NestJS API or Next.js frontend.
3. **Future extensibility** — code is structured so that multi-target routing (by path prefix, header, or query param) can be added without rewriting the proxy core.
4. **Minimal surface area** — no secrets, no KV, no Durable Objects; just `fetch`.

---

## 1. Architecture Overview

```
Crunchwork SaaS
       │
       │  POST /api/webhook (HMAC-signed payload)
       ▼
┌──────────────────────────────────────────────────┐
│  Cloudflare Edge                                 │
│                                                  │
│  DNS: ensure-test.more0.dev (orange-cloud proxy) │
│                                                  │
│  Worker Route:                                   │
│    ensure-test.more0.dev/api/webhook             │
│                                                  │
│  crunchwork-webhook-proxy (Worker)               │
│    ├─ preserve method                            │
│    ├─ preserve headers                           │
│    ├─ preserve body                              │
│    ├─ redirect: "manual" (no follow)             │
│    └─ return downstream response unchanged       │
└──────────────────┬───────────────────────────────┘
                   │
                   │  Outbound fetch
                   ▼
┌──────────────────────────────────────────────────┐
│  EnsureOS Staging                                │
│  https://app-staging.branlamie.com/api/webhook   │
│                                                  │
│  NestJS API → webhook controller → pipeline      │
└──────────────────────────────────────────────────┘
```

**Data flow:**

1. Crunchwork fires a webhook POST to `ensure-test.more0.dev/api/webhook`.
2. Cloudflare DNS resolves the hostname; the orange-cloud proxy intercepts the request.
3. The Worker route matches `/api/webhook` on `ensure-test.more0.dev`.
4. The Worker issues an outbound `fetch` to `https://app-staging.branlamie.com/api/webhook` with the original method, headers, and body.
5. The downstream response (status, headers, body) is returned to the caller verbatim.

---

## 2. Repository Structure

All Worker files live under a new top-level `workers/` directory, completely isolated from the existing monorepo apps:

```
claims_manager/
│
├── apps/
│   ├── api/           ← NestJS API (unchanged)
│   └── frontend/      ← Next.js frontend (unchanged)
│
├── packages/          ← shared packages (unchanged)
│
└── workers/
    └── crunchwork-webhook-proxy/
        ├── src/
        │   └── index.ts          ← Worker entry point
        │
        ├── wrangler.jsonc        ← Wrangler configuration
        ├── package.json          ← Worker-scoped dependencies
        ├── tsconfig.json         ← TypeScript config
        └── README.md             ← Deployment & verification docs
```

**Isolation constraints:**

- The Worker does **not** import from `apps/` or `packages/`.
- The Worker has its **own** `package.json` and `node_modules/`.
- The Worker is **not** added to the pnpm workspace (it uses Wrangler's own bundler).
- No changes to existing NestJS or Next.js application code.

---

## 3. Detailed Implementation Steps

### Phase 1 — Project Scaffolding

#### Step 1.1 — Create directory structure

Create the following directories:

```
workers/crunchwork-webhook-proxy/
workers/crunchwork-webhook-proxy/src/
```

#### Step 1.2 — Create `package.json`

Create `workers/crunchwork-webhook-proxy/package.json`:

```json
{
  "name": "crunchwork-webhook-proxy",
  "private": true,
  "scripts": {
    "dev": "wrangler dev",
    "deploy": "wrangler deploy"
  },
  "devDependencies": {
    "wrangler": "^4.0.0",
    "typescript": "^5.0.0"
  }
}
```

Notes:

- `private: true` — prevents accidental npm publish.
- No runtime dependencies — the Worker uses only the Cloudflare Workers runtime APIs.
- `wrangler` and `typescript` are devDependencies for local development and deployment.

#### Step 1.3 — Create `tsconfig.json`

Create `workers/crunchwork-webhook-proxy/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ESNext"],
    "types": ["@cloudflare/workers-types"],
    "strict": true,
    "noEmit": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "isolatedModules": true
  },
  "include": ["src/**/*.ts"]
}
```

Notes:

- `target` and `module` are `ESNext` to match the Workers runtime.
- `types` includes `@cloudflare/workers-types` for built-in type definitions (installed alongside `wrangler`).
- `noEmit: true` — Wrangler handles bundling; TypeScript is used for type-checking only.
- `moduleResolution: "bundler"` — matches Wrangler's esbuild-based resolution.

#### Step 1.4 — Create `wrangler.jsonc`

Create `workers/crunchwork-webhook-proxy/wrangler.jsonc`:

```jsonc
{
  "name": "crunchwork-webhook-proxy",
  "main": "src/index.ts",
  "compatibility_date": "2026-06-14",

  "routes": [
    {
      "pattern": "ensure-test.more0.dev/api/webhook",
      "zone_name": "more0.dev"
    }
  ]
}
```

Notes:

- `name` — becomes the Worker script name in the Cloudflare dashboard.
- `main` — Wrangler auto-bundles TypeScript; no separate build step needed.
- `compatibility_date` — pins the Workers runtime behaviour to today's date.
- `routes` — binds the Worker to the specific hostname + path combination. The `zone_name` tells Wrangler which Cloudflare zone (DNS domain) owns the route.

---

### Phase 2 — Worker Implementation

#### Step 2.1 — Create the Worker entry point

Create `workers/crunchwork-webhook-proxy/src/index.ts`:

```typescript
const TARGET_URL = "https://app-staging.branlamie.com/api/webhook";

export default {
  async fetch(request: Request): Promise<Response> {
    try {
      const response = await fetch(TARGET_URL, {
        method: request.method,
        headers: request.headers,
        body: request.body,
        redirect: "manual",
      });

      return response;
    } catch (error) {
      console.error("Webhook proxy failed", error);

      return new Response(
        JSON.stringify({
          success: false,
          message: "Webhook proxy failed",
        }),
        {
          status: 500,
          headers: {
            "Content-Type": "application/json",
          },
        },
      );
    }
  },
};
```

**Behaviour spec:**

| Requirement | Implementation |
|---|---|
| Accept any HTTP method | `method: request.method` — passes through GET, POST, PUT, PATCH, DELETE, etc. |
| Forward all headers | `headers: request.headers` — copies the entire `Headers` object |
| Forward request body | `body: request.body` — streams the `ReadableStream` without buffering |
| Preserve Content-Type | Inherited from forwarded headers |
| Preserve authorization headers | Inherited from forwarded headers (HMAC signature, Bearer tokens, etc.) |
| Return downstream response unchanged | `return response` — status, headers, and body are returned verbatim |
| Return downstream status codes unchanged | Covered by returning the raw `Response` object |
| No HTTP redirects | `redirect: "manual"` — 3xx responses are returned as-is, not followed |
| Log failures | `console.error` writes to Cloudflare Workers real-time logs (`wrangler tail`) |

**Design decisions:**

- `TARGET_URL` is extracted as a module-level constant to simplify future refactoring into a route map.
- The `body` is passed as a `ReadableStream` (from `request.body`), avoiding buffering the entire payload into memory. This is important for large webhook payloads.
- The error response uses a JSON envelope (`{ success, message }`) to give callers a machine-readable failure indicator.
- No request validation, authentication, or transformation is performed — the Worker is a transparent pipe.

---

### Phase 3 — Documentation

#### Step 3.1 — Create `README.md`

Create `workers/crunchwork-webhook-proxy/README.md` with the following sections:

1. **Overview** — what the Worker does and why it exists.
2. **Architecture** — diagram showing Crunchwork → Worker → EnsureOS.
3. **Prerequisites** — Cloudflare account, Wrangler CLI, Node.js.
4. **DNS Configuration** — instructions for verifying the `ensure-test.more0.dev` DNS record is proxied (orange cloud).
5. **Local Development** — `npm install` and `npm run dev` instructions.
6. **Deployment** — `npx wrangler login` and `npm run deploy` instructions.
7. **Verification** — curl command to test the deployed Worker.
8. **Monitoring** — `wrangler tail` for real-time log streaming.
9. **Future Roadmap** — multi-target routing architecture.

---

### Phase 4 — DNS & Cloudflare Configuration

#### Step 4.1 — Verify DNS record

Confirm that the Cloudflare DNS zone for `more0.dev` contains an **A** or **AAAA** record for `ensure-test.more0.dev`:

| Type | Name | Content | Proxy Status |
|---|---|---|---|
| A | ensure-test | 192.0.2.1 (or any placeholder) | Proxied (orange cloud) |

The actual IP does not matter because the Worker route intercepts all matching requests before they reach an origin server. The critical requirement is that the **Cloudflare proxy (orange cloud) is enabled** — without it, the DNS record resolves directly and bypasses Workers.

#### Step 4.2 — Verify zone ownership

The Wrangler route configuration specifies `zone_name: "more0.dev"`. The Cloudflare account used for deployment must own this zone. Verify via:

```bash
npx wrangler whoami
```

Then confirm the zone appears in the account's zone list in the Cloudflare dashboard.

---

### Phase 5 — Local Development & Testing

#### Step 5.1 — Install dependencies

```bash
cd workers/crunchwork-webhook-proxy
npm install
```

This installs `wrangler` and `typescript` into the Worker's local `node_modules/`.

#### Step 5.2 — Run local dev server

```bash
npm run dev
```

Wrangler starts a local development server (default `http://localhost:8787`). Requests to `http://localhost:8787/api/webhook` are handled by the Worker code.

#### Step 5.3 — Test locally

```bash
curl -X POST \
  http://localhost:8787/api/webhook \
  -H "Content-Type: application/json" \
  -d '{"test": true}'
```

**Expected result:**

- The Worker forwards the request to `https://app-staging.branlamie.com/api/webhook`.
- The response from EnsureOS staging is returned to the curl client.
- If EnsureOS staging is unreachable, the Worker returns a `500` JSON error.

#### Step 5.4 — TypeScript type-checking

```bash
npx tsc --noEmit
```

Verify zero errors. Wrangler bundles with esbuild (which skips type-checking), so this step validates types explicitly.

---

### Phase 6 — Deployment

#### Step 6.1 — Authenticate with Cloudflare

```bash
npx wrangler login
```

Opens a browser for OAuth authentication. The logged-in account must have Workers write access to the `more0.dev` zone.

#### Step 6.2 — Deploy the Worker

```bash
npm run deploy
```

Wrangler:
1. Bundles `src/index.ts` with esbuild.
2. Uploads the bundle to Cloudflare's edge network.
3. Creates the Worker route `ensure-test.more0.dev/api/webhook` in the `more0.dev` zone.

#### Step 6.3 — Verify deployment

```bash
curl -X POST \
  https://ensure-test.more0.dev/api/webhook \
  -H "Content-Type: application/json" \
  -d '{"test": true}'
```

**Expected result:**

1. Request reaches the Cloudflare Worker at the edge.
2. Worker forwards to `https://app-staging.branlamie.com/api/webhook`.
3. EnsureOS receives `{"test": true}` with all original headers.
4. EnsureOS response is returned to the curl client unchanged.

#### Step 6.4 — Monitor logs

```bash
npx wrangler tail
```

Streams real-time `console.log` and `console.error` output from the deployed Worker. Use this to verify requests are flowing and to diagnose any proxy failures.

---

## 4. File Inventory

| File | Purpose |
|---|---|
| `workers/crunchwork-webhook-proxy/src/index.ts` | Worker entry point — proxy logic |
| `workers/crunchwork-webhook-proxy/wrangler.jsonc` | Wrangler config — name, routes, compatibility date |
| `workers/crunchwork-webhook-proxy/package.json` | NPM package — scripts + dev dependencies |
| `workers/crunchwork-webhook-proxy/tsconfig.json` | TypeScript config — Workers-compatible settings |
| `workers/crunchwork-webhook-proxy/README.md` | Deployment instructions and architecture docs |

---

## 5. Security Considerations

| Concern | Mitigation |
|---|---|
| **No authentication on the proxy** | The Worker is a transparent pipe; authentication is the responsibility of the downstream EnsureOS API (HMAC webhook verification). The Worker does not strip or alter auth headers. |
| **No secrets stored** | The target URL is hard-coded. No API keys, tokens, or secrets are configured in the Worker or Wrangler config. |
| **HMAC integrity** | Crunchwork signs webhook payloads with HMAC. Because the Worker forwards headers and body byte-for-byte, the HMAC signature remains valid at the downstream endpoint. |
| **TLS** | Both the inbound (Cloudflare edge) and outbound (EnsureOS staging) connections use HTTPS/TLS. |
| **No data persistence** | The Worker does not store, log, or cache request/response bodies. Only error metadata is written to `console.error`. |

---

## 6. Error Handling

| Scenario | Worker Behaviour |
|---|---|
| Downstream returns 4xx/5xx | Status code, headers, and body are returned verbatim to the caller. The Worker does not intercept or transform error responses. |
| Downstream is unreachable (DNS failure, timeout, connection refused) | `fetch` throws; the `catch` block returns a `500` JSON response with `{ success: false, message: "Webhook proxy failed" }`. The error is logged via `console.error`. |
| Worker runtime error (code bug) | Cloudflare returns a generic 500 page. Visible in `wrangler tail` logs. |
| Request body too large | Cloudflare Workers enforce a 100 MB request body limit. Webhook payloads are typically < 1 MB, so this is not a practical concern. |

---

## 7. Observability

| Tool | Purpose |
|---|---|
| `wrangler tail` | Real-time log streaming from the deployed Worker. Shows `console.error` output for failed proxies. |
| Cloudflare Dashboard → Workers → Analytics | Request count, error rate, CPU time, and latency metrics. Available without additional configuration. |
| Cloudflare Dashboard → Workers → Logs | Historical log entries (if Workers Logpush is enabled on the account). |

No custom metrics, tracing, or alerting are required for this initial implementation. Future iterations may add structured logging or Logpush integration.

---

## 8. Future Design Considerations

The Worker is designed as the entry point for a generic webhook routing architecture:

```
Crunchwork
      │
      ▼
ensure-test.more0.dev
      │
      ▼
Cloudflare Worker
      │
      ├── EnsureOS Staging   (app-staging.branlamie.com)
      ├── EnsureOS Production
      ├── More0
      ├── Salestrekker
      └── Other SaaS Integrations
```

**Planned evolution:**

1. **Route map** — Replace the hard-coded `TARGET_URL` with a route map keyed by path prefix, query parameter, or custom header:

   ```typescript
   const routes: Record<string, string> = {
     crunchwork: "https://app-staging.branlamie.com/api/webhook",
     salestrekker: "https://...",
   };
   ```

2. **Environment-based targets** — Use Wrangler environment variables (`vars` in `wrangler.jsonc`) to configure target URLs per deployment environment (staging, production).

3. **Request logging** — Add structured `console.log` for every proxied request (method, path, status, latency) for audit trails.

4. **Multi-route binding** — Add additional Worker routes for production domains (e.g., `ensure.more0.dev/api/webhook`).

5. **Fan-out** — Forward a single inbound webhook to multiple downstream targets simultaneously (e.g., EnsureOS + More0 analytics).

6. **KV/D1 config** — Store routing rules in Cloudflare KV or D1 for dynamic configuration without redeployment.

For this implementation, all routing is hard-coded to the single EnsureOS staging target.

---

## 9. Acceptance Criteria

- [ ] `workers/crunchwork-webhook-proxy/` directory exists with all five files.
- [ ] `npm install` in the Worker directory completes without errors.
- [ ] `npx tsc --noEmit` reports zero type errors.
- [ ] `npm run dev` starts a local Wrangler dev server that proxies requests.
- [ ] Local `curl` test forwards to EnsureOS staging and returns the downstream response.
- [ ] `npm run deploy` uploads the Worker to Cloudflare and creates the route.
- [ ] `curl -X POST https://ensure-test.more0.dev/api/webhook -H "Content-Type: application/json" -d '{"test":true}'` returns the EnsureOS response.
- [ ] `wrangler tail` shows `console.error` output when the downstream is unreachable.
- [ ] No changes to any file in `apps/api/`, `apps/frontend/`, `apps/auth-server/`, or `packages/`.
- [ ] README.md contains deployment, verification, and monitoring instructions.

---

## 10. Estimated Effort

| Phase | Description | Estimate |
|---|---|---|
| 1 | Project scaffolding (directories, configs) | 15 min |
| 2 | Worker implementation | 10 min |
| 3 | README documentation | 15 min |
| 4 | DNS verification | 10 min |
| 5 | Local testing | 10 min |
| 6 | Deployment & verification | 15 min |
| **Total** | | **~1.25 h** |
