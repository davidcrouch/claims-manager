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
  description = "Apex DNS zone with trailing dot (e.g. branlamie.com.). Records: api-staging / auth-staging / app-staging."
}

variable "enable_staging_vm" {
  type        = bool
  default     = false
  description = "Provision the Compose/Caddy staging VM MIG. Off once Cloud Run is the edge."
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

variable "enable_cloud_run" {
  type        = bool
  default     = true
  description = "Provision Cloud Run services (api, auth, frontend, provider) + migrate Job"
}

variable "use_public_hostnames" {
  type        = bool
  default     = false
  description = "When true, auth/frontend OIDC env uses app-staging./auth-staging. hostnames (Cloudflare → *.run.app). When false, uses *.run.app URLs directly."
}

variable "cloud_run_image_tag" {
  type        = string
  default     = "latest"
  description = "Image tag used by terraform-managed Cloud Run services (CD also deploys newer tags)"
}

variable "cloud_run_use_bootstrap_image" {
  type        = bool
  default     = true
  description = "Use public hello image for first apply (before AR images exist). CD replaces images; set false after first successful deploy if desired."
}

variable "cloud_run_api_min_instances" {
  type        = number
  default     = 0
  description = "min-instances for api-server (set 1 if LibreOffice cold starts hurt)"
}

variable "more0_gateway_url" {
  type        = string
  default     = "http://localhost:3205"
  description = "More0 HTTP gateway URL for provider-server dispatch (override in tfvars when available)"
}
