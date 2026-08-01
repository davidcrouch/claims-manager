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
  # Hyphenated env hosts: api-staging.branlamie.com / api-dev.branlamie.com
  # Prod (production|prod): api.branlamie.com (no suffix)
  is_prod = contains(["production", "prod"], var.environment)

  host_labels = local.is_prod ? {
    api  = "api"
    auth = "auth"
    app  = "app"
    } : {
    api  = "api-${var.environment}"
    auth = "auth-${var.environment}"
    app  = "app-${var.environment}"
  }
}

resource "google_dns_managed_zone" "this" {
  project     = var.project_id
  name        = "claims-manager-${var.environment}"
  dns_name    = var.dns_name
  description = "Claims Manager ${var.environment} public hosts"
}

resource "google_dns_record_set" "hosts" {
  for_each = var.create_subdomain_records ? local.host_labels : {}

  project      = var.project_id
  managed_zone = google_dns_managed_zone.this.name
  name         = "${each.value}.${google_dns_managed_zone.this.dns_name}"
  type         = "A"
  ttl          = 300
  rrdatas      = [var.gateway_ip]
}
