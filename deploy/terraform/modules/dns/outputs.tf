output "zone_name" {
  value = google_dns_managed_zone.this.name
}

output "name_servers" {
  value = google_dns_managed_zone.this.name_servers
}
