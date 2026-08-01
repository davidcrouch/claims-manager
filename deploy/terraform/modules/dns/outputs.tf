output "zone_name" {
  value = google_dns_managed_zone.this.name
}

output "name_servers" {
  value = google_dns_managed_zone.this.name_servers
}

output "hostnames" {
  description = "Public host FQDNs (api/auth/app) for this environment"
  value = {
    for k, v in google_dns_record_set.hosts : k => trimsuffix(v.name, ".")
  }
}
