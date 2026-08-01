variable "name" {
  type        = string
  description = "Subscription name"
}

variable "project" {
  type        = string
  description = "GCP project ID"
}

variable "topic" {
  type        = string
  description = "Topic name to subscribe to"
}

variable "ack_deadline_seconds" {
  type        = number
  default     = 60
  description = "Ack deadline in seconds"
}

variable "filter" {
  type        = string
  default     = ""
  description = "Subscription filter expression"
}

variable "push_endpoint" {
  type        = string
  default     = null
  description = "Push endpoint URL (null for pull subscription)"
}

variable "push_attributes" {
  type        = map(string)
  default     = { "x-goog-version" = "v1" }
  description = "Push config attributes"
}

variable "push_oidc_service_account_email" {
  type        = string
  default     = null
  description = "SA email for OIDC push auth"
}

variable "push_oidc_audience" {
  type        = string
  default     = ""
  description = "OIDC audience"
}

variable "dead_letter_topic_id" {
  type        = string
  default     = null
  description = "DLQ topic ID"
}

variable "dlq_max_attempts" {
  type        = number
  default     = 5
  description = "Max delivery attempts before DLQ"
}

variable "retry_minimum_backoff" {
  type        = string
  default     = "10s"
  description = "Minimum retry backoff duration"
}

variable "retry_maximum_backoff" {
  type        = string
  default     = "600s"
  description = "Maximum retry backoff duration"
}
