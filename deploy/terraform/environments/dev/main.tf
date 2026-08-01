# ── Dev environment (hybrid) ─────────────────────────────────────────────────
# Cloud holds supporting infra; app processes run on localhost (no Cloud Run / VM).
#
#   Deployed in GCP:
#     - Project APIs
#     - Pub/Sub domain topics + DLQ (no push — localhost can't receive GCP push)
#     - Secret Manager secret shells
#     - GCS app buckets (documents + legacy buckets)
#     - Publisher SA for local ADC / Application Default Credentials
#
#   NOT deployed here (run locally via docker compose / pnpm):
#     - API / frontend / auth-server
#     - Postgres, Redis, NATS
#     - Cloud SQL, Memorystore, GKE, staging VM, Cloud Run
#
# State lives in the shared infra bucket (same as staging).
# Apply manually (CI validates only — does not auto-apply DEV):
#   ./deploy/scripts/apply-terraform.sh dev apply

terraform {
  required_version = ">= 1.3.0"

  backend "gcs" {
    bucket = "claims-manager-terraform-state"
    prefix = "dev"
  }

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = ">= 5.0.0"
    }
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
}

data "google_project" "this" {
  project_id = var.project_id
}

locals {
  env = var.environment
  labels = {
    product = "claims-manager"
    env     = local.env
  }
}

# ── Required APIs ────────────────────────────────────────────────────────────

resource "google_project_service" "required" {
  for_each = toset([
    "pubsub.googleapis.com",
    "secretmanager.googleapis.com",
    "iam.googleapis.com",
    "iamcredentials.googleapis.com",
    "serviceusage.googleapis.com",
    "storage.googleapis.com",
    "storage-api.googleapis.com",
  ])

  project            = var.project_id
  service            = each.value
  disable_on_destroy = false
}

# ── Pub/Sub domain topics (+ DLQ). No push endpoint for hybrid local. ────────

module "pubsub" {
  source = "../../modules/pubsub-claims"

  project_id     = var.project_id
  project_number = data.google_project.this.number
  env            = local.env
  labels         = local.labels

  depends_on = [google_project_service.required]
}

# ── Secret Manager shells (values set out-of-band / via gcloud) ───────────────

module "secrets" {
  source = "../../modules/secrets"

  project_id  = var.project_id
  environment = var.environment

  depends_on = [google_project_service.required]
}

# ── Local publisher SA (developers / ADC use this to publish to topics) ──────

resource "google_service_account" "pubsub_publisher" {
  project      = var.project_id
  account_id   = "sa-pubsub-publisher-${local.env}"
  display_name = "Claims Manager Pub/Sub publisher (${local.env})"
  description  = "Used by local API (ADC / impersonation) to publish domain events"

  depends_on = [google_project_service.required]
}

resource "google_project_iam_member" "pubsub_publisher" {
  project = var.project_id
  role    = "roles/pubsub.publisher"
  member  = "serviceAccount:${google_service_account.pubsub_publisher.email}"
}

resource "google_project_iam_member" "pubsub_viewer" {
  project = var.project_id
  role    = "roles/pubsub.viewer"
  member  = "serviceAccount:${google_service_account.pubsub_publisher.email}"
}

resource "google_project_iam_member" "secret_accessor" {
  project = var.project_id
  role    = "roles/secretmanager.secretAccessor"
  member  = "serviceAccount:${google_service_account.pubsub_publisher.email}"
}

# ── GCS (documents + legacy buckets). App reads/writes via local ADC. ────────

module "gcs" {
  source = "../../modules/gcs"

  project_id  = var.project_id
  region      = var.region
  environment = var.environment
  # Globally unique: plain "claims-manager-dev-*" names are held by a deleted project.
  name_prefix                = var.project_id
  hmac_service_account_email = google_service_account.pubsub_publisher.email
  # Org policy blocks SA key / HMAC creation (same as staging).
  create_hmac_key         = false
  create_documents_bucket = true
  documents_cors_origins = [
    "http://localhost:5002",
    "https://app-dev.branlamie.com",
  ]

  depends_on = [google_project_service.required]
}

resource "google_storage_bucket_iam_member" "documents_publisher_admin" {
  bucket = module.gcs.documents_bucket_name
  role   = "roles/storage.objectAdmin"
  member = "serviceAccount:${google_service_account.pubsub_publisher.email}"
}

resource "google_project_iam_member" "publisher_storage_admin" {
  project = var.project_id
  role    = "roles/storage.objectAdmin"
  member  = "serviceAccount:${google_service_account.pubsub_publisher.email}"
}
