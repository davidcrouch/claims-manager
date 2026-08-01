resource "google_pubsub_topic" "this" {
  name                       = var.name
  project                    = var.project
  message_retention_duration = var.message_retention_duration
  labels                     = var.labels
}

output "name" {
  value = google_pubsub_topic.this.name
}

output "id" {
  value = google_pubsub_topic.this.id
}
