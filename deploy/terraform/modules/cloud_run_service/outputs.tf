output "service_name" {
  value = google_cloud_run_v2_service.this.name
}

output "uri" {
  value = google_cloud_run_v2_service.this.uri
}

output "id" {
  value = google_cloud_run_v2_service.this.id
}

output "domain_mapping_resource_records" {
  description = "DNS records required for the custom domain mapping (if any)"
  value = length(google_cloud_run_domain_mapping.this) > 0 ? try(
    google_cloud_run_domain_mapping.this[0].status[0].resource_records,
    [],
  ) : []
}
