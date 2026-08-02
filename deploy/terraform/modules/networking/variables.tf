variable "project_id" {
  type        = string
  description = "GCP project ID."
}

variable "region" {
  type        = string
  description = "GCP region for regional resources."
  default     = "us-central1"
}

variable "environment" {
  type        = string
  description = "Deployment environment label (e.g. dev, staging, prod)."
}

variable "subnet_name" {
  type        = string
  default     = null
  description = "Override the primary subnet name. Defaults to claims-manager-private-<env>."
}

variable "subnet_ip_cidr_range" {
  type        = string
  default     = null
  description = "Primary subnet CIDR. Defaults to 10.0.0.0/20."
}

variable "secondary_range_a_name" {
  type        = string
  default     = null
  description = "Override first secondary range name. Defaults to claims-manager-sec-a-<env>."
}

variable "secondary_range_b_name" {
  type        = string
  default     = null
  description = "Override second secondary range name. Defaults to claims-manager-sec-b-<env>."
}

variable "secondary_ip_cidr_a" {
  type        = string
  default     = null
  description = "First secondary CIDR. Defaults to 10.16.0.0/16."
}

variable "secondary_ip_cidr_b" {
  type        = string
  default     = null
  description = "Second secondary CIDR. Defaults to 10.1.0.0/22."
}
