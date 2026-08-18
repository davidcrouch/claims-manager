# Production bootstrap runbook

Production is **Cloud Run only** (same architecture as staging). See [`CLOUD_RUN.md`](CLOUD_RUN.md).

## Prerequisites

- Infra bootstrap applied (`deploy/terraform/bootstrap/infra`) — state bucket, Artifact Registry, WIF.
- GitHub environment `production` with `WIF_PROVIDER` secret and (recommended) required reviewer gate.
- Production GCP project (`claims-manager-prod-493807`) exists with billing enabled.

## 1. Apply production Terraform

```bash
cd deploy/terraform/environments/production
terraform init
terraform apply
```

Or from repo root:

```bash
./deploy/scripts/apply-terraform.sh production apply
```

## 2. Seed secrets

```powershell
pwsh deploy/scripts/seed-secrets.ps1 -Environment production
```

Grant provider SQL user:

```bash
psql "$DATABASE_URL_ADMIN" -f deploy/scripts/grant-provider-app.sql
```

## 3. First images + deploy

1. Push a `v*.*.*` tag (or run `workflow_dispatch` on CI with `force_build_all=true`).
2. CI builds all six images tagged with the release version.
3. `cd-production` triggers after CI success — updates Cloud Run revisions, runs `migrate-api`, then `seed-auth-rbac`.

## 4. Flip bootstrap image off

After first deploy succeeds, verify `cloud_run_use_bootstrap_image` is `false` in `variables.tf` (already the default after this plan). If you overrode it to `true` during initial bootstrap, set it back:

```hcl
# deploy/terraform/environments/production/variables.tf
variable "cloud_run_use_bootstrap_image" {
  default = false
}
```

Re-apply Terraform so health probes switch to real endpoints.

## 5. DNS / Cloudflare

Grey-cloud A records for `app` / `auth` / `api` / `providers` → LB IP:

```bash
terraform output lb_ip
```

Google-managed cert covers all four hostnames. Wait for cert provisioning (up to 24h for new domains).

## 6. Verify public hostnames

`use_public_hostnames = true` is set in `terraform.tfvars`. After DNS propagation and cert provisioning, verify:

- `https://app.branlamie.com` loads the frontend
- `https://auth.branlamie.com/.well-known/openid-configuration` returns OIDC discovery
- `https://api.branlamie.com/api/v1/health` returns `{ "status": "ok" }`
- `https://providers.branlamie.com/api/v1/health` returns `{ "status": "ok" }`

## 7. Manual secrets

Replace any `REPLACE_ME` placeholders (the seed script writes these as markers):

| Secret | Where to get it |
|--------|-----------------|
| `auth-google-client-id` | GCP Console → APIs & Services → Credentials → OAuth 2.0 |
| `auth-google-client-secret` | Paired with the above |
| `openai-api-key` | https://platform.openai.com/api-keys |
| `stripe-secret-key` | Stripe dashboard — **live** mode key |
| `stripe-webhook-secret` | Stripe dashboard — webhook endpoint signing secret |
| `stripe-connect-client-id` | Stripe dashboard — Connect client id (ca_...) |
| `more0-api-key` | More0 gateway dashboard |
| `more0-tool-secret` | More0 tool auth shared secret |
| `resend-api-key` | https://resend.com/api-keys |

Update with:

```bash
echo -n "ACTUAL_VALUE" | gcloud secrets versions add <SECRET_NAME> \
  --project=claims-manager-prod-493807 --data-file=-
```

## 8. Verify end-to-end

- [ ] All six Cloud Run services showing `Ready`
- [ ] `migrate-api` job succeeded
- [ ] `seed-auth-rbac` job succeeded
- [ ] Auth login flow works end-to-end via `https://app.branlamie.com`
- [ ] Webhook ingest on `providers.branlamie.com` reaches `provider-server`
- [ ] Template sync populated GCS bucket (`claims-manager-production-documents`)

## Rollback

```bash
./deploy/scripts/rollback.sh production <service> <previous-tag>
```

Example:

```bash
./deploy/scripts/rollback.sh production api-server v1.0.0
```
