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

  default_host_labels = local.is_prod ? {
    api       = "api"
    auth      = "auth"
    app       = "app"
    providers = "providers"
    } : {
    api       = "api-${var.environment}"
    auth      = "auth-${var.environment}"
    app       = "app-${var.environment}"
    providers = "providers-${var.environment}"
  }

  # When host_records is provided, use it; otherwise create A records to gateway_ip
  # for the default host labels (VM / single-IP edge mode).
  host_records = var.host_records != null ? var.host_records : {
    for k, label in local.default_host_labels : k => {
      type    = "A"
      rrdatas = [var.gateway_ip]
      name    = label
    } if var.create_subdomain_records && var.gateway_ip != null
  }
}

resource "google_dns_managed_zone" "this" {
  project     = var.project_id
  name        = "claims-manager-${var.environment}"
  dns_name    = var.dns_name
  description = "Claims Manager ${var.environment} public hosts"
}

resource "google_dns_record_set" "hosts" {
  for_each = local.host_records

  project      = var.project_id
  managed_zone = google_dns_managed_zone.this.name
  name         = "${each.value.name}.${google_dns_managed_zone.this.dns_name}"
  type         = each.value.type
  ttl          = 300
  rrdatas      = each.value.rrdatas
}
