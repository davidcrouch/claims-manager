variable "project_id" {
  type        = string
  description = "GCP project ID for the staging environment"
}

variable "infra_project_id" {
  type        = string
  description = "GCP project ID for shared infrastructure (Artifact Registry, Terraform state)"
}

variable "region" {
  type    = string
  default = "australia-southeast1"
}

variable "environment" {
  type    = string
  default = "staging"
}

variable "cloudsql_tier" {
  type    = string
  default = "db-custom-1-3840"
}

variable "gateway_ip" {
  type        = string
  description = "External IP address of the GKE Gateway for DNS records"
  default     = ""
}

variable "dns_name" {
  type        = string
  description = "DNS zone name for this environment (e.g. staging.example.com.)"
}
