# Crunchwork Webhook Proxy

Cloudflare Worker that intercepts Crunchwork staging webhooks at `providers-staging.branlamie.com/api/v1/webhooks/crunchwork` and fans out to hosted staging and the local dev tunnel:

- **Primary (awaited):** Cloud Run `provider-server` internal ingest (`/api/v1/internal/webhooks/crunchwork`)
- **Secondary (fire-and-forget):** `api-dev.branlamie.com/api/v1/webhooks/crunchwork` → local `:5001`

The public path is intercepted on Cloudflare, so staging must be reached on the **internal** Cloud Run URL. That avoids looping back through this Worker and does not depend on `api-staging.branlamie.com` (that hostname is not in DNS; staging `api-server` is VPC-internal).

## Architecture

```
Crunchwork SaaS
       │
       │  POST /api/v1/webhooks/crunchwork (HMAC-signed payload)
       ▼
┌──────────────────────────────────────────────────────────────────┐
│  Cloudflare Edge (orange-cloud: providers-staging.branlamie.com) │
│  Worker: crunchwork-webhook-proxy                               │
│  Route: providers-staging.branlamie.com/api/v1/webhooks/crunchwork │
│                                                                 │
│  Preserves: method, headers, body, status                       │
│  Redirects: disabled (manual)                                   │
└──────────────────┬───────────────────────┬──────────────────────┘
                   │                       │
                   ▼                       ▼
┌─────────────────────────────────┐  ┌────────────────────────────┐
│ Cloud Run origin (direct)      │  │ api-dev (tunnel)           │
│ provider-server *.run.app       │  │ api-dev.branlamie.com      │
│ /api/v1/internal/webhooks/…    │  │ /api/v1/webhooks/crunchwork│
└─────────────────────────────────┘  └────────────────────────────┘
```

### DNS setup

`providers-staging.branlamie.com` is **orange-cloud** (Cloudflare-proxied) so this Worker can intercept the public Crunchwork path. Other `providers-staging` paths are handled by `cloudrun-hostname-proxy`.

### Production

Production does not use a Worker. Crunchwork posts directly to the provider host via the GCP HTTPS LB:

| Environment | URL | Routing |
|---|---|---|
| Staging | `providers-staging.branlamie.com/…` | CF Worker → Cloud Run internal ingest + dev tunnel |
| Production | `providers.branlamie.com/…` | Grey-cloud → LB → `provider-server` (direct) |

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
curl https://providers-staging.branlamie.com/api/v1/webhooks/crunchwork
```

Expected: `{"service":"provider-server","path":"/api/v1/internal/webhooks/crunchwork","method":"POST","status":"ready"}`.

## Monitoring

Stream real-time logs from the deployed Worker:

```bash
npx wrangler tail
```

Failed proxy attempts are logged via `console.error` and visible in the tail output.

Worker analytics (request count, error rate, latency) are available in the Cloudflare Dashboard under **Workers & Pages → crunchwork-webhook-proxy → Analytics**.
