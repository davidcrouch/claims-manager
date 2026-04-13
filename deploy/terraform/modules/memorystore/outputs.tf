output "host" {
  value = google_redis_instance.this.host
}

output "port" {
  value = google_redis_instance.this.port
}

output "current_location_id" {
  value = google_redis_instance.this.current_location_id
}
