# 52 — Production deployment parity with staging

## Objective

Close the remaining gaps between the staging and production deployment pipelines so that production can be deployed with the same confidence, automation, and repeatability as staging. After completing this plan, a `v*.*.*` tag push will produce an end-to-end production deployment identical in shape to what staging receives on every `main` merge.

---

## Context & current state

| Layer | Staging | Production | Status |
|-------|---------|------------|--------|
| CD trigger | CI success on `main` | `v*.*.*` tag or manual dispatch | Intentional |
| Service matrix | 6 services + 2 jobs | Identical | On parity |
| Image tagging | `main-<sha7>` | Git tag name `vX.Y.Z` | **Blocker** |
| CI gate | `workflow_run` success required | No gate on tag push | Gap |
| Terraform plan in PR | In matrix | Excluded | Gap |
| Terraform apply | Auto on `main` | `if: false` | **Blocker** |
| `use_public_hostnames` | `true` in tfvars | Unset (defaults `false`) | **Blocker** |
| `cloud_run_use_bootstrap_image` | `false` | `true` | Gap |
| `auth_redis_secret.tf` | Present (bootstraps first version) | Missing | Gap |
| Secret seed script | `seed-staging-secrets.ps1` | None | Gap |
| Rollback script | `rollback.sh` (obsolete kubectl) | Same obsolete script | Gap |
| LB outputs / `use_public_hostnames` output | Present | Missing | Cosmetic |
| Production bootstrap runbook | — | None (`STAGING-BOOTSTRAP.md` only) | Gap |

---

## Steps

### 52.1 Fix CI image tagging for release tags

**Problem:** CI only publishes images tagged `main-<sha7>`. When `cd-production.yaml` resolves a semver tag (`v1.2.3`) it looks for `<service>:v1.2.3` which was never pushed.

**Solution:** Extend `.github/workflows/ci.yaml` to also tag images with the Git tag name when triggered by a tag push.

#### 52.1.1 Add tag trigger to CI workflow

```yaml
# .github/workflows/ci.yaml — add to the `on:` block
on:
  pull_request:
  push:
    branches: [main]
    tags: ["v*.*.*"]        # ← NEW: build + push on release tags
  workflow_dispatch:
    inputs:
      force_build_all:
        description: "Build and push ALL Docker images (skip path filters)"
        type: boolean
        default: false
```

#### 52.1.2 Publish dual tags when ref is a tag

In the `prepare-docker` job's `tag` step:

```yaml
      - id: tag
        run: |
          if [ "${{ github.ref_type }}" = "tag" ]; then
            echo "image_tag=${GITHUB_REF_NAME}" >> "$GITHUB_OUTPUT"
          else
            echo "image_tag=main-${GITHUB_SHA::7}" >> "$GITHUB_OUTPUT"
          fi
```

For release tags, every matrix image is built and pushed as `<service>:v1.2.3`. The CD production workflow then finds the exact tag.

#### 52.1.3 Force-build all images on tag push

In the `decide` step, treat tag pushes the same as `force_build_all`:

```yaml
      - id: decide
        name: Decide which images to build
        run: |
          FORCE="${{ github.event.inputs.force_build_all }}"
          # Always build everything on a release tag
          if [ "${{ github.ref_type }}" = "tag" ]; then
            FORCE="true"
          fi
          for image in api-server auth-server frontend provider-server claims-mcp ms-graph-mcp; do
            # ...existing change-detection...
            if [ "$FORCE" = "true" ] || [ "$changed" = "true" ]; then
              echo "$image=true" >> "$GITHUB_OUTPUT"
            else
              echo "$image=false" >> "$GITHUB_OUTPUT"
            fi
          done
```

#### Acceptance criteria

- [ ] Pushing `v1.0.0` tag triggers CI → builds all six images tagged `v1.0.0`
- [ ] `cd-production.yaml` finds `<service>:v1.0.0` in Artifact Registry
- [ ] Staging continues to receive `main-<sha7>` tags unchanged

---

### 52.2 Add CI success gate to production CD

**Problem:** `cd-staging` only runs after a successful `CI` workflow run. `cd-production` triggers directly on the tag push with no CI gate.

**Solution:** Add a `workflow_run` trigger or use `needs` pattern.

Since CI will now also run on tag pushes (§52.1.1), production CD can use the same `workflow_run` pattern as staging:

```yaml
# .github/workflows/cd-production.yaml — update `on:` block
on:
  workflow_run:
    workflows: ["CI"]
    types: [completed]
    tags: ["v*.*.*"]        # Only react to CI runs triggered by tags
  workflow_dispatch:
    inputs:
      image_tag:
        description: "Image tag to deploy (leave empty to use the git tag / SHA)"
        required: false
```

Add the `if` guard on the `deploy` job (already present in staging):

```yaml
  deploy:
    if: ${{ github.event_name == 'workflow_dispatch' || github.event.workflow_run.conclusion == 'success' }}
```

#### Acceptance criteria

- [ ] A failing CI on a tag push does **not** trigger production deploy
- [ ] Successful CI on tag push triggers `cd-production`
- [ ] Manual `workflow_dispatch` still works independently

---

### 52.3 Enable Terraform automation for production

**Problem:** `terraform.yaml` excludes production from both plan and apply.

**Solution:** Three sequential changes, gated on the production GCP project being bootstrapped.

#### 52.3.1 Add production to the plan matrix

```yaml
# .github/workflows/terraform.yaml — update matrix
    strategy:
      matrix:
        environment: [staging, production]    # ← add production
```

This gives PR-time visibility into production plan diffs.

#### 52.3.2 Enable apply-production job

Change the guard from `if: false` to:

```yaml
  apply-production:
    if: github.ref == 'refs/heads/main'
    needs: [apply-staging]
```

This makes production apply sequential after staging — staging is the canary.

#### 52.3.3 Add production to GitHub environments

Ensure the GitHub repo has an `environment: production` with:
- `WIF_PROVIDER` secret (same value — shared WIF in infra project)
- Required reviewers gate (optional but recommended for production)
- Deployment branch restriction: `main` only

#### Acceptance criteria

- [ ] PRs show `Terraform Plan (production)` comment alongside staging
- [ ] Merge to `main` applies staging first, then production
- [ ] Production apply can be gated behind environment reviewer approval

---

### 52.4 Set `use_public_hostnames = true` in production

**Problem:** Staging sets this in `terraform.tfvars`, production does not. Without it, OIDC issuer/callback/CORS URLs resolve to `*.run.app` while DNS and the HTTPS LB expect `app.branlamie.com` etc.

**Solution:**

```hcl
# deploy/terraform/environments/production/terraform.tfvars
project_id           = "claims-manager-production"
infra_project_id     = "claims-manager-infra-493807"
region               = "australia-southeast1"
environment          = "production"
cloudsql_tier        = "db-custom-4-16384"
dns_name             = "branlamie.com."
use_public_hostnames = true    # ← ADD
```

**Pre-condition:** The HTTPS LB must be live with valid Google-managed cert before flipping this. If applying before the LB is ready, leave it `false` and flip post-cutover.

#### Acceptance criteria

- [ ] `terraform plan` shows OIDC env vars switching from `*.run.app` → `app.branlamie.com` etc.
- [ ] Auth login flow works end-to-end via public hostname

---

### 52.5 Flip `cloud_run_use_bootstrap_image` to `false`

**Problem:** Production defaults to `true`, meaning all Cloud Run services deploy the public `hello` image. Health probes are disabled and the app cannot serve traffic.

**Solution:** After the first successful CI image push (§52.1), set:

```hcl
# deploy/terraform/environments/production/variables.tf — change default
variable "cloud_run_use_bootstrap_image" {
  type        = bool
  default     = false
  description = "Use hello image until first production image push (set false after first deploy)"
}
```

This is a one-time flip during initial bootstrap. Leave the variable so it can be re-enabled if the production project is ever re-created from scratch.

#### Acceptance criteria

- [ ] `terraform plan` shows real images replacing the bootstrap image
- [ ] Health probes enabled for all six services + two jobs

---

### 52.6 Port `auth_redis_secret.tf` to production

**Problem:** Staging bootstraps a first Secret Manager version for `auth-redis-encryption-key` so auth-server can mount `REDIS_ENCRYPTION_KEY`. Production has no equivalent — auth-server will fail env validation at boot.

**Solution:** Create `deploy/terraform/environments/production/auth_redis_secret.tf` with identical content (project reference differs via `var.project_id`):

```hcl
# Bootstrap a first version for auth-redis-encryption-key so Cloud Run can
# mount REDIS_ENCRYPTION_KEY at boot (NODE_ENV=production).
resource "random_id" "auth_redis_encryption_key" {
  byte_length = 32
}

resource "google_secret_manager_secret_version" "auth_redis_encryption_key" {
  secret      = "projects/${var.project_id}/secrets/auth-redis-encryption-key"
  secret_data = random_id.auth_redis_encryption_key.hex

  depends_on = [module.secrets]

  lifecycle {
    ignore_changes = [secret_data]
  }
}
```

Also add the `depends_on` reference back into the `cloud_run_auth` module in production `cloud_run.tf`:

```hcl
  depends_on = [
    google_project_service.run,
    module.secrets,
    google_secret_manager_secret_version.auth_redis_encryption_key,
  ]
```

#### Acceptance criteria

- [ ] `terraform apply` creates a version for `auth-redis-encryption-key`
- [ ] auth-server boots successfully with `REDIS_ENCRYPTION_KEY` populated

---

### 52.7 Generalise the secret-seed script for any environment

**Problem:** `seed-staging-secrets.ps1` hard-codes the staging project. Production has no equivalent — operators must manually add 25+ secret versions.

**Solution:** Refactor into `deploy/scripts/seed-secrets.ps1` that accepts an environment parameter.

#### 52.7.1 New script: `deploy/scripts/seed-secrets.ps1`

Key changes from staging script:

| Parameter | Default | Notes |
|-----------|---------|-------|
| `-Environment` | (required) | `staging` or `production` |
| `-Project` | derived from env | `claims-manager-staging-493807` or `claims-manager-production` |
| `-TerraformDir` | derived from env | `…/environments/<env>` |
| `-Force` | `$false` | Re-add versions |
| `-DryRun` | `$false` | Print plan only |

The script body remains identical; only the project ID and terraform dir are parameterised.

```powershell
[CmdletBinding()]
param(
   [Parameter(Mandatory)]
   [ValidateSet('staging', 'production')]
   [string]$Environment,

   [string]$Project,
   [string]$TerraformDir,
   [switch]$Force,
   [switch]$DryRun
)

# Derive defaults
if (-not $Project) {
   $Project = switch ($Environment) {
      'staging'    { 'claims-manager-staging-493807' }
      'production' { 'claims-manager-production' }
   }
}
if (-not $TerraformDir) {
   $TerraformDir = Join-Path $PSScriptRoot "..\terraform\environments\$Environment"
}
# … rest of script identical to seed-staging-secrets.ps1 …
```

#### 52.7.2 Deprecate `seed-staging-secrets.ps1`

Add a shim that calls the new script:

```powershell
# deploy/scripts/seed-staging-secrets.ps1 — DEPRECATED: use seed-secrets.ps1
Write-Warning "seed-staging-secrets.ps1 is deprecated. Use: pwsh deploy/scripts/seed-secrets.ps1 -Environment staging"
& "$PSScriptRoot/seed-secrets.ps1" -Environment staging @args
```

#### 52.7.3 Update `deploy/scripts/README.md`

```markdown
| Script | Purpose |
|--------|---------|
| [`seed-secrets.ps1`](seed-secrets.ps1) | Populate Secret Manager for any environment (`-Environment staging\|production`) |
| [`seed-staging-secrets.ps1`](seed-staging-secrets.ps1) | Deprecated shim → `seed-secrets.ps1 -Environment staging` |
| [`grant-provider-app.sql`](grant-provider-app.sql) | Least-privilege grants for `provider_app` SQL user |
```

#### Acceptance criteria

- [ ] `pwsh deploy/scripts/seed-secrets.ps1 -Environment production -DryRun` lists all 25+ secrets
- [ ] `-Environment staging` produces identical behaviour to the old script
- [ ] Old script still works (shim) but prints deprecation warning

---

### 52.8 Add missing outputs to production Terraform

**Problem:** Staging exposes `lb_ip` and `use_public_hostnames` outputs used by DNS setup documentation and the seed script. Production omits them.

**Solution:** Add to `deploy/terraform/environments/production/outputs.tf`:

```hcl
output "use_public_hostnames" {
  value       = var.use_public_hostnames
  description = "Whether OIDC env uses Cloudflare public hostnames vs *.run.app"
}

output "lb_ip" {
  value       = module.https_lb.lb_ip
  description = "Global anycast IP for the HTTPS load balancer (point DNS A records here)"
}
```

#### Acceptance criteria

- [ ] `terraform output lb_ip` returns the LB IP for DNS configuration
- [ ] `terraform output use_public_hostnames` confirms public hostnames are active

---

### 52.9 Replace obsolete rollback script

**Problem:** `deploy/scripts/rollback.sh` uses `kubectl` to roll back GKE deployments. Both staging and production now run Cloud Run. The script will not work in either environment.

**Solution:** Rewrite `rollback.sh` for Cloud Run revision rollback.

```bash
#!/usr/bin/env bash
set -euo pipefail

REGISTRY="australia-southeast1-docker.pkg.dev/claims-manager-infra-493807/claims-manager"

usage() {
  echo "Usage: $0 <environment> <service> <previous-tag>"
  echo ""
  echo "Environments: staging, production"
  echo "Services: api-server, auth-server, frontend, provider-server, claims-mcp, ms-graph-mcp"
  echo ""
  echo "Example: $0 staging api-server main-abc1234"
  exit 1
}

[[ $# -lt 3 ]] && usage

ENVIRONMENT=$1
SERVICE=$2
TAG=$3

case "$ENVIRONMENT" in
  staging)    PROJECT="claims-manager-staging-493807" ;;
  production) PROJECT="claims-manager-production" ;;
  *) echo "ERROR: Unknown environment '$ENVIRONMENT'" >&2; usage ;;
esac

REGION="australia-southeast1"
IMAGE="${REGISTRY}/${SERVICE}:${TAG}"

echo "[rollback.sh] Rolling back ${SERVICE} in ${ENVIRONMENT} to ${IMAGE}"

gcloud run services update "$SERVICE" \
  --project "$PROJECT" \
  --region "$REGION" \
  --image "$IMAGE"

echo "[rollback.sh] Waiting for new revision to become serving…"
gcloud run services describe "$SERVICE" \
  --project "$PROJECT" \
  --region "$REGION" \
  --format="value(status.url)"

echo "[rollback.sh] Rollback of ${SERVICE} to ${TAG} in ${ENVIRONMENT} completed"
```

#### Acceptance criteria

- [ ] `./deploy/scripts/rollback.sh staging api-server main-abc1234` rolls back via `gcloud run services update`
- [ ] Production rollback uses the same script with `production` environment
- [ ] Old kubectl references are removed

---

### 52.10 Create production bootstrap runbook

**Problem:** `deploy/STAGING-BOOTSTRAP.md` documents the staging bootstrap end-to-end. No equivalent exists for production.

**Solution:** Create `deploy/PRODUCTION-BOOTSTRAP.md`.

```markdown
# Production bootstrap runbook

Production is **Cloud Run only** (same architecture as staging). See [`CLOUD_RUN.md`](CLOUD_RUN.md).

## Prerequisites

- Infra bootstrap applied (`deploy/terraform/bootstrap/infra`) — state bucket, Artifact Registry, WIF.
- GitHub environment `production` with `WIF_PROVIDER` secret and required reviewer gate.
- Production GCP project (`claims-manager-production`) exists with billing enabled.

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
3. `cd-production` updates Cloud Run revisions, runs `migrate-api`, then `seed-auth-rbac`.

## 4. Flip bootstrap image off

After first deploy succeeds, if not already done:

```hcl
# deploy/terraform/environments/production/terraform.tfvars (or variables.tf default)
cloud_run_use_bootstrap_image = false
```

Re-apply Terraform so health probes switch to real endpoints.

## 5. DNS / Cloudflare

Grey-cloud A records for `app` / `auth` / `api` / `providers` → LB IP (`terraform output lb_ip`).

Google-managed cert covers all four hostnames. Wait for cert provisioning (up to 24h).

## 6. Enable public hostnames

```hcl
# deploy/terraform/environments/production/terraform.tfvars
use_public_hostnames = true
```

Re-apply Terraform. Verify OIDC login + callback work via `https://app.branlamie.com`.

## 7. Manual secrets

Replace any `REPLACE_ME` placeholders:
- `auth-google-client-id` / `auth-google-client-secret` (Google OAuth)
- `openai-api-key`
- `stripe-secret-key` / `stripe-webhook-secret` / `stripe-connect-client-id`
- `more0-api-key` / `more0-tool-secret` (More0 gateway)
- `resend-api-key` (transactional email)

## Verify

- [ ] All six Cloud Run services showing `Ready`
- [ ] `migrate-api` job succeeded
- [ ] `seed-auth-rbac` job succeeded
- [ ] Auth login flow works end-to-end
- [ ] Webhook ingest on `providers.branlamie.com` reaches `provider-server`
- [ ] Template sync populated GCS bucket
```

#### Acceptance criteria

- [ ] Document exists and accurately mirrors the staging runbook structure
- [ ] Operators can follow it without referencing staging docs

---

### 52.11 Verify end-to-end production deploy (smoke test)

After all previous steps are complete, run through:

1. Push a `vX.Y.Z` tag from `main`
2. Confirm CI builds + pushes all six images tagged `vX.Y.Z`
3. Confirm `cd-production` triggers after CI success
4. Confirm Cloud Run services update to new revision
5. Confirm `migrate-api` job succeeds
6. Confirm `seed-auth-rbac` job succeeds
7. Confirm OIDC login at `https://app.branlamie.com/api/auth/callback` completes
8. Confirm webhook delivery to `providers.branlamie.com` reaches `provider-server`
9. Confirm `gcloud run services list --project claims-manager-production` shows all healthy

---

## Implementation order

| Phase | Steps | Dependency | Effort |
|-------|-------|------------|--------|
| **A — Image pipeline** | 52.1, 52.2 | None | 1–2 h |
| **B — Terraform activation** | 52.3, 52.4, 52.5, 52.6, 52.8 | Phase A (need images for bootstrap-off) | 2–3 h |
| **C — Secrets & scripts** | 52.7, 52.9 | Phase B (need terraform outputs) | 1–2 h |
| **D — Documentation** | 52.10 | Phases A–C complete | 0.5 h |
| **E — Smoke test** | 52.11 | All above | 0.5 h |

**Total estimated effort:** 5–8 hours

---

## Intentional differences (not defects)

These are deliberate production hardening choices that should remain divergent from staging:

| Area | Staging | Production | Rationale |
|------|---------|------------|-----------|
| Frontend sizing | 1 vCPU / 768Mi | 2 vCPU / 1Gi | Production handles more concurrent users |
| Cloud SQL | ZONAL, 7-day backup | REGIONAL, 30-day backup | HA + longer retention for production |
| Cloud SQL tier | db-custom-1-3840 | db-custom-4-16384 | Larger production workload |
| Memorystore | BASIC 1 GB | STANDARD_HA 3 GB | HA Redis for session/OIDC store |
| Hostnames | `*-staging.branlamie.com` | `*.branlamie.com` (no suffix) | Standard env separation |
| LB cert domains | Omits `providers` (CF Worker fanout) | Includes `providers` | Production uses grey-cloud DNS |
| CD trigger | Every `main` merge via CI | Opt-in via semver tag | Controlled production releases |
| Subnet CIDRs | Explicit overrides (orphan GKE history) | Module defaults | Clean project, no legacy subnets |

---

## Acceptance criteria (overall)

- [ ] Tag push `v*.*.*` triggers CI → builds all images → CD deploys to production
- [ ] Terraform plan/apply covers both staging and production in CI
- [ ] OIDC login works end-to-end on public production hostnames
- [ ] Secret Manager fully populated (no `REPLACE_ME` on critical secrets)
- [ ] Rollback script works for Cloud Run on both environments
- [ ] Bootstrap runbook documents the full production setup path
- [ ] No regressions to staging CD pipeline
