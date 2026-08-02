output "lb_ip" {
  value       = google_compute_global_address.this.address
  description = "Global anycast IP for the HTTPS load balancer"
}

output "ssl_certificate_id" {
  value = google_compute_managed_ssl_certificate.this.id
}
