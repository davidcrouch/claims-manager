# Deploy scripts

| Script | Purpose |
|--------|---------|
| [`seed-secrets.ps1`](seed-secrets.ps1) | Populate Secret Manager for any environment (`-Environment staging\|production`) |
| [`seed-staging-secrets.ps1`](seed-staging-secrets.ps1) | Deprecated shim → `seed-secrets.ps1 -Environment staging` |
| [`grant-provider-app.sql`](grant-provider-app.sql) | Least-privilege grants for `provider_app` SQL user |
| [`rollback.sh`](rollback.sh) | Roll back a Cloud Run service to a previous image tag |
| [`apply-terraform.sh`](apply-terraform.sh) | Manual terraform plan/apply for any environment |
| [`generate-jwks.mjs`](generate-jwks.mjs) | Generate RSA + EC keypair for auth-server JWKS |

Cloud Run deploy is via GitHub Actions (`.github/workflows/cd-staging.yaml` / `cd-production.yaml`). See [`../CLOUD_RUN.md`](../CLOUD_RUN.md).
