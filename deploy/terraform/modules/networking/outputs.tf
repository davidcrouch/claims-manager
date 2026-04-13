output "vpc_id" {
  value = google_compute_network.vpc.id
}

output "vpc_self_link" {
  value = google_compute_network.vpc.self_link
  # Consumers (Cloud SQL, Memorystore) require Private Service Access; do not resolve this output until peering exists.
  depends_on = [google_service_networking_connection.private_services]
}

output "subnet_id" {
  value = google_compute_subnetwork.gke.id
}

output "subnet_self_link" {
  value = google_compute_subnetwork.gke.self_link
}

output "pod_range_name" {
  value = local.pod_range_name
}

output "service_range_name" {
  value = local.service_range_name
}
