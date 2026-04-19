output "wif_provider" {
  value       = "projects/${data.google_project.infra.number}/locations/global/workloadIdentityPools/${google_iam_workload_identity_pool.github.workload_identity_pool_id}/providers/${google_iam_workload_identity_pool_provider.github.workload_identity_pool_provider_id}"
  description = "Set this exact string as the GitHub Actions repo secret WIF_PROVIDER"
}

output "ci_deployer_email" {
  value       = google_service_account.ci_deployer.email
  description = "Used in .github/workflows/*.yaml as the service_account: to impersonate"
}

output "state_bucket" {
  value       = google_storage_bucket.tfstate.name
  description = "Already referenced by environments/staging and environments/production as their gcs backend"
}

output "infra_project_number" {
  value = data.google_project.infra.number
}
