variable "project_id" {
  type        = string
  description = "GCP project ID"
}

variable "project_number" {
  type        = string
  description = "GCP project number (for Pub/Sub service agent IAM)"
}

variable "env" {
  type        = string
  description = "Environment suffix used in topic/subscription names (e.g. dev, staging)"
}

variable "labels" {
  type        = map(string)
  default     = {}
  description = "Extra labels merged onto all topics"
}

variable "push_endpoint" {
  type        = string
  default     = null
  description = "If set, create push subscriptions targeting this URL (e.g. https://…/_internal/pubsub/push). Null = topics + DLQ only."
}

variable "push_oidc_sa_email" {
  type        = string
  default     = null
  description = "Service account email used for OIDC push auth (required when push_endpoint is set)"
}

variable "dlq_max_attempts" {
  type        = number
  default     = 5
  description = "Max delivery attempts before DLQ"
}
