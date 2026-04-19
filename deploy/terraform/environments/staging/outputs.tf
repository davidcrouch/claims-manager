# Outputs consumed by deploy/scripts/seed-staging-secrets.ps1 to
# construct DATABASE_URL_* / REDIS_URL and to target the HMAC key it
# creates for the frontend service account. Keep them explicit so the
# script never has to dig into terraform state internals.

output "cloudsql_private_ip" {
  value       = module.cloudsql.private_ip
  description = "CloudSQL instance private IP (used by DATABASE_URL_API/AUTH)"
}

output "cloudsql_admin_password" {
  value       = module.cloudsql.admin_password
  sensitive   = true
  description = "claims_manager_admin password, used to build DATABASE_URL_*"
}

output "cloudsql_admin_user" {
  value       = "claims_manager_admin"
  description = "CloudSQL admin user the seed script wires into DATABASE_URL_*"
}

output "cloudsql_database_names" {
  value       = module.cloudsql.database_names
  description = "Databases provisioned inside the CloudSQL instance"
}

output "redis_host" {
  value       = module.memorystore.host
  description = "Memorystore private IP"
}

output "redis_port" {
  value       = module.memorystore.port
  description = "Memorystore listening port (default 6379)"
}

output "frontend_sa_email" {
  value       = module.iam.service_account_emails["frontend"]
  description = "Frontend workload SA - target of the GCS HMAC key"
}

output "staging_vm_public_ip" {
  value       = module.staging_vm.public_ip
  description = "Static external IP fronting Caddy - used to verify DNS delegation"
}
