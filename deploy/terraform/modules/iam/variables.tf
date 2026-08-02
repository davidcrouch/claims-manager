variable "project_id" {
  type = string
}

variable "environment" {
  type = string
}

variable "extra_ci_deployer_roles" {
  type        = list(string)
  default     = []
  description = "Additional project IAM roles for the ci-deployer service account"
}

# Unused for Cloud Run (default false). Kept to avoid state churn.
variable "enable_gke_workload_identity" {
  type        = bool
  default     = false
  description = "Create K8s-SA -> Google-SA Workload Identity bindings. Not used for Cloud Run."
}
