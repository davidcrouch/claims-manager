# Crunchwork Webhook Proxy

Cloudflare Worker that intercepts Crunchwork staging webhooks at `providers-staging.branlamie.com/api/v1/webhooks/crunchwork` and fans out to both staging Cloud Run and the local dev tunnel:

- **Primary (awaited):** `provider-server-….run.app/api/v1/internal/webhooks/crunchwork` (Cloud Run origin, bypasses Cloudflare)
- **Secondary (fire-and-forget):** `api-dev.branlamie.com/api/v1/webhooks/crunchwork` → local `:5001`

## Architecture

```
Crunchwork SaaS
       │
       │  POST /api/v1/webhooks/crunchwork (HMAC-signed payload)
       ▼
┌──────────────────────────────────────────────────────────────────┐
│  Cloudflare Edge                                                │
│  Worker: crunchwork-webhook-proxy                               │
│  Route: providers-staging.branlamie.com/api/v1/webhooks/crunchwork │
│                                                                 │
│  More specific than cloudrun-hostname-proxy's /* wildcard,      │
│  so this Worker wins for the webhook path only.                 │
│                                                                 │
│  Preserves: method, headers, body, status                       │
│  Redirects: disabled (manual)                                   │
└──────────────────┬───────────────────────┬──────────────────────┘
                   │                       │
                   ▼                       ▼
┌─────────────────────────────────┐  ┌────────────────────────────┐
│ Cloud Run (direct origin)       │  │ api-dev (tunnel)           │
│ .../api/v1/internal/webhooks/   │  │ .../api/v1/webhooks/       │
│ crunchwork                      │  │ crunchwork                 │
└─────────────────────────────────┘  └────────────────────────────┘
```

### Why the internal path?

The public `/api/v1/webhooks/crunchwork` is now intercepted by this Worker on the Cloudflare edge. A same-zone `fetch()` from a Worker bypasses other Workers and hits the raw DNS origin — but `providers-staging.branlamie.com` resolves to a Google LB that needs the Host rewrite performed by `cloudrun-hostname-proxy`. To avoid that dependency, this Worker fetches the Cloud Run `.run.app` URL directly on the `/api/v1/internal/webhooks/crunchwork` path.

### Production endpoints

When production is live, Crunchwork will post directly to the provider host (no proxy needed):

| Environment | URL |
|---|---|
| Staging | `https://providers-staging.branlamie.com/api/v1/webhooks/crunchwork` (→ this Worker) |
| Production | `https://providers.branlamie.com/api/v1/webhooks/crunchwork` (direct) |

## Prerequisites

- Node.js 18+
- A Cloudflare account with access to the `branlamie.com` zone
- Wrangler CLI (installed as a dev dependency)

## Local Development

Install dependencies:

```bash
npm install
```

Start the local dev server:

```bash
npm run dev
```

Wrangler starts at `http://localhost:8787`. Test with:

```bash
curl -X POST \
  http://localhost:8787/api/v1/webhooks/crunchwork \
  -H "Content-Type: application/json" \
  -d '{"test": true}'
```

## Deployment

Authenticate with Cloudflare (one-time):

```bash
npx wrangler login
```

Deploy:

```bash
npm run deploy
```

## Verification

After deployment, confirm the proxy is working:

```bash
curl -X POST \
  https://providers-staging.branlamie.com/api/v1/webhooks/crunchwork \
  -H "Content-Type: application/json" \
  -d '{"test": true}'
```

The response should come from Cloud Run staging (`provider-server`), with the original status code and body intact.

## Monitoring

Stream real-time logs from the deployed Worker:

```bash
npx wrangler tail
```

Failed proxy attempts are logged via `console.error` and visible in the tail output.

Worker analytics (request count, error rate, latency) are available in the Cloudflare Dashboard under **Workers & Pages → crunchwork-webhook-proxy → Analytics**.
