terraform {
  required_version = ">= 1.3.0"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = ">= 5.0.0"
    }
  }
}

locals {
  name_prefix = coalesce(var.name_prefix, "claims-manager-${var.environment}")

  buckets = {
    "workers-comp"     = { public = true }
    "chat-attachments" = { public = true }
    "shared"           = { public = false }
    "pdf-test-gen"     = { public = true }
  }

  public_bucket_keys = var.allow_public_bucket_iam ? {
    for k, v in local.buckets : k => v if v.public
  } : {}
}

resource "google_storage_bucket" "buckets" {
  for_each = local.buckets

  project                     = var.project_id
  name                        = "${local.name_prefix}-${each.key}"
  location                    = var.region
  uniform_bucket_level_access = true
  force_destroy               = false
}

resource "google_storage_bucket_iam_member" "public_object_viewer" {
  for_each = local.public_bucket_keys

  bucket = google_storage_bucket.buckets[each.key].name
  role   = "roles/storage.objectViewer"
  member = "allUsers"
}

# ── Documents bucket (filesystem module) ────────────────────────────
# Separate from the generic loop because it needs CORS and lifecycle rules
# for direct-to-GCS resumable uploads from the browser.

resource "google_storage_bucket" "documents" {
  count = var.create_documents_bucket ? 1 : 0

  project                     = var.project_id
  name                        = "${local.name_prefix}-documents"
  location                    = var.region
  uniform_bucket_level_access = true
  force_destroy               = false

  cors {
    origin          = var.documents_cors_origins
    method          = ["GET", "PUT", "HEAD", "OPTIONS"]
    response_header = ["Content-Type", "Content-Length", "Content-Range", "x-goog-resumable"]
    max_age_seconds = 3600
  }

  lifecycle_rule {
    condition {
      age = 1
    }
    action {
      type = "AbortIncompleteMultipartUpload"
    }
  }
}

resource "google_storage_hmac_key" "this" {
  count = var.create_hmac_key ? 1 : 0

  project               = var.project_id
  service_account_email = var.hmac_service_account_email
}
