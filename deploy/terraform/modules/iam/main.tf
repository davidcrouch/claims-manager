locals {
  services = {
    "api-server" = {
      namespace      = "platform"
      ksa_name       = "api-server"
      gsa_account_id = "api-server-sa"
      roles = [
        "roles/cloudsql.client",
        "roles/secretmanager.secretAccessor",
      ]
    }
    "auth-server" = {
      namespace      = "platform"
      ksa_name       = "auth-server"
      gsa_account_id = "auth-server-sa"
      roles = [
        "roles/cloudsql.client",
        "roles/secretmanager.secretAccessor",
      ]
    }
    frontend = {
      namespace      = "frontend"
      ksa_name       = "frontend"
      gsa_account_id = "frontend-sa"
      roles = [
        "roles/secretmanager.secretAccessor",
        "roles/storage.objectAdmin",
      ]
    }
  }

  project_iam_bindings = merge([
    for service, config in local.services : {
      for role in config.roles :
      "${service}__${replace(role, "/", "_")}" => {
        service = service
        role    = role
      }
    }
  ]...)

  ci_deployer_roles = toset(concat([
    "roles/container.admin",
    "roles/artifactregistry.writer",
  ], var.extra_ci_deployer_roles))
}

resource "google_service_account" "workload" {
  for_each = local.services

  account_id   = each.value.gsa_account_id
  display_name = each.key
  project      = var.project_id
}

resource "google_project_iam_member" "workload" {
  for_each = local.project_iam_bindings

  project = var.project_id
  role    = each.value.role
  member  = google_service_account.workload[each.value.service].member
}

resource "google_service_account_iam_member" "workload_identity" {
  for_each = var.enable_gke_workload_identity ? local.services : {}

  service_account_id = google_service_account.workload[each.key].name
  role               = "roles/iam.workloadIdentityUser"
  member             = "serviceAccount:${var.project_id}.svc.id.goog[${each.value.namespace}/${each.value.ksa_name}]"
}

resource "google_service_account" "ci_deployer" {
  account_id   = "ci-deployer"
  display_name = "ci-deployer"
  project      = var.project_id
}

resource "google_project_iam_member" "ci_deployer" {
  for_each = local.ci_deployer_roles

  project = var.project_id
  role    = each.value
  member  = google_service_account.ci_deployer.member
}

resource "google_service_account" "external_secrets" {
  account_id   = "external-secrets-sa"
  display_name = "external-secrets"
  project      = var.project_id
}

resource "google_project_iam_member" "external_secrets" {
  project = var.project_id
  role    = "roles/secretmanager.secretAccessor"
  member  = google_service_account.external_secrets.member
}

resource "google_service_account_iam_member" "external_secrets_wi" {
  count = var.enable_gke_workload_identity ? 1 : 0

  service_account_id = google_service_account.external_secrets.name
  role               = "roles/iam.workloadIdentityUser"
  member             = "serviceAccount:${var.project_id}.svc.id.goog[external-secrets/external-secrets]"
}
