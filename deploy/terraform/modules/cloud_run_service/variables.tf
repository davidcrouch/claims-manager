variable "project_id" {
  type = string
}

variable "region" {
  type = string
}

variable "name" {
  type        = string
  description = "Cloud Run service name (e.g. api-server, provider-server)"
}

variable "image" {
  type        = string
  description = "Full Artifact Registry image URL including tag"
}

variable "service_account_email" {
  type = string
}

variable "container_port" {
  type    = number
  default = 8080
}

variable "cpu" {
  type    = string
  default = "1"
}

variable "memory" {
  type    = string
  default = "512Mi"
}

variable "min_instances" {
  type    = number
  default = 0
}

variable "max_instances" {
  type    = number
  default = 1
}

variable "container_concurrency" {
  type    = number
  default = 40
}

variable "timeout" {
  type    = string
  default = "300s"
}

variable "cpu_idle" {
  type    = bool
  default = true
}

variable "startup_cpu_boost" {
  type    = bool
  default = true
}

variable "health_path" {
  type    = string
  default = "/api/v1/health"
}

variable "enable_probes" {
  type        = bool
  default     = true
  description = "Set false for bootstrap hello image (probes would fail until CD deploys real images)"
}

variable "ingress" {
  type        = string
  default     = "INGRESS_TRAFFIC_ALL"
  description = "INGRESS_TRAFFIC_ALL | INGRESS_TRAFFIC_INTERNAL_ONLY | INGRESS_TRAFFIC_INTERNAL_LOAD_BALANCER"
}

variable "allow_unauthenticated" {
  type        = bool
  default     = false
  description = "Grant roles/run.invoker to allUsers (public HTTP services)"
}

variable "invoker_members" {
  type        = list(string)
  default     = []
  description = "Additional IAM members granted roles/run.invoker (serviceAccounts/...)"
}

variable "env_vars" {
  type    = map(string)
  default = {}
}

variable "secret_env_vars" {
  type = list(object({
    name    = string
    secret  = string
    version = optional(string, "latest")
  }))
  default = []
}

variable "vpc_network" {
  type        = string
  default     = null
  description = "VPC self link for Direct VPC egress (private Cloud SQL / Memorystore)"
}

variable "vpc_subnet" {
  type    = string
  default = null
}

variable "vpc_egress" {
  type    = string
  default = "PRIVATE_RANGES_ONLY"
}
