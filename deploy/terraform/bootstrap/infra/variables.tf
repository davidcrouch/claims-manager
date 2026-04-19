variable "infra_project_id" {
  type        = string
  description = "GCP project that hosts Artifact Registry, WIF, terraform state, and the ci-deployer SA"
  default     = "claims-manager-infra-493807"
}

variable "staging_project_id" {
  type        = string
  description = "GCP project for the staging environment. ci-deployer is granted cross-project roles here."
  default     = "claims-manager-staging-493807"
}

variable "region" {
  type    = string
  default = "australia-southeast1"
}

variable "state_bucket_name" {
  type        = string
  description = "Name of the GCS bucket backing environments/* terraform state"
  default     = "claims-manager-terraform-state"
}

variable "github_owner" {
  type        = string
  description = "GitHub org or user that owns the repo (matches assertion.repository_owner in OIDC tokens)"
}

variable "github_repo" {
  type        = string
  description = "GitHub repository name (without owner)"
  default     = "claims-manager"
}
