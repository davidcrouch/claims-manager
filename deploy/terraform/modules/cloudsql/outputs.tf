output "instance_name" {
  value = google_sql_database_instance.this.name
}

output "instance_connection_name" {
  value = google_sql_database_instance.this.connection_name
}

output "private_ip" {
  value = google_sql_database_instance.this.private_ip_address
}

output "database_names" {
  value = [for name in local.database_ids : google_sql_database.databases[name].name]
}

output "admin_password" {
  value     = random_password.sql_admin.result
  sensitive = true
}

output "provider_app_user" {
  value       = var.create_provider_app_user ? google_sql_user.provider_app[0].name : null
  description = "Least-privilege SQL user for provider-server"
}

output "provider_app_password" {
  value     = var.create_provider_app_user ? random_password.provider_app[0].result : null
  sensitive = true
}
