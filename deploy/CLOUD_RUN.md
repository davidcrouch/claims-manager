# Cloud Run deployment model

Target architecture for Claims Manager (low throughput, multi-process):

| Service | Exposure | Notes |
|---------|----------|--------|
| `provider-server` | Public | Provider webhooks (Crunchwork); writes `inbound_webhook_events` |
| `api-server` | Private (`INGRESS_TRAFFIC_INTERNAL_ONLY`) | Domain API for app/mcp; LibreOffice; More0 tools |
| `auth-server` | Public | OIDC |
| `frontend` | Public | Next.js BFF |
| `migrate-api` | Job | Drizzle migrations |

**Data plane (unchanged):** Cloud SQL Postgres (`claims_manager`) + Memorystore Redis + GCS + Pub/Sub.

**Same database:** `provider-server` and `api-server` share `claims_manager`. Prefer SQL user `provider_app` (see [`scripts/grant-provider-app.sql`](scripts/grant-provider-app.sql)).

GKE (`deploy/k8s/**`) is dormant for this product. The staging Compose VM remains until DNS cutover.

## Terraform (staging)

Files:

- [`terraform/modules/cloud_run_service`](terraform/modules/cloud_run_service) — reusable service + optional domain mapping
- [`terraform/environments/staging/cloud_run.tf`](terraform/environments/staging/cloud_run.tf) — api / auth / frontend / provider + migrate Job

Variables:

| Variable | Default | Meaning |
|----------|---------|---------|
| `enable_cloud_run` | `true` | Provision Cloud Run services |
| `dns_edge` | `vm` | `vm` = DNS A→Caddy MIG; `cloudrun` = CNAME→`ghs.googlehosted.com` |
| `cloud_run_image_tag` | `latest` | Initial image tag in terraform |

### Apply (first time)

```bash
cd deploy/terraform/environments/staging
# Defaults: enable_cloud_run=true, dns_edge=vm, cloud_run_use_bootstrap_image=true
terraform apply
```

Then:

1. Seed secrets (includes `database-url-provider`):
   ```powershell
   pwsh deploy/scripts/seed-staging-secrets.ps1
   ```
2. Grant SQL privileges for `provider_app`:
   ```bash
   psql "$DATABASE_URL_ADMIN" -f deploy/scripts/grant-provider-app.sql
   ```
3. CI `workflow_dispatch` with `force_build_all=true` to push all four images (including `provider-server`).
4. `cd-cloudrun-staging` updates Cloud Run revisions to real images.
5. Optionally set `cloud_run_use_bootstrap_image=false` and re-apply to enable HTTP probes.

### Cutover from Compose VM

1. Confirm Cloud Run health on `*.run.app` URIs (`terraform output cloud_run_uris`).
2. Point CF Worker / Crunchwork at `provider-server` URI (or `providers-staging` after DNS flip).
3. Set `dns_edge = "cloudrun"` and `terraform apply`.
4. Update frontend server-side env so BFF calls the **private** api URI with identity (not a public API hostname).
5. When stable, power down / destroy `module.staging_vm` (data disk has `prevent_destroy` — plan carefully).

## CI / CD

| Workflow | Role |
|----------|------|
| [`.github/workflows/ci.yaml`](../.github/workflows/ci.yaml) | Matrix Docker builds for api / auth / frontend / **provider-server** |
| [`.github/workflows/cd-cloudrun-staging.yaml`](../.github/workflows/cd-cloudrun-staging.yaml) | Updates Cloud Run images + migrate Job after CI |
| [`.github/workflows/cd-staging.yaml`](../.github/workflows/cd-staging.yaml) | Legacy Compose VM deploy (keep until cutover) |

## App sources

- [`apps/provider`](../apps/provider) — `provider-server` Nest ingest app
- Webhook handlers remain on `apps/api` until traffic is fully cut over; then deprecate public webhook routes on api
