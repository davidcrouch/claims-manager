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

variable "dns_name" {
  type        = string
  description = "DNS zone name for this environment (e.g. staging.branlamie.com.)"
}

variable "staging_vm_zone" {
  type        = string
  description = "Zone that the staging VM MIG and data disk live in"
  default     = "australia-southeast1-a"
}

variable "staging_vm_data_disk_size_gb" {
  type        = number
  description = "Size of the detachable data disk (compose tree, docker config, caddy state)"
  default     = 20
}

variable "staging_vm_admin_cidr" {
  type        = string
  description = "CIDR allowed to SSH to the staging VM (defaults to the GCP IAP range)"
  default     = "35.235.240.0/20"
}

variable "caddy_admin_email" {
  type        = string
  description = "ACME contact email Caddy uses when requesting certificates"
  default     = "ops@branlamie.com"
}

# The SA that CI workflows actually impersonate via Workload Identity
# Federation. Created by deploy/terraform/bootstrap/infra, lives in the
# infra project. The orphan ci-deployer that module.iam creates in the
# staging project is intentionally unused (kept to avoid invasive edits
# to that shared module).
variable "ci_deployer_infra_email" {
  type        = string
  description = "Email of the ci-deployer SA in claims-manager-infra-493807 that GitHub Actions impersonates"
  default     = "ci-deployer@claims-manager-infra-493807.iam.gserviceaccount.com"
}
