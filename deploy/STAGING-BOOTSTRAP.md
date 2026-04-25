# Staging bootstrap runbook

End-to-end sequence to bring the `staging.branlamie.com` environment up
from empty GCP projects. Follow top-to-bottom exactly once; subsequent
deploys go through GitHub Actions (`.github/workflows/ci.yaml` +
`cd-staging.yaml`).

Assumptions going in:

- GCP projects `claims-manager-infra-493807` and
  `claims-manager-staging-493807` exist under the
  `branlamie.com/claims-manager` folder. (GCP auto-suffixed the IDs
  because `claims-manager-infra` / `claims-manager-staging` were
  globally taken; the `-493807` suffix is the immutable project ID.)
- Both projects have a billing account attached.
- You control the `branlamie.com` zone at your domain registrar.
- GitHub repo is `davidcrouch/claims-manager` (update
  `deploy/terraform/bootstrap/infra/terraform.tfvars` if forked).

Commands are PowerShell (Windows). Scripts are compatible with Windows
PowerShell 5.x (`powershell`) and PowerShell 7 (`pwsh`); invoke them
with `.\path\to\script.ps1` to avoid the `pwsh` / `powershell`
distinction entirely.

---

## Step 1 - Authenticate gcloud

The bootstrap runs under an identity that can grant `roles/owner`-level
bindings in both GCP projects.

```powershell
gcloud auth login admin@branlamie.com
gcloud auth application-default login
gcloud projects describe claims-manager-infra-493807    --format='value(projectId)'
gcloud projects describe claims-manager-staging-493807  --format='value(projectId)'
```

If either `describe` returns `permission denied`, you are not signed in
as an identity with Owner / Project Creator on the folder. Fix that
before continuing - nothing below will work otherwise.

## Step 2 - Bootstrap `claims-manager-infra-493807`

Creates the terraform state bucket, `ci-deployer` SA, Workload Identity
Federation, and the cross-project IAM grants ci-deployer needs in
staging.

```powershell
cd deploy/terraform/bootstrap/infra
terraform init
terraform apply
```

Capture outputs you will need in later steps:

```powershell
terraform output -raw wif_provider       # → copy for GitHub secret
terraform output -raw ci_deployer_email  # → already referenced in workflows
```

Expected `wif_provider` format:

```
projects/<INFRA_PROJECT_NUMBER>/locations/global/workloadIdentityPools/github-actions/providers/github
```

The local `terraform.tfstate` in this folder is the only record of the
WIF pool + ci-deployer identity until the state bucket is in use - keep
it out of git (already covered by `.gitignore`) and stash a backup.

## Step 3 - Set the `WIF_PROVIDER` GitHub Actions secret

No `gh` CLI on this machine, so set it manually:

1. GitHub → repo → **Settings → Secrets and variables → Actions**
2. New repository secret:
   - Name: `WIF_PROVIDER`
   - Value: the string from `terraform output -raw wif_provider`

If/when you're ready, create a GitHub **environment** named `staging` as
well (referenced by `cd-staging.yaml`). Protection rules (required
reviewers, branch policy) are up to you.

## Step 4 - Apply the staging environment

Creates VPC, CloudSQL, Memorystore, GCS, DNS zone, Secret Manager
shells, the VM MIG, and IAM.

```powershell
cd ../../environments/staging
terraform init
terraform apply
```

Expect first apply to take ~15-20 min: CloudSQL + Memorystore + private
service access peering are the slow parts. The VM boots but exits
"no compose.yaml at /mnt/disks/data/compose; waiting for CI" until
Step 7.

After apply, record:

```powershell
terraform output -raw staging_vm_public_ip
terraform output -json cloudsql_database_names
```

## Step 5 - Delegate the `staging.branlamie.com` DNS zone

Terraform created the managed zone but only Google Cloud DNS knows about
it until you delegate at the parent registrar.

```powershell
gcloud dns managed-zones describe claims-manager-staging \
  --project=claims-manager-staging-493807 \
  --format='value(nameServers)'
```

Take the four `ns-cloud-*.googledomains.com` entries and create an `NS`
record for `staging.branlamie.com` at your `branlamie.com` registrar
pointing to them. Propagation is typically < 15 min.

Verify:

```powershell
nslookup -type=ns staging.branlamie.com
```

## Step 6 - Seed Secret Manager

`module.secrets` created empty secret shells in Step 4. This script
writes values. It is idempotent.

```powershell
cd ../../..                                                # repo root
.\deploy\scripts\seed-staging-secrets.ps1 -DryRun   # preview
.\deploy\scripts\seed-staging-secrets.ps1          # apply
```

Works under Windows PowerShell 5.x as well as PowerShell 7+. If you get
an execution-policy error on the first run, allow it for this session
only: `Set-ExecutionPolicy -Scope Process Bypass` and retry.

At the end of the run, replace any `REPLACE_ME` placeholders for:

| Secret                      | Source                                            |
| --------------------------- | ------------------------------------------------- |
| `auth-google-client-id`     | GCP Console → APIs & Services → Credentials       |
| `auth-google-client-secret` | paired with the above                             |
| `openai-api-key`            | platform.openai.com                               |
| `stripe-secret-key`         | Stripe dashboard (test mode for staging)          |
| `stripe-webhook-secret`     | Stripe dashboard → webhook signing secret         |
| `stripe-connect-client-id`  | Stripe dashboard → Connect                        |
| `mz-client-credentials`     | MoreZero admin                                    |
| `nats-url`                  | Safe to leave REPLACE_ME - staging doesn't use it |
| `oidc-jwks`                 | Safe to leave REPLACE_ME - unused slot            |
| `internal-api-token`        | Auto-generated by `seed-staging-secrets.ps1` (random 32B hex). Shared secret that gates api-server `/internal/*` routes. No human action needed unless rotating. |

Update a placeholder:

```powershell
'<actual-value>' | Out-File -NoNewline secret.txt -Encoding utf8
gcloud secrets versions add auth-google-client-id `
  --project=claims-manager-staging-493807 --data-file=secret.txt
Remove-Item secret.txt
```

## Step 7 - Trigger the first CD run

The VM is booted and idle. CI has not built any images yet. Push a
commit to `main` (or dispatch the workflow manually) so the `CI`
workflow builds and pushes images, then `cd-staging` ships them.

```powershell
# from repo root, with `gh` or via browser
git commit --allow-empty -m "bootstrap staging"
git push origin main
```

Watch:

- `CI` workflow builds `api-server`, `auth-server`, `frontend` and
  pushes to `australia-southeast1-docker.pkg.dev/claims-manager-infra-493807/claims-manager/*`.
- `Deploy Staging` workflow uploads the compose tree to the VM over IAP,
  re-renders `staging.env`, runs API database migrations, and boots the
  compose stack.

## Per-tenant sample data

Staging auto-seeds the `sample-data` set into every brand-new
organization at signup. The flow is:

1. `auth-server` creates a brand-new organization as part of the signup
   flow (scenario = `new_user_new_organization` for OAuth first-signup,
   or `existing_user_new_organization` for the normal password `/register`
   flow where the user row is created slightly before the org).
2. `auth-server` fires a background `POST http://api-server:3001/api/v1/internal/seed-tenant`
   with the new `tenantId`, carrying the `x-internal-token` header.
3. `api-server` verifies the token + `SEED_NEW_TENANTS=true`, then runs
   `seedSampleDataForTenant({ tenantId })` (same code path as
   `pnpm --filter api run db:seed`, just parameterised on the new org).

Both wires are env-gated:

- `INTERNAL_API_TOKEN` - populated from the `internal-api-token` secret
  (auto-generated by `seed-staging-secrets.ps1`).
- `SEED_NEW_TENANTS=true` - hardcoded in
  `deploy/terraform/modules/staging_vm/startup.sh` for staging. Leave
  unset / `false` in production.
- `API_INTERNAL_URL=http://api-server:3001` - compose-internal address
  `auth-server` uses to reach `api-server`.

The call is fire-and-forget; a seed failure never fails signup.

## Step 8 - Verify

```powershell
curl https://api.staging.branlamie.com/api/v1/health
curl https://auth.staging.branlamie.com/.well-known/openid-configuration
Start-Process https://app.staging.branlamie.com/
```

All three subdomains should return 200/301. Caddy auto-issues ACME
certificates on first request; give it ~30s if the first curl 503s.

## Troubleshooting

### `terraform apply` in environments/staging fails with `Permission denied`

You are likely running as ci-deployer but Step 2 hasn't run yet. Apply
from your human identity (`gcloud auth application-default login` as an
org admin).

### `cd-staging` fails at "Resolve MIG instance name"

The MIG exists but the VM was preempted or auto-healed. Let it settle;
the workflow retries idempotently on re-run.

### Migrations container cannot reach CloudSQL

The one-shot migration container runs on the `..._egress` docker network
(not `..._internal`). If you've edited `deploy/compose/staging/compose.yaml`,
confirm both networks still exist and `api-server` is on both `internal`
and `egress`.

### HMAC key already exists

`seed-staging-secrets.ps1 -Force` creates a second HMAC key for the
frontend SA. Delete stale ones with:

```powershell
gcloud storage hmac list --project=claims-manager-staging-493807
gcloud storage hmac delete <ACCESS_ID> --project=claims-manager-staging-493807
```

### Frontend cannot reach the API server

The frontend is a BFF - every `createApiClient` caller in
`apps/frontend/src` is a Server Component or `'use server'` action, so
the fetch to `api-server` happens on the Next.js server, not in the
browser. That means:

- `NEXT_PUBLIC_API_URL` is read from `process.env` at runtime by the
  Next.js server; it does NOT need to be baked in at `docker build`.
  `compose.yaml` already sets it per-environment.
- If the client sees localhost URLs, check the container env (`docker
  compose exec frontend env | grep NEXT_PUBLIC`) rather than the build
  logs.
- Same applies to `AUTH_SERVER_URL` - server-side only.

## Production migration note

Production still deploys via GKE (`deploy/terraform/environments/production/main.tf`
+ `.github/workflows/cd-production.yaml`). When it moves to the same VM
pattern, plan on:

- Adding a `production_vm` module mirroring `staging_vm`.
- Expanding the bootstrap module to grant ci-deployer the same cross-
  project roles in `claims-manager-production`.
- Adjusting `compose.yaml` env so `NEXT_PUBLIC_API_URL` /
  `AUTH_SERVER_URL` point at the production hostnames.
