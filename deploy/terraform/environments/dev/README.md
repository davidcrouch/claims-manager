# Dev GCP project (hybrid)

Cloud holds supporting infra; **API / auth / frontend / Postgres / Redis run on the laptop**.
No Cloud Run, GKE, or staging VM.

State: `gs://claims-manager-terraform-state/dev` (shared infra bucket).

## What Terraform creates

| Resource | Module |
|---|---|
| Required APIs (`pubsub`, `secretmanager`, `storage`, `iam`, `aiplatform`, …) | inline |
| Domain Pub/Sub topics + DLQ topics/pull | `modules/pubsub-claims` |
| Secret Manager secret shells | `modules/secrets` |
| GCS app buckets (documents + legacy) | `modules/gcs` |
| Publisher SA `sa-pubsub-publisher-dev` | inline |

## Apply (manual — CI validates only)

```bash
gcloud auth login                          # as admin@branlamie.com
gcloud config set account admin@branlamie.com
gcloud config set project claims-manager-dev-571403
export GOOGLE_OAUTH_ACCESS_TOKEN="$(gcloud auth print-access-token)"

./deploy/scripts/apply-terraform.sh dev plan
./deploy/scripts/apply-terraform.sh dev apply
```

## Local API `.env`

```bash
GCP_PROJECT_ID=claims-manager-dev-571403
PUBSUB_ENABLED=true
APP_ENV=dev
GCS_DOCUMENTS_BUCKET=claims-manager-dev-571403-documents
GCS_UPLOAD_CORS_ORIGIN=http://localhost:5002
```

Bucket names use the project ID as prefix (`claims-manager-dev-571403-*`) because the shorter `claims-manager-dev-*` names are still reserved globally from a deleted project.

Use Application Default Credentials after `gcloud auth application-default login` as a project owner (or impersonate `sa-pubsub-publisher-dev@…`).
