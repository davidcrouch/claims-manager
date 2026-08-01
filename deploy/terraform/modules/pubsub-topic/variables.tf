variable "name" {
  type        = string
  description = "Topic name"
}

variable "project" {
  type        = string
  description = "GCP project ID"
}

variable "message_retention_duration" {
  type        = string
  default     = "604800s"
  description = "How long to retain unacknowledged messages (default 7 days)"
}

variable "labels" {
  type        = map(string)
  default     = {}
  description = "Labels to attach to the topic"
}
