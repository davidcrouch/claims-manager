# Cloud Run deployment model

Claims Manager runs **Cloud Run only** (staging and production). No GKE, no Compose VM.

| Service | Exposure | Staging | Production |
|---------|----------|---------|------------|
| `provider-server` | Public | 1 vCPU / 512Mi | same |
| `api-server` | IAM-private (`allow_unauthenticated=false`) | 2 vCPU / 2Gi | same |
| `auth-server` | Public | 1 vCPU / 768Mi | same |
| `frontend` | Public | 1 vCPU / 768Mi | **2 vCPU / 1Gi** |
| `claims-mcp` | IAM-private | 1 vCPU / 512Mi | same |
| `ms-graph-mcp` | IAM-private | 1 vCPU / 512Mi | same |
| `migrate-api` | Job | 1 vCPU / 1Gi | same |
| `seed-auth-rbac` | Job | 1 vCPU / 512Mi | same |

**Data plane:** Cloud SQL Postgres + Memorystore Redis + GCS + Pub/Sub.

**Same database:** `provider-server` and `api-server` share `claims_manager`. Prefer SQL user `provider_app` ([`scripts/grant-provider-app.sql`](scripts/grant-provider-app.sql)).

**Hostnames:** GCP HTTPS Load Balancer with serverless NEGs terminates TLS (Google-managed cert) and routes by hostname to Cloud Run. Cloudflare DNS is grey-cloud A records to the LB IP. No Workers or Origin Rules needed. `api-server` / MCP services are **not** on the LB — only invoker SAs can call them (Google ID token + app JWT / `x-internal-token`).

**New-org seeding:**
- Signup creates org → auth-server `SEED_NEW_TENANTS=true` + `API_INTERNAL_URL` → `POST /internal/seed-tenant` (catalog, MCP, lookups; Crunchwork staging connection when the org is Ensure Construction).
- CLI `pnpm --filter api run db:seed` upserts Ensure Construction Pty Ltd + its Crunchwork staging connection.
- First login → frontend provisioning flow (`filesystem` / templates / catalog) when `organizations.provisioning_status != complete`.

**Networking:** Active subnet is `claims-manager-private-<env>`. An orphan `claims-manager-gke-staging` subnet may remain until GCP releases stuck serverless address reservations — it is unused.

## Terraform

| Env | Path |
|-----|------|
| Staging | [`terraform/environments/staging`](terraform/environments/staging) |
| Production | [`terraform/environments/production`](terraform/environments/production) |

Shared module: [`terraform/modules/cloud_run_service`](terraform/modules/cloud_run_service).

```bash
cd deploy/terraform/environments/staging   # or production
terraform apply
```

After first image push, keep `cloud_run_use_bootstrap_image=false` (staging default).

## CI / CD

| Workflow | Role |
|----------|------|
| [`.github/workflows/ci.yaml`](../.github/workflows/ci.yaml) | Matrix Docker builds (api / auth / frontend / provider / claims-mcp / ms-graph-mcp) |
| [`.github/workflows/cd-staging.yaml`](../.github/workflows/cd-staging.yaml) | Update staging Cloud Run images, then `migrate-api`, then `seed-auth-rbac` |
| [`.github/workflows/cd-production.yaml`](../.github/workflows/cd-production.yaml) | Update production Cloud Run on `v*.*.*` tags, then migrate + RBAC seed |

## App sources

- [`apps/provider`](../apps/provider) — public webhook ingest
- [`apps/api`](../apps/api) — private domain API
- [`apps/auth-server`](../apps/auth-server) — OIDC
- [`apps/frontend`](../apps/frontend) — Next.js BFF
- [`apps/claims-mcp`](../apps/claims-mcp) — MCP server (claims-api tools)
- [`apps/ms-graph-mcp`](../apps/ms-graph-mcp) — MCP server (Microsoft Graph)
