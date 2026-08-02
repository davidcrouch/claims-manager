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

output "pubsub_topic_names" {
  value       = module.pubsub.topic_names
  description = "Domain Pub/Sub topic names (env-suffixed)"
}

output "cloud_run_uris" {
  value = var.enable_cloud_run ? {
    api      = module.cloud_run_api[0].uri
    auth     = module.cloud_run_auth[0].uri
    frontend = module.cloud_run_frontend[0].uri
    provider = module.cloud_run_provider[0].uri
  } : {}
  description = "Cloud Run service URIs (*.run.app)"
}

output "cloudsql_provider_app_user" {
  value       = module.cloudsql.provider_app_user
  description = "Least-privilege SQL user for provider-server"
}

output "cloudsql_provider_app_password" {
  value     = module.cloudsql.provider_app_password
  sensitive = true
}

output "use_public_hostnames" {
  value       = var.use_public_hostnames
  description = "Whether OIDC env uses Cloudflare public hostnames vs *.run.app"
}

output "subnet_name" {
  value       = module.networking.subnet_name
  description = "Active private subnet name"
}

output "lb_ip" {
  value       = module.https_lb.lb_ip
  description = "Global anycast IP for the HTTPS load balancer (point DNS A records here)"
}
