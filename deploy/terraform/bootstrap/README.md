# bootstrap

One-time terraform modules that stand up the shared primitives the rest
of `deploy/terraform/environments/*` assume already exist. Run these
**locally as a human** before any CI workflow can succeed.

## infra/

Provisions in `claims-manager-infra-493807`:

- APIs: `cloudresourcemanager`, `iam`, `iamcredentials`, `sts`,
  `serviceusage`, `artifactregistry`, `storage`, `logging`, `compute`
- GCS bucket `claims-manager-terraform-state` (versioned) — the backend
  already referenced by `environments/staging` and `environments/production`
- Service account `ci-deployer@claims-manager-infra-493807.iam.gserviceaccount.com`
  (used by every `.github/workflows/*.yaml`)
- Workload Identity Federation pool `github-actions` + provider `github`,
  scoped to the configured `github_owner/github_repo`
- Cross-project IAM grants on `claims-manager-staging-493807` so the same
  `ci-deployer` SA can run `terraform apply` and `gcloud compute ssh
  --tunnel-through-iap` against the staging VM

State is **local** — the bucket it would otherwise live in is the very
resource this module creates. Keep the local `terraform.tfstate` safe
(folder `.gitignore` excludes it from git).

### Run

```powershell
gcloud auth application-default login
cd deploy/terraform/bootstrap/infra
terraform init
terraform apply
```

On success, capture the outputs:

```powershell
terraform output -raw wif_provider
terraform output -raw ci_deployer_email
```

`wif_provider` is the exact value to paste into the GitHub Actions repo
secret `WIF_PROVIDER`.
