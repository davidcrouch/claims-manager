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
  secret_env = {
    for s in var.secret_env_vars : s.name => s
  }
  # Cloud Run v2 Direct VPC Egress expects "projects/{p}/global/networks/{n}"
  # but VPC self_link is "https://...compute/v1/projects/{p}/global/networks/{n}".
  vpc_network_short = var.vpc_network != null ? regex("projects/.+$", var.vpc_network) : null
  vpc_subnet_short  = var.vpc_subnet != null ? regex("projects/.+$", var.vpc_subnet) : null
}

resource "google_cloud_run_v2_service" "this" {
  project             = var.project_id
  name                = var.name
  location            = var.region
  ingress             = var.ingress
  deletion_protection = false

  # CD owns image tags (main-<sha>). Terraform provisions shape (SA, VPC,
  # secrets, ingress); ignore image drift after the first apply.
  lifecycle {
    ignore_changes = [
      client,
      client_version,
      template[0].containers[0].image,
    ]
  }

  template {
    service_account                  = var.service_account_email
    timeout                          = var.timeout
    max_instance_request_concurrency = var.container_concurrency

    scaling {
      min_instance_count = var.min_instances
      max_instance_count = var.max_instances
    }

    dynamic "vpc_access" {
      for_each = var.vpc_network != null ? [1] : []
      content {
        egress = var.vpc_egress
        network_interfaces {
          network    = local.vpc_network_short
          subnetwork = local.vpc_subnet_short
        }
      }
    }

    containers {
      image = var.image

      ports {
        container_port = var.container_port
      }

      resources {
        limits = {
          cpu    = var.cpu
          memory = var.memory
        }
        cpu_idle          = var.cpu_idle
        startup_cpu_boost = var.startup_cpu_boost
      }

      dynamic "env" {
        for_each = var.env_vars
        content {
          name  = env.key
          value = env.value
        }
      }

      dynamic "env" {
        for_each = local.secret_env
        content {
          name = env.value.name
          value_source {
            secret_key_ref {
              secret  = env.value.secret
              version = env.value.version
            }
          }
        }
      }

      dynamic "startup_probe" {
        for_each = var.enable_probes ? [1] : []
        content {
          http_get {
            path = var.health_path
            port = var.container_port
          }
          initial_delay_seconds = 5
          period_seconds        = 10
          failure_threshold     = 6
          timeout_seconds       = 5
        }
      }

      dynamic "liveness_probe" {
        for_each = var.enable_probes ? [1] : []
        content {
          http_get {
            path = var.health_path
            port = var.container_port
          }
          period_seconds    = 30
          failure_threshold = 3
          timeout_seconds   = 5
        }
      }
    }
  }

  traffic {
    type    = "TRAFFIC_TARGET_ALLOCATION_TYPE_LATEST"
    percent = 100
  }
}

# Public invoker (allUsers) only when explicitly requested.
resource "google_cloud_run_v2_service_iam_member" "public_invoker" {
  count = var.allow_unauthenticated ? 1 : 0

  project  = var.project_id
  location = var.region
  name     = google_cloud_run_v2_service.this.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}

resource "google_cloud_run_v2_service_iam_member" "invokers" {
  for_each = toset(var.invoker_members)

  project  = var.project_id
  location = var.region
  name     = google_cloud_run_v2_service.this.name
  role     = "roles/run.invoker"
  member   = each.value
}
