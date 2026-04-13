variable "project_id" {
  type = string
}

variable "region" {
  type = string
}

variable "environment" {
  type = string
}

variable "tier" {
  type = string
}

variable "availability_type" {
  type    = string
  default = "ZONAL"
}

variable "backup_retention_days" {
  type    = number
  default = 7
}

variable "private_network" {
  type = string
  description = <<-EOT
VPC network self link for private IP. Private Service Access (servicenetworking) peering must exist on this VPC.
Extensions vector (pgvector) and uuid-ossp are enabled per database with SQL after the instance is available; Cloud SQL provides no Terraform flags for them.
EOT
}
