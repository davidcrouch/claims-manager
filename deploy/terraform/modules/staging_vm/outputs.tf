output "public_ip" {
  value       = google_compute_address.staging.address
  description = "External IP used for DNS A records and direct SSH"
}

output "instance_group" {
  value       = google_compute_instance_group_manager.staging.instance_group
  description = "Self-link of the managed instance group"
}

output "service_account_email" {
  value = google_service_account.staging_vm.email
}

output "data_disk_name" {
  value = google_compute_disk.data.name
}

output "data_disk_device" {
  value = "data"
}

output "instance_base_name" {
  value       = "claims-manager-${var.environment}"
  description = "Prefix used for MIG instance names; useful for scp/ssh targeting"
}

output "zone" {
  value = var.zone
}
