output "vpc_id" {
  value = google_compute_network.vpc.id
}

output "vpc_self_link" {
  value = google_compute_network.vpc.self_link
  # Consumers (Cloud SQL, Memorystore) require Private Service Access; do not resolve this output until peering exists.
  depends_on = [google_service_networking_connection.private_services]
}

output "subnet_id" {
  value = google_compute_subnetwork.private.id
}

output "subnet_self_link" {
  value = google_compute_subnetwork.private.self_link
}

output "subnet_name" {
  value = google_compute_subnetwork.private.name
}

output "secondary_range_a_name" {
  value = local.secondary_range_a
}

output "secondary_range_b_name" {
  value = local.secondary_range_b
}
