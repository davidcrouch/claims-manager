variable "project_id" {
  type        = string
  description = "GCP project ID for the dev environment"
}

variable "region" {
  type    = string
  default = "australia-southeast1"
}

variable "environment" {
  type    = string
  default = "dev"
}
