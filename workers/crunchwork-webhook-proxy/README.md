# Crunchwork Webhook Proxy

Cloudflare Worker that transparently proxies Crunchwork webhook requests from `ensure-test.more0.dev/api/webhook` to the EnsureOS staging API at `app-staging.branlamie.com/api/webhook`.

## Architecture

```
Crunchwork SaaS
       │
       │  POST /api/webhook (HMAC-signed payload)
       ▼
┌──────────────────────────────────────────────────┐
│  Cloudflare Edge                                 │
│  Worker: crunchwork-webhook-proxy                │
│  Route: ensure-test.more0.dev/api/webhook        │
│                                                  │
│  Preserves: method, headers, body, status        │
│  Redirects: disabled (manual)                    │
└──────────────────┬───────────────────────────────┘
                   │
                   ▼
┌──────────────────────────────────────────────────┐
│  EnsureOS Staging                                │
│  https://app-staging.branlamie.com/api/webhook   │
└──────────────────────────────────────────────────┘
```

## Prerequisites

- Node.js 18+
- A Cloudflare account with access to the `more0.dev` zone
- Wrangler CLI (installed as a dev dependency)

## DNS Configuration

The Cloudflare DNS zone for `more0.dev` must contain a proxied (orange cloud) record for `ensure-test`:

| Type | Name          | Content              | Proxy |
|------|---------------|----------------------|-------|
| A    | ensure-test   | 192.0.2.1 (any IP)   | On    |

The IP address is irrelevant — the Worker route intercepts requests before they reach an origin. The orange Cloudflare proxy **must** be enabled.

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
  http://localhost:8787/api/webhook \
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
  https://ensure-test.more0.dev/api/webhook \
  -H "Content-Type: application/json" \
  -d '{"test": true}'
```

The response should come from EnsureOS staging, with the original status code and body intact.

## Monitoring

Stream real-time logs from the deployed Worker:

```bash
npx wrangler tail
```

Failed proxy attempts are logged via `console.error` and visible in the tail output.

Worker analytics (request count, error rate, latency) are available in the Cloudflare Dashboard under **Workers & Pages → crunchwork-webhook-proxy → Analytics**.

## Future Roadmap

This Worker is the first stage of a generic webhook routing architecture:

```
Crunchwork ──┐
             ▼
      Cloudflare Worker
             │
             ├── EnsureOS Staging
             ├── EnsureOS Production
             ├── More0
             ├── Salestrekker
             └── Other Integrations
```

Future iterations may introduce:
- Route maps keyed by path, header, or query parameter
- Environment-based target URLs via Wrangler vars
- Request/response logging for audit trails
- Fan-out to multiple downstream targets
- KV/D1-backed dynamic routing configuration
