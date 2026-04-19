variable "project_id" {
  type = string
}

variable "environment" {
  type = string
}

# Extra project-level roles to grant the ci-deployer service account. Production
# only needs the baseline (GKE + Artifact Registry) hard-coded in main.tf, but
# staging also needs IAP + compute + OS Login roles so the CD workflow can SSH
# into the staging VM via `gcloud compute ssh --tunnel-through-iap` and push
# the compose tree.
variable "extra_ci_deployer_roles" {
  type        = list(string)
  default     = []
  description = "Additional IAM roles appended to the baseline ci-deployer role set"
}

# Workload Identity bindings target <project>.svc.id.goog, which only exists
# when a GKE cluster with Workload Identity is provisioned in the project.
# Staging runs on a VM + docker compose (see module.staging_vm) and does not
# have this identity pool, so these bindings must be skipped there.
variable "enable_gke_workload_identity" {
  type        = bool
  default     = true
  description = "Create K8s-SA -> Google-SA Workload Identity bindings. Set to false in environments that don't run GKE."
}
