variable "project_id" {
  type        = string
  description = "GCP project ID for the staging environment"
}

variable "region" {
  type        = string
  description = "Region the VM runs in, e.g. australia-southeast1"
}

variable "zone" {
  type        = string
  description = "Zone for the data disk and instance group"
  default     = "australia-southeast1-a"
}

variable "environment" {
  type    = string
  default = "staging"
}

variable "vpc_self_link" {
  type        = string
  description = "Self-link of the VPC the instance attaches to. Must be the same VPC as CloudSQL/Memorystore so services reach them over private IP."
}

variable "subnet_self_link" {
  type        = string
  description = "Self-link of the regional subnet the instance attaches to"
}

variable "machine_type" {
  type        = string
  description = "GCE machine type for the MIG instance template"
  default     = "e2-standard-2"
}

variable "boot_disk_size_gb" {
  type    = number
  default = 20
}

variable "data_disk_size_gb" {
  type        = number
  description = "Persistent data disk size in GiB. Holds compose tree, docker config/plugins and caddy state. Postgres/Redis are managed services (CloudSQL + Memorystore), so this disk stays small."
  default     = 20
}

variable "admin_cidr" {
  type        = string
  description = "CIDR allowed to SSH on port 22 (IAP range 35.235.240.0/20 by default)"
  default     = "35.235.240.0/20"
}

variable "snapshot_retention_days" {
  type    = number
  default = 7
}

variable "domain" {
  type        = string
  description = "Public staging domain — used to stamp the HOST vars (api/auth/app) rendered by startup.sh"
  default     = "staging.branlamie.com"
}

variable "caddy_admin_email" {
  type        = string
  description = "ACME contact email Caddy uses when requesting certificates"
  default     = "ops@branlamie.com"
}
