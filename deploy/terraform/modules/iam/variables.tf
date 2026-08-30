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
