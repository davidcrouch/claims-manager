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
  description = "Apex DNS zone with trailing dot (e.g. branlamie.com.). Used for Cloudflare hostname strings in OIDC env when use_public_hostnames=true."
}

variable "ci_deployer_infra_email" {
  type        = string
  description = "Email of the ci-deployer SA in claims-manager-infra that GitHub Actions impersonates"
  default     = "ci-deployer@claims-manager-infra-493807.iam.gserviceaccount.com"
}

variable "enable_cloud_run" {
  type        = bool
  default     = true
  description = "Provision Cloud Run services (api, auth, frontend, provider) + migrate Job"
}

variable "use_public_hostnames" {
  type        = bool
  default     = false
  description = "When true, auth/frontend OIDC env uses Cloudflare hostnames. When false, uses *.run.app URLs."
}

variable "cloud_run_image_tag" {
  type        = string
  default     = "latest"
  description = "Image tag referenced by terraform (CD deploys newer tags; image drift ignored)"
}

variable "cloud_run_use_bootstrap_image" {
  type        = bool
  default     = false
  description = "Use public hello image only for brand-new projects before first CI image push"
}

variable "cloud_run_api_min_instances" {
  type        = number
  default     = 0
  description = "min-instances for api-server (set 1 if LibreOffice cold starts hurt)"
}

variable "more0_gateway_url" {
  type        = string
  default     = "http://localhost:3205"
  description = "More0 HTTP gateway URL for provider-server dispatch"
}
