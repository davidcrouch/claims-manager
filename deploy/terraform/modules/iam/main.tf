locals {
  services = {
    "api-server" = {
      gsa_account_id = "api-server-sa"
      roles = [
        "roles/cloudsql.client",
        "roles/secretmanager.secretAccessor",
        "roles/aiplatform.user",
        # Documents bucket uploads (provisioning templates + filesystem)
        "roles/storage.objectAdmin",
      ]
    }
    "auth-server" = {
      gsa_account_id = "auth-server-sa"
      roles = [
        "roles/cloudsql.client",
        "roles/secretmanager.secretAccessor",
      ]
    }
    frontend = {
      gsa_account_id = "frontend-sa"
      roles = [
        "roles/secretmanager.secretAccessor",
        "roles/storage.objectAdmin",
      ]
    }
    "provider-server" = {
      gsa_account_id = "provider-server-sa"
      roles = [
        "roles/cloudsql.client",
        "roles/secretmanager.secretAccessor",
      ]
    }
    "claims-mcp" = {
      gsa_account_id = "claims-mcp-sa"
      roles = [
        "roles/secretmanager.secretAccessor",
      ]
    }
    "ms-graph-mcp" = {
      gsa_account_id = "ms-graph-mcp-sa"
      roles = [
        "roles/secretmanager.secretAccessor",
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
    "roles/artifactregistry.writer",
    "roles/run.admin",
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

