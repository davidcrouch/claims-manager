output "service_account_emails" {
  value = { for k, sa in google_service_account.workload : k => sa.email }
}

output "ci_deployer_email" {
  value = google_service_account.ci_deployer.email
}

output "external_secrets_email" {
  value = google_service_account.external_secrets.email
}
