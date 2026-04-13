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
  subdomains = ["api", "auth", "app"]
}

resource "google_dns_managed_zone" "this" {
  project  = var.project_id
  name     = "claims-manager-${var.environment}"
  dns_name = var.dns_name
}

resource "google_dns_record_set" "subdomains" {
  for_each = var.gateway_ip == "" ? toset([]) : toset(local.subdomains)

  project      = var.project_id
  managed_zone = google_dns_managed_zone.this.name
  name         = "${each.value}.${google_dns_managed_zone.this.dns_name}"
  type         = "A"
  ttl          = 300
  rrdatas      = [var.gateway_ip]
}
