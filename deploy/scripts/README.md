# deploy/scripts

Bootstrapping helpers used by the staging runbook (see
`deploy/STAGING-BOOTSTRAP.md`).

## `seed-staging-secrets.ps1`

Populates Secret Manager in `claims-manager-staging-493807` with every secret
`deploy/compose/staging/compose.yaml` and the VM's `startup.sh` read.

Run after `terraform apply` in `deploy/terraform/environments/staging`
(which creates the *empty* Secret Manager entries via `module.secrets`).

```powershell
pwsh deploy/scripts/seed-staging-secrets.ps1             # populate missing
pwsh deploy/scripts/seed-staging-secrets.ps1 -DryRun     # plan only
pwsh deploy/scripts/seed-staging-secrets.ps1 -Force      # rotate every secret
```

Values break down as:

| Bucket      | Source                          | Examples                           |
| ----------- | ------------------------------- | ---------------------------------- |
| Derived     | terraform output                | `database-url-*`, `redis-url`      |
| Random      | RNG / JWK generator             | `auth-jwt-secret`, `auth-jwks-*`   |
| GCS HMAC    | `gcloud storage hmac create`    | `gcs-hmac-access-key/secret-key`   |
| Placeholder | `REPLACE_ME` - needs human      | `auth-google-client-*`, `stripe-*` |

The summary at the end lists every placeholder you still need to
overwrite before staging can serve real traffic.

## `generate-jwks.mjs`

Helper called by the PowerShell seeder to produce the RSA-2048 and
EC P-256 JWK components the auth-server's `getJwksConfig()` expects.
Keep in sync with `apps/auth-server/src/config/env-validation.ts`.
