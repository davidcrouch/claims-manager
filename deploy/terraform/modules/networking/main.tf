terraform {
  required_version = ">= 1.3.0"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = ">= 5.0.0"
    }
  }
}

resource "google_project_service" "networking_apis" {
  for_each = toset([
    "compute.googleapis.com",
    "servicenetworking.googleapis.com",
  ])

  project            = var.project_id
  service            = each.key
  disable_on_destroy = false
}

locals {
  pod_range_name     = "claims-manager-pods-${var.environment}"
  service_range_name = "claims-manager-services-${var.environment}"
}

resource "google_compute_network" "vpc" {
  name                    = "claims-manager-vpc"
  auto_create_subnetworks = false
  project                 = var.project_id

  depends_on = [google_project_service.networking_apis]
}

resource "google_compute_subnetwork" "gke" {
  name                     = "claims-manager-gke-${var.environment}"
  project                  = var.project_id
  region                   = var.region
  network                  = google_compute_network.vpc.id
  ip_cidr_range            = "10.0.0.0/20"
  private_ip_google_access = true

  secondary_ip_range {
    range_name    = local.pod_range_name
    ip_cidr_range = "10.16.0.0/16"
  }

  secondary_ip_range {
    range_name    = local.service_range_name
    ip_cidr_range = "10.1.0.0/22"
  }
}

resource "google_compute_global_address" "private_services" {
  name          = "claims-manager-psa-${var.environment}"
  project       = var.project_id
  purpose       = "VPC_PEERING"
  address_type  = "INTERNAL"
  prefix_length = 16
  network       = google_compute_network.vpc.id
}

resource "google_service_networking_connection" "private_services" {
  network                 = google_compute_network.vpc.id
  service                 = "servicenetworking.googleapis.com"
  reserved_peering_ranges = [google_compute_global_address.private_services.name]

  depends_on = [google_project_service.networking_apis]
}

resource "google_compute_router" "nat" {
  name    = "claims-manager-nat-router-${var.environment}"
  project = var.project_id
  region  = var.region
  network = google_compute_network.vpc.id
}

resource "google_compute_router_nat" "nat" {
  name                               = "claims-manager-nat-${var.environment}"
  project                            = var.project_id
  region                             = var.region
  router                             = google_compute_router.nat.name
  nat_ip_allocate_option             = "AUTO_ONLY"
  source_subnetwork_ip_ranges_to_nat = "ALL_SUBNETWORKS_ALL_IP_RANGES"

  log_config {
    enable = true
    filter = "ERRORS_ONLY"
  }
}

resource "google_compute_firewall" "allow_internal" {
  name      = "claims-manager-allow-internal-${var.environment}"
  project   = var.project_id
  network   = google_compute_network.vpc.name
  priority  = 1000
  direction = "INGRESS"

  allow {
    protocol = "tcp"
    ports    = ["0-65535"]
  }

  allow {
    protocol = "udp"
    ports    = ["0-65535"]
  }

  allow {
    protocol = "icmp"
  }

  source_ranges = [
    "10.0.0.0/8",
    "172.16.0.0/12",
    "192.168.0.0/16",
  ]
}

resource "google_compute_firewall" "deny_default_ingress" {
  name      = "claims-manager-deny-default-ingress-${var.environment}"
  project   = var.project_id
  network   = google_compute_network.vpc.name
  priority  = 65534
  direction = "INGRESS"

  deny {
    protocol = "all"
  }

  source_ranges = ["0.0.0.0/0"]
}
