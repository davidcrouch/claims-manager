terraform {
  required_version = ">= 1.3.0"

  # No remote backend: this module bootstraps the state bucket itself.
  # Keep the local terraform.tfstate safe (see .gitignore in this folder) -
  # it is the only key that holds WIF + ci-deployer identity until the
  # bucket exists and we migrate to a remote backend.

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = ">= 5.0.0"
    }
  }
}

provider "google" {
  project = var.infra_project_id
  region  = var.region
}

# Alias provider pinned at the staging project so cross-project IAM
# bindings (granting ci-deployer@infra the roles it needs in staging)
# live in one terraform apply.
provider "google" {
  alias   = "staging"
  project = var.staging_project_id
  region  = var.region
}

data "google_project" "infra" {
  project_id = var.infra_project_id
}

# ── API enablement (infra) ─────────────────────────────────────────
locals {
  # NOTE: APIs billed to the ci-deployer's quota project (this one, since
  # the SA lives here) must be enabled here even when the resource itself
  # lives in the staging project — otherwise terraform refresh for any
  # staging resource using those APIs fails with "API has not been used
  # in project <infra-number> before". sqladmin + redis + servicenetworking
  # are the ones that bit us during staging apply.
  infra_apis = toset([
    "cloudresourcemanager.googleapis.com",
    "iam.googleapis.com",
    "iamcredentials.googleapis.com",
    "sts.googleapis.com",
    "serviceusage.googleapis.com",
    "artifactregistry.googleapis.com",
    "storage.googleapis.com",
    "logging.googleapis.com",
    "compute.googleapis.com",
    "sqladmin.googleapis.com",
    "redis.googleapis.com",
    "servicenetworking.googleapis.com",
    "secretmanager.googleapis.com",
    "dns.googleapis.com",
  ])

  # APIs terraform and the CD pipeline will touch in the staging project.
  # compute/iap/secretmanager/sql/redis/servicenetworking/dns are required
  # by the staging environment module; enabling them here means the first
  # `terraform apply` in environments/staging does not race API bring-up.
  staging_apis = toset([
    "cloudresourcemanager.googleapis.com",
    "iam.googleapis.com",
    "iamcredentials.googleapis.com",
    "serviceusage.googleapis.com",
    "compute.googleapis.com",
    "iap.googleapis.com",
    "secretmanager.googleapis.com",
    "sqladmin.googleapis.com",
    "redis.googleapis.com",
    "servicenetworking.googleapis.com",
    "dns.googleapis.com",
    "logging.googleapis.com",
    "monitoring.googleapis.com",
    "artifactregistry.googleapis.com",
    "storage.googleapis.com",
    "oslogin.googleapis.com",
  ])
}

resource "google_project_service" "infra" {
  for_each = local.infra_apis

  project            = var.infra_project_id
  service            = each.key
  disable_on_destroy = false
}

resource "google_project_service" "staging" {
  provider = google.staging
  for_each = local.staging_apis

  project            = var.staging_project_id
  service            = each.key
  disable_on_destroy = false
}

# ── Terraform state bucket (infra) ─────────────────────────────────
# environments/staging and environments/production both use
# backend "gcs" { bucket = "claims-manager-terraform-state" }.
resource "google_storage_bucket" "tfstate" {
  project                     = var.infra_project_id
  name                        = var.state_bucket_name
  location                    = var.region
  uniform_bucket_level_access = true
  force_destroy               = false

  versioning {
    enabled = true
  }

  lifecycle_rule {
    condition {
      num_newer_versions = 10
    }
    action {
      type = "Delete"
    }
  }

  depends_on = [google_project_service.infra]
}

# ── ci-deployer service account (lives in infra) ───────────────────
# All GitHub Actions workflows impersonate this SA via WIF.
resource "google_service_account" "ci_deployer" {
  account_id   = "ci-deployer"
  display_name = "ci-deployer (GitHub Actions)"
  project      = var.infra_project_id

  depends_on = [google_project_service.infra]
}

# Roles in the infra project:
#   artifactregistry.admin   - push images AND read/write repo IAM policy.
#                              (writer alone cannot call repositories.getIamPolicy,
#                              which terraform refresh needs to reconcile the
#                              google_artifact_registry_repository_iam_member
#                              resources that grant staging-vm-sa + compute SA
#                              reader access on the claims-manager repo.)
#   storage.admin            - read/write terraform state bucket
#   logging.logWriter        - write logs from CI
#   iam.serviceAccountTokenCreator on self - WIF impersonation requires this
locals {
  ci_deployer_infra_roles = toset([
    "roles/artifactregistry.admin",
    "roles/storage.admin",
    "roles/logging.logWriter",
  ])
}

resource "google_project_iam_member" "ci_deployer_infra" {
  for_each = local.ci_deployer_infra_roles

  project = var.infra_project_id
  role    = each.key
  member  = google_service_account.ci_deployer.member
}

resource "google_service_account_iam_member" "ci_deployer_self_token_creator" {
  service_account_id = google_service_account.ci_deployer.name
  role               = "roles/iam.serviceAccountTokenCreator"
  member             = google_service_account.ci_deployer.member
}

# Roles in the staging project.
#   editor                              - baseline to run terraform apply
#   resourcemanager.projectIamAdmin     - create/modify IAM bindings
#   iam.serviceAccountAdmin             - create/modify service accounts
#   iap.tunnelResourceAccessor          - `gcloud compute ssh --tunnel-through-iap`
#   compute.osAdminLogin                - mint SSH keys as OS Login admin
#   secretmanager.admin                 - seed-staging-secrets.ps1 writes versions
#
# roles/editor is intentionally broad here because this single SA stands up
# the entire stack. If you ever split CI and CD into separate SAs, tighten this.
locals {
  ci_deployer_staging_roles = toset([
    "roles/editor",
    "roles/resourcemanager.projectIamAdmin",
    "roles/iam.serviceAccountAdmin",
    "roles/iap.tunnelResourceAccessor",
    "roles/compute.osAdminLogin",
    "roles/secretmanager.admin",
  ])
}

resource "google_project_iam_member" "ci_deployer_staging" {
  provider = google.staging
  for_each = local.ci_deployer_staging_roles

  project = var.staging_project_id
  role    = each.key
  member  = google_service_account.ci_deployer.member

  depends_on = [google_project_service.staging]
}

# ── Workload Identity Federation for GitHub Actions ────────────────
resource "google_iam_workload_identity_pool" "github" {
  project                   = var.infra_project_id
  workload_identity_pool_id = "github-actions"
  display_name              = "GitHub Actions"
  description               = "Used by GitHub Actions workflows in ${var.github_owner}/${var.github_repo}"

  depends_on = [google_project_service.infra]
}

resource "google_iam_workload_identity_pool_provider" "github" {
  project                            = var.infra_project_id
  workload_identity_pool_id          = google_iam_workload_identity_pool.github.workload_identity_pool_id
  workload_identity_pool_provider_id = "github"
  display_name                       = "GitHub OIDC"

  # Restrict provider to tokens issued for the configured org/repo so a
  # leaked token from another repo cannot impersonate ci-deployer.
  attribute_condition = "assertion.repository_owner == \"${var.github_owner}\""

  attribute_mapping = {
    "google.subject"             = "assertion.sub"
    "attribute.repository"       = "assertion.repository"
    "attribute.repository_owner" = "assertion.repository_owner"
    "attribute.ref"              = "assertion.ref"
  }

  oidc {
    issuer_uri = "https://token.actions.githubusercontent.com"
  }
}

# Allow any workflow run inside this specific repo to impersonate ci-deployer.
resource "google_service_account_iam_member" "ci_deployer_wif" {
  service_account_id = google_service_account.ci_deployer.name
  role               = "roles/iam.workloadIdentityUser"
  member             = "principalSet://iam.googleapis.com/${google_iam_workload_identity_pool.github.name}/attribute.repository/${var.github_owner}/${var.github_repo}"
}
