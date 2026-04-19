variable "project_id" {
  type = string
}

variable "environment" {
  type = string
}

variable "dns_name" {
  type = string
}

variable "gateway_ip" {
  type = string
}

variable "create_subdomain_records" {
  type        = bool
  default     = true
  description = "Whether to create api/auth/app A records. Must be known at plan time; gate on static config, not module outputs."
}
