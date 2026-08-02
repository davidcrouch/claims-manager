# Cloud Run deployment model

Claims Manager runs **Cloud Run only** (staging and production). No GKE, no Compose VM.

| Service | Exposure | Staging size | Production size |
|---------|----------|--------------|-----------------|
| `provider-server` | Public | 1 vCPU / 512Mi | 2 vCPU / 1Gi |
| `api-server` | Private (`INTERNAL_ONLY`) | 2 vCPU / 2Gi | 4 vCPU / 4Gi |
| `auth-server` | Public | 1 vCPU / 768Mi | 2 vCPU / 1Gi |
| `frontend` | Public | 1 vCPU / 768Mi | 2 vCPU / 1Gi |
| `migrate-api` | Job | 1 vCPU / 1Gi | 2 vCPU / 2Gi |

**Data plane:** Cloud SQL Postgres + Memorystore Redis + GCS + Pub/Sub.

**Same database:** `provider-server` and `api-server` share `claims_manager`. Prefer SQL user `provider_app` ([`scripts/grant-provider-app.sql`](scripts/grant-provider-app.sql)).

**Hostnames:** Cloudflare → `*.run.app` service URLs. Cloud Run domain mappings are not used (unsupported in `australia-southeast1`).

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
| [`.github/workflows/ci.yaml`](../.github/workflows/ci.yaml) | Matrix Docker builds (api / auth / frontend / provider) |
| [`.github/workflows/cd-staging.yaml`](../.github/workflows/cd-staging.yaml) | Update staging Cloud Run images + migrate Job after CI |
| [`.github/workflows/cd-production.yaml`](../.github/workflows/cd-production.yaml) | Update production Cloud Run on `v*.*.*` tags |

## App sources

- [`apps/provider`](../apps/provider) — public webhook ingest
- [`apps/api`](../apps/api) — private domain API
- [`apps/auth-server`](../apps/auth-server) — OIDC
- [`apps/frontend`](../apps/frontend) — Next.js BFF
