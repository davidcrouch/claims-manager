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
  # Stable key order so adding a service does not rename sibling path_matchers.
  services_sorted = { for k in sort(keys(var.services)) : k => var.services[k] }
  # Managed cert domains are immutable — new domain set ⇒ new cert name.
  cert_domains_fingerprint = substr(sha1(join(",", sort(var.domains))), 0, 8)
}

resource "google_compute_global_address" "this" {
  project = var.project_id
  name    = "lb-${var.environment}"
}

resource "google_compute_managed_ssl_certificate" "this" {
  project = var.project_id
  name    = "lb-cert-${var.environment}-${local.cert_domains_fingerprint}"

  managed {
    domains = var.domains
  }

  lifecycle {
    create_before_destroy = true
  }
}

resource "google_compute_region_network_endpoint_group" "negs" {
  for_each = local.services_sorted

  project               = var.project_id
  name                  = "neg-${each.key}-${var.environment}"
  region                = var.region
  network_endpoint_type = "SERVERLESS"

  cloud_run {
    service = each.value.cloud_run_service_name
  }
}

resource "google_compute_backend_service" "backends" {
  for_each = local.services_sorted

  project     = var.project_id
  name        = "backend-${each.key}-${var.environment}"
  protocol    = "HTTPS"
  timeout_sec = 30

  backend {
    group = google_compute_region_network_endpoint_group.negs[each.key].id
  }

  log_config {
    enable      = true
    sample_rate = 1.0
  }
}

resource "google_compute_url_map" "this" {
  project         = var.project_id
  name            = "lb-urlmap-${var.environment}"
  default_service = google_compute_backend_service.backends[var.default_service].id

  dynamic "host_rule" {
    for_each = local.services_sorted
    content {
      hosts        = host_rule.value.hostnames
      path_matcher = host_rule.key
    }
  }

  dynamic "path_matcher" {
    for_each = local.services_sorted
    content {
      name            = path_matcher.key
      default_service = google_compute_backend_service.backends[path_matcher.key].id
    }
  }
}

resource "google_compute_target_https_proxy" "this" {
  project          = var.project_id
  name             = "lb-https-proxy-${var.environment}"
  url_map          = google_compute_url_map.this.id
  ssl_certificates = [google_compute_managed_ssl_certificate.this.id]

  depends_on = [google_compute_managed_ssl_certificate.this]
}

resource "google_compute_global_forwarding_rule" "this" {
  project    = var.project_id
  name       = "lb-fwd-${var.environment}"
  target     = google_compute_target_https_proxy.this.id
  port_range = "443"
  ip_address = google_compute_global_address.this.address
}

resource "google_compute_url_map" "http_redirect" {
  project = var.project_id
  name    = "lb-http-redirect-${var.environment}"

  default_url_redirect {
    https_redirect         = true
    redirect_response_code = "MOVED_PERMANENTLY_DEFAULT"
    strip_query            = false
  }
}

resource "google_compute_target_http_proxy" "redirect" {
  project = var.project_id
  name    = "lb-http-proxy-${var.environment}"
  url_map = google_compute_url_map.http_redirect.id
}

resource "google_compute_global_forwarding_rule" "http_redirect" {
  project    = var.project_id
  name       = "lb-fwd-http-${var.environment}"
  target     = google_compute_target_http_proxy.redirect.id
  port_range = "80"
  ip_address = google_compute_global_address.this.address
}
