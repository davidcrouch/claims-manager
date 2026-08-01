output "project_id" {
  value       = var.project_id
  description = "Dev GCP project ID"
}

output "pubsub_topic_names" {
  value       = module.pubsub.topic_names
  description = "Domain Pub/Sub topic names (env-suffixed)"
}

output "pubsub_dlq_topic_names" {
  value       = module.pubsub.dlq_topic_names
  description = "DLQ topic names for domain push subscriptions"
}

output "pubsub_publisher_sa_email" {
  value       = google_service_account.pubsub_publisher.email
  description = "Service account for local API to publish Pub/Sub messages (impersonate via ADC)"
}

output "secret_ids" {
  value       = module.secrets.secret_ids
  description = "Secret Manager secret IDs created in the dev project"
}

output "gcs_bucket_names" {
  value       = module.gcs.bucket_names
  description = "Legacy GCS bucket names (chat-attachments, shared)"
}

output "documents_bucket_name" {
  value       = module.gcs.documents_bucket_name
  description = "Documents/filesystem GCS bucket — set GCS_DOCUMENTS_BUCKET in local API .env"
}
