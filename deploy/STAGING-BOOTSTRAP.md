# Staging bootstrap runbook

Staging is **Cloud Run only**. See [`CLOUD_RUN.md`](CLOUD_RUN.md).

## Prerequisites

- Infra bootstrap applied (`deploy/terraform/bootstrap/infra`) — state bucket, Artifact Registry, WIF.
- GitHub environment `staging` with `WIF_PROVIDER` secret.

## Apply staging terraform

```bash
cd deploy/terraform/environments/staging
terraform init
terraform apply
```

## Seed secrets

```powershell
pwsh deploy/scripts/seed-staging-secrets.ps1
```

Grant provider SQL user:

```bash
psql "$DATABASE_URL_ADMIN" -f deploy/scripts/grant-provider-app.sql
```

## First images + deploy

1. CI on `main` (or `workflow_dispatch` with `force_build_all=true`) builds four images.
2. `cd-staging` updates Cloud Run revisions, runs `migrate-api`, then `seed-auth-rbac`, `seed-api-lookups`, and `ingest-api-guides`.

## Cloudflare

DNS A records (grey-cloud / DNS-only) for `app-staging` / `auth-staging` / `providers-staging` point to the GCP HTTPS Load Balancer IP (from `terraform output lb_ip`).

The LB terminates TLS with a Google-managed cert and routes to Cloud Run via serverless NEGs. No Workers, Origin Rules, or code changes needed.

Set `use_public_hostnames=true` in staging `terraform.tfvars` (already done) so OIDC issuer/callbacks match.
