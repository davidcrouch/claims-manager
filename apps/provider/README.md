# provider-server

Public Cloud Run service for **inbound provider traffic** (Crunchwork webhooks first).

## Responsibility

1. HMAC-verify provider webhooks  
2. Dedupe + persist `inbound_webhook_events`  
3. Enqueue processing via More0 gateway (`WEBHOOK_PROCESSING_MODE=more0`)  
4. Return `200` quickly  

Heavy fetch/projection/tool endpoints stay on private `api-server`.

## Routes

| Method | Path | Notes |
|--------|------|--------|
| POST | `/api/v1/webhooks/crunchwork` | Public entry point (intercepted by CF Worker on staging) |
| GET | `/api/v1/webhooks/crunchwork` | Probe stub — confirms route is mounted (ingest is POST-only) |
| POST | `/api/v1/internal/webhooks/crunchwork` | Internal ingest — CF Worker fans out here on Cloud Run origin |
| GET | `/api/v1/internal/webhooks/crunchwork` | Probe stub for internal ingest path |
| POST | `/api/webhook` | Alias for legacy configs |
| GET | `/api/webhook` | Probe stub for alias path |
| GET | `/api/v1/health` | Liveness |
| GET | `/api/v1/health/ready` | DB readiness |

## Database

Shares Cloud SQL `claims_manager` with `api-server`. Prefer the `provider_app` SQL user (least privilege on ingest tables). Schema migrations remain in `apps/api`.

## Local

```bash
cp .env.example .env
pnpm --filter provider dev
```

## Image

```bash
docker build -f apps/provider/Dockerfile -t provider-server .
```
