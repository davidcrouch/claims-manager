variable "project_id" {
  type        = string
  description = "GCP project ID for the production environment"
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
  default = "production"
}

variable "cloudsql_tier" {
  type    = string
  default = "db-custom-4-16384"
}

variable "gateway_ip" {
  type        = string
  description = "External IP address of the GKE Gateway for DNS records"
  default     = ""
}

variable "dns_name" {
  type        = string
  description = "DNS zone name for production (e.g. app.example.com.)"
}
