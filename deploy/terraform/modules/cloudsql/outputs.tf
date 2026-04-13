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
