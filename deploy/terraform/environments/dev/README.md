# Dev GCP project (hybrid skeleton)

Hybrid local-dev model: cloud holds **Pub/Sub + secrets + publisher SA** only.
Postgres/Redis/API/frontend run on the laptop. No app GCS buckets.

State: `gs://claims-manager-terraform-state/dev` (shared infra bucket).

## What Terraform creates

| Resource | Module |
|---|---|
| Required APIs (`pubsub`, `secretmanager`, `iam`, …) | inline |
| Domain Pub/Sub topics + DLQ topics/pull | `modules/pubsub-claims` |
| Secret Manager secret shells | `modules/secrets` |
| Publisher SA `sa-pubsub-publisher-dev` | inline |

## Apply (manual — CI validates only)

```bash
gcloud auth login                          # as admin@branlamie.com
gcloud config set account admin@branlamie.com
gcloud config set project <claims-manager-dev-*>
export GOOGLE_OAUTH_ACCESS_TOKEN="$(gcloud auth print-access-token)"

./deploy/scripts/apply-terraform.sh dev plan
./deploy/scripts/apply-terraform.sh dev apply
```

Local API `.env`:

```bash
GCP_PROJECT_ID=<claims-manager-dev-*>
PUBSUB_ENABLED=true
APP_ENV=dev
# GCS_DOCUMENTS_BUCKET left empty for local/MinIO document storage
```
