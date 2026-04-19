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
  instance_base_name = "claims-manager-${var.environment}"
  data_disk_name     = "${local.instance_base_name}-data"
  data_disk_device   = "data"
  network_tags       = ["staging", "http-server", "https-server"]
}

resource "google_project_service" "compute" {
  project            = var.project_id
  service            = "compute.googleapis.com"
  disable_on_destroy = false
}

resource "google_project_service" "iap" {
  project            = var.project_id
  service            = "iap.googleapis.com"
  disable_on_destroy = false
}

# ── Static external IP ───────────────────────────────────────────────
resource "google_compute_address" "staging" {
  name         = "${local.instance_base_name}-ip"
  project      = var.project_id
  region       = var.region
  address_type = "EXTERNAL"

  depends_on = [google_project_service.compute]
}

# ── Data disk (detachable, survives instance template revisions) ────
resource "google_compute_disk" "data" {
  name    = local.data_disk_name
  project = var.project_id
  zone    = var.zone
  type    = "pd-balanced"
  size    = var.data_disk_size_gb

  labels = {
    environment = var.environment
    role        = "data"
  }

  lifecycle {
    prevent_destroy = true
  }
}

# ── Daily snapshot policy attached to the data disk ──────────────────
resource "google_compute_resource_policy" "snapshot_daily" {
  name    = "${local.instance_base_name}-data-snapshots"
  project = var.project_id
  region  = var.region

  snapshot_schedule_policy {
    schedule {
      daily_schedule {
        days_in_cycle = 1
        start_time    = "16:00"
      }
    }

    retention_policy {
      max_retention_days    = var.snapshot_retention_days
      on_source_disk_delete = "KEEP_AUTO_SNAPSHOTS"
    }

    snapshot_properties {
      storage_locations = [var.region]
      labels = {
        environment = var.environment
      }
    }
  }
}

resource "google_compute_disk_resource_policy_attachment" "data" {
  name    = google_compute_resource_policy.snapshot_daily.name
  project = var.project_id
  zone    = var.zone
  disk    = google_compute_disk.data.name
}

# ── Service account for the instance ─────────────────────────────────
resource "google_service_account" "staging_vm" {
  account_id   = "staging-vm-sa"
  display_name = "staging VM (compose host)"
  project      = var.project_id
}

resource "google_project_iam_member" "staging_vm_secret_accessor" {
  project = var.project_id
  role    = "roles/secretmanager.secretAccessor"
  member  = google_service_account.staging_vm.member
}

resource "google_project_iam_member" "staging_vm_artifact_reader" {
  project = var.infra_project_id
  role    = "roles/artifactregistry.reader"
  member  = google_service_account.staging_vm.member
}

resource "google_project_iam_member" "staging_vm_logging" {
  project = var.project_id
  role    = "roles/logging.logWriter"
  member  = google_service_account.staging_vm.member
}

resource "google_project_iam_member" "staging_vm_monitoring" {
  project = var.project_id
  role    = "roles/monitoring.metricWriter"
  member  = google_service_account.staging_vm.member
}

# Storage access for the VM — the frontend app in compose reads GCS via
# HMAC creds injected from Secret Manager, but server-side signed URLs
# for buckets owned by this project are also minted by the VM SA when
# no HMAC is configured.
resource "google_project_iam_member" "staging_vm_storage" {
  project = var.project_id
  role    = "roles/storage.objectAdmin"
  member  = google_service_account.staging_vm.member
}

# ── Firewall: public web (80/443) ────────────────────────────────────
resource "google_compute_firewall" "staging_web" {
  name    = "${local.instance_base_name}-allow-web"
  project = var.project_id
  network = var.vpc_self_link

  allow {
    protocol = "tcp"
    ports    = ["80", "443"]
  }

  source_ranges = ["0.0.0.0/0"]
  target_tags   = ["http-server", "https-server"]
  priority      = 1000
}

# ── Firewall: SSH restricted to IAP (or var.admin_cidr) ──────────────
resource "google_compute_firewall" "staging_ssh" {
  name    = "${local.instance_base_name}-allow-ssh"
  project = var.project_id
  network = var.vpc_self_link

  allow {
    protocol = "tcp"
    ports    = ["22"]
  }

  source_ranges = [var.admin_cidr]
  target_tags   = ["staging"]
  priority      = 1000
}

# ── Firewall: health-check probes reach 443 ──────────────────────────
resource "google_compute_firewall" "staging_health" {
  name    = "${local.instance_base_name}-allow-health"
  project = var.project_id
  network = var.vpc_self_link

  allow {
    protocol = "tcp"
    ports    = ["443"]
  }

  # GCP health-check source ranges, well-known constants.
  source_ranges = ["35.191.0.0/16", "130.211.0.0/22"]
  target_tags   = ["staging"]
  priority      = 1000
}

# ── Instance template ────────────────────────────────────────────────
resource "google_compute_instance_template" "staging" {
  name_prefix  = "${local.instance_base_name}-"
  project      = var.project_id
  region       = var.region
  machine_type = var.machine_type

  tags = local.network_tags

  disk {
    source_image = "cos-cloud/cos-stable"
    auto_delete  = true
    boot         = true
    disk_type    = "pd-balanced"
    disk_size_gb = var.boot_disk_size_gb
  }

  disk {
    source      = google_compute_disk.data.name
    auto_delete = false
    boot        = false
    device_name = local.data_disk_device
    mode        = "READ_WRITE"
  }

  network_interface {
    subnetwork = var.subnet_self_link

    access_config {
      nat_ip = google_compute_address.staging.address
    }
  }

  service_account {
    email  = google_service_account.staging_vm.email
    scopes = ["https://www.googleapis.com/auth/cloud-platform"]
  }

  metadata = {
    google-logging-enabled    = "true"
    google-monitoring-enabled = "true"
    enable-oslogin            = "TRUE"
    startup-script            = file("${path.module}/startup.sh")
    data-disk-device          = local.data_disk_device
    secrets-project-id        = var.project_id
    artifact-registry-host    = "${var.region}-docker.pkg.dev"
    staging-domain            = var.domain
    caddy-admin-email         = var.caddy_admin_email
  }

  lifecycle {
    create_before_destroy = true
  }
}

# ── Regional health-check (TCP 443) ──────────────────────────────────
resource "google_compute_health_check" "staging_tcp443" {
  name                = "${local.instance_base_name}-tcp443"
  project             = var.project_id
  check_interval_sec  = 30
  timeout_sec         = 10
  healthy_threshold   = 1
  unhealthy_threshold = 3

  tcp_health_check {
    port = 443
  }
}

# ── Managed Instance Group (target size = 1) ─────────────────────────
resource "google_compute_instance_group_manager" "staging" {
  name               = "${local.instance_base_name}-mig"
  project            = var.project_id
  zone               = var.zone
  base_instance_name = local.instance_base_name
  target_size        = 1

  version {
    instance_template = google_compute_instance_template.staging.self_link
  }

  named_port {
    name = "https"
    port = 443
  }

  auto_healing_policies {
    health_check = google_compute_health_check.staging_tcp443.self_link
    # Generous delay: COS pull + compose up can take a few minutes on first boot.
    initial_delay_sec = 600
  }

  update_policy {
    type                  = "PROACTIVE"
    minimal_action        = "REPLACE"
    max_surge_fixed       = 0
    max_unavailable_fixed = 1
    replacement_method    = "RECREATE"
  }
}
