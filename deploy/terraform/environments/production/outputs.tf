output "cloudsql_private_ip" {
  value = module.cloudsql.private_ip
}

output "cloudsql_admin_password" {
  value     = module.cloudsql.admin_password
  sensitive = true
}

output "cloudsql_admin_user" {
  value = "claims_manager_admin"
}

output "cloudsql_database_names" {
  value = module.cloudsql.database_names
}

output "redis_host" {
  value = module.memorystore.host
}

output "redis_port" {
  value = module.memorystore.port
}

output "frontend_sa_email" {
  value = module.iam.service_account_emails["frontend"]
}

output "pubsub_topic_names" {
  value = module.pubsub.topic_names
}

output "cloud_run_uris" {
  value = var.enable_cloud_run ? {
    api          = module.cloud_run_api[0].uri
    auth         = module.cloud_run_auth[0].uri
    frontend     = module.cloud_run_frontend[0].uri
    provider     = module.cloud_run_provider[0].uri
    claims_mcp   = module.cloud_run_claims_mcp[0].uri
    ms_graph_mcp = module.cloud_run_ms_graph_mcp[0].uri
  } : {}
}

output "cloudsql_provider_app_user" {
  value = module.cloudsql.provider_app_user
}

output "cloudsql_provider_app_password" {
  value     = module.cloudsql.provider_app_password
  sensitive = true
}

output "subnet_name" {
  value = module.networking.subnet_name
}

output "use_public_hostnames" {
  value       = var.use_public_hostnames
  description = "Whether OIDC env uses Cloudflare public hostnames vs *.run.app"
}

output "lb_ip" {
  value       = module.https_lb.lb_ip
  description = "Global anycast IP for the HTTPS load balancer (point DNS A records here)"
}
