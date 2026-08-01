resource "google_pubsub_subscription" "this" {
  name    = var.name
  project = var.project
  topic   = var.topic

  ack_deadline_seconds = var.ack_deadline_seconds
  filter               = var.filter == "" ? null : var.filter

  dynamic "push_config" {
    for_each = var.push_endpoint == null ? [] : [var.push_endpoint]
    content {
      push_endpoint = push_config.value
      attributes    = var.push_attributes

      dynamic "oidc_token" {
        for_each = var.push_oidc_service_account_email == null ? [] : [var.push_oidc_service_account_email]
        content {
          service_account_email = oidc_token.value
          audience              = var.push_oidc_audience == "" ? null : var.push_oidc_audience
        }
      }
    }
  }

  dynamic "dead_letter_policy" {
    for_each = var.dead_letter_topic_id == null ? [] : [var.dead_letter_topic_id]
    content {
      dead_letter_topic   = dead_letter_policy.value
      max_delivery_attempts = var.dlq_max_attempts
    }
  }

  retry_policy {
    minimum_backoff = var.retry_minimum_backoff
    maximum_backoff = var.retry_maximum_backoff
  }
}

output "name" {
  value = google_pubsub_subscription.this.name
}

output "id" {
  value = google_pubsub_subscription.this.id
}
