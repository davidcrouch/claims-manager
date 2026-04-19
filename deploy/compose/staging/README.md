# deploy/compose/staging

Compose tree shipped to the staging VM (`claims-manager-staging` MIG) by the `cd-staging` workflow.

## Files

- `compose.yaml` — base service definitions (api-server, auth-server, frontend, caddy). Images come from `australia-southeast1-docker.pkg.dev/claims-manager-infra-493807/claims-manager/<service>:${IMAGE_TAG}`. Postgres and Redis are managed (CloudSQL + Memorystore) and reached over VPC peering; no infra containers run on the VM.
- `compose.override.yaml` — CPU/memory caps so the app stack fits inside `e2-standard-2` (2 vCPU / 8 GiB).
- `caddy/Caddyfile` — host-based routing + automatic TLS for `api.`/`auth.`/`app.staging.branlamie.com`.
- `env.sample` — schema of every env var consumed by the stack. Real values are rendered by `modules/staging_vm/startup.sh` into `/var/lib/claims-manager/staging.env` from Secret Manager on every boot.

## Usage on the VM

```bash
cd /mnt/disks/data/compose
docker compose -f compose.yaml -f compose.override.yaml \
  --env-file /var/lib/claims-manager/staging.env pull
docker compose -f compose.yaml -f compose.override.yaml \
  --env-file /var/lib/claims-manager/staging.env up -d
```

CI performs the above via `gcloud compute ssh --tunnel-through-iap` — see `.github/workflows/cd-staging.yaml`.

## Domain contract

| Subdomain                        | Service       | Port |
|----------------------------------|---------------|------|
| `api.staging.branlamie.com`      | api-server    | 3001 |
| `auth.staging.branlamie.com`     | auth-server   | 4000 |
| `app.staging.branlamie.com`      | frontend      | 3000 |

All three A records point at `module.staging_vm.public_ip` (managed by Terraform `module.dns`).
