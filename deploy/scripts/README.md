# Deploy scripts

| Script | Purpose |
|--------|---------|
| [`seed-staging-secrets.ps1`](seed-staging-secrets.ps1) | Write Secret Manager values for staging (DB URLs, redis, etc.) |
| [`grant-provider-app.sql`](grant-provider-app.sql) | Least-privilege grants for `provider_app` |

Cloud Run deploy is via GitHub Actions (`.github/workflows/cd-staging.yaml` / `cd-production.yaml`). See [`../CLOUD_RUN.md`](../CLOUD_RUN.md).
