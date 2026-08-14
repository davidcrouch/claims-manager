# Crunchwork Webhook Proxy

Cloudflare Worker that intercepts Crunchwork staging webhooks at `providers-staging.branlamie.com/api/v1/webhooks/crunchwork` and fans out to both the staging HTTPS LB and the local dev tunnel:

- **Primary (awaited):** `api-staging.branlamie.com/api/v1/webhooks/crunchwork` (grey-cloud DNS → GCP HTTPS LB → `api-server` Cloud Run)
- **Secondary (fire-and-forget):** `api-dev.branlamie.com/api/v1/webhooks/crunchwork` → local `:5001`

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
│ GCP HTTPS LB (grey-cloud DNS)  │  │ api-dev (tunnel)           │
│ api-staging.branlamie.com       │  │ api-dev.branlamie.com      │
│ → api-server Cloud Run          │  │ → local :5001              │
│ /api/v1/webhooks/crunchwork    │  │ /api/v1/webhooks/crunchwork│
└─────────────────────────────────┘  └────────────────────────────┘
```

### DNS setup

`providers-staging.branlamie.com` is **orange-cloud** (Cloudflare-proxied) so the Worker can intercept. `api-staging.branlamie.com` is **grey-cloud** (DNS-only) pointing to the GCP HTTPS LB IP so Google can validate the managed SSL certificate.

### Production

Production does not use a Worker. Crunchwork posts directly to the provider host via the GCP HTTPS LB:

| Environment | URL | Routing |
|---|---|---|
| Staging | `providers-staging.branlamie.com/…` | CF Worker → LB (`api-staging`) + dev tunnel |
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
curl -X POST \
  https://providers-staging.branlamie.com/api/v1/webhooks/crunchwork \
  -H "Content-Type: application/json" \
  -d '{"test": true}'
```

The response should come from `api-server` via the staging HTTPS LB, with the original status code and body intact.

## Monitoring

Stream real-time logs from the deployed Worker:

```bash
npx wrangler tail
```

Failed proxy attempts are logged via `console.error` and visible in the tail output.

Worker analytics (request count, error rate, latency) are available in the Cloudflare Dashboard under **Workers & Pages → crunchwork-webhook-proxy → Analytics**.
